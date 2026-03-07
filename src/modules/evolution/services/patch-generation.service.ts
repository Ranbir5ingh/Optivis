// src/modules/evolution/services/patch-generation.service.ts
// ✅ FIXED: Full file replacement instead of diff parsing

import { Injectable, Logger, Inject } from '@nestjs/common';
import { RecommendationInstancesRepository } from '../repositories/recommendation-instances.repository';
import { EvolutionJobsRepository } from '../repositories/evolution-jobs.repository';
import { CodeFetchService } from 'src/modules/code-intelligence/services/code-fetch.service';
import { DomainError } from 'src/common/exceptions/domain-error';
import { createHash } from 'crypto';
import { AI_PROVIDER } from 'src/modules/ai-reasoning/providers/ai-provider.tokens';
import type { AIProvider } from 'src/modules/ai-reasoning/providers/ai-provider.interface';
import { StoredRecommendationSnapshot } from '../domain/recommendation-instance.types';

interface FileUpdate {
  filePath: string;
  updatedContent: string;
}

interface PatchResponse {
  files: FileUpdate[];
}

@Injectable()
export class PatchGenerationService {
  private readonly logger = new Logger(PatchGenerationService.name);

  constructor(
    private readonly instancesRepo: RecommendationInstancesRepository,
    private readonly jobsRepo: EvolutionJobsRepository,
    private readonly codeFetchService: CodeFetchService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  /**
   * ✅ FIXED: Generate full file replacements instead of diffs
   *
   * This is the production-grade approach:
   * - AI returns complete updated files (not diffs)
   * - No diff parsing needed
   * - Files are replaced atomically on GitHub
   * - Much more reliable and easier to validate
   */
  async generatePatch(instanceId: string): Promise<void> {
    const instance = await this.instancesRepo.getById(instanceId);

    if (!instance) {
      throw new DomainError(
        'INSTANCE_NOT_FOUND',
        'Recommendation instance not found',
        'not_found',
      );
    }

    if (instance.status !== 'accepted') {
      throw new DomainError(
        'INVALID_STATUS',
        `Cannot generate patch in ${instance.status} status`,
        'conflict',
      );
    }

    const rec = instance.recommendationSnapshot;

    // Fetch the actual code that needs to be modified
    let codeContext: Array<{
      filePath: string;
      componentId: string;
      name: string;
      code: string;
    }> = [];
    try {
      const components = await this.codeFetchService.fetchMultipleComponents(
        instance.projectId,
        rec.scope.componentIds,
      );

      codeContext = components.map((c) => ({
        filePath: c.filepath,
        componentId: c.componentId,
        name: c.name,
        code: c.code,
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to fetch code context for ${instanceId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(rec, codeContext);

    try {
      const response = await this.ai.complete({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 8192,
        temperature: 0.3,
      });

      // Parse the JSON response containing full file updates
      const patchData = this.parseResponse(response.text);

      // Generate a hash of the file contents for idempotency
      const patchHash = this.generatePatchHash(patchData.files);

      // Store the updated files (not diff)
      const diffContent = JSON.stringify(patchData, null, 2);

      await this.instancesRepo.updateStatus(instanceId, 'patch_generated', {
        patchGeneratedAt: new Date(),
        patchHash,
        diffContent, // Store JSON representation for audit trail
      });

      // Queue the PR creation job
      await this.jobsRepo.create({
        projectId: instance.projectId,
        instanceId,
        jobType: 'create_pr',
        status: 'pending',
        maxRetries: 3,
      });

      this.logger.log(
        `Generated patch for instance ${instanceId}: ${patchData.files.length} file(s)`,
      );
    } catch (error) {
      throw new DomainError(
        'PATCH_GENERATION_FAILED',
        `Failed to generate patch: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'unexpected',
      );
    }
  }

  /**
   * System prompt for full file generation
   * Instructs AI to return complete updated files, not diffs
   */
  private buildSystemPrompt(): string {
    return `You are an expert frontend engineer. Your task is to apply a recommendation to source code by generating complete updated files.

You will return ONLY valid JSON in this exact format - no explanations, no markdown:

{
  "files": [
    {
      "filePath": "path/to/file.tsx",
      "updatedContent": "complete updated file content here"
    }
  ]
}

CRITICAL RULES:
1. Return ONLY valid JSON - no backticks, no explanations
2. Return the COMPLETE updated file content, not just changes
3. Preserve all unrelated code exactly as it is
4. Apply only the minimal necessary changes for the recommendation
5. Maintain consistent formatting and style
6. Ensure the code is syntactically valid
7. If multiple files need updates, include all in the "files" array`;
  }

  /**
   * User prompt with code context and recommendation
   */
  private buildUserPrompt(
    rec: StoredRecommendationSnapshot,
    codeContext: Array<{
      filePath: string;
      componentId: string;
      name: string;
      code: string;
    }>,
  ): string {
    const codeSection = codeContext
      .map(
        (c) =>
          `File: ${c.filePath}
Component: ${c.name} (${c.componentId})
---
${c.code}
---`,
      )
      .join('\n\n');

    return `Apply this recommendation to the source code and return the updated files:

RECOMMENDATION:
Title: ${rec.title}
Explanation: ${rec.explanation}
Implementation Steps:
${rec.implementationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

ACTION TYPE: ${rec.actionType}
EXPECTED IMPACT: ${rec.expectedImpact}

CURRENT CODE:
${codeSection || '[No code context available]'}

Generate the complete updated files now. Return ONLY the JSON response with no additional text.`;
  }

  /**
   * Parse JSON response from AI
   * Validates that all files have content
   */
  private parseResponse(text: string): PatchResponse {
    try {
      // Extract JSON from response (handle cases where it might be wrapped)
      let jsonText = text.trim();

      // Remove markdown code fence if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }

      const parsed = JSON.parse(jsonText);

      if (!parsed.files || !Array.isArray(parsed.files)) {
        throw new Error('Response must contain "files" array');
      }

      // Validate each file
      for (const file of parsed.files) {
        if (!file.filePath) {
          throw new Error('Each file must have filePath');
        }
        if (!file.updatedContent) {
          throw new Error(`File ${file.filePath} has empty updatedContent`);
        }
        if (file.updatedContent.trim().length === 0) {
          throw new Error(`File ${file.filePath} updatedContent is empty`);
        }
      }

      return parsed as PatchResponse;
    } catch (error) {
      throw new DomainError(
        'INVALID_PATCH_FORMAT',
        `Failed to parse AI response: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'unexpected',
      );
    }
  }

  /**
   * Generate hash of file updates for idempotency tracking
   */
  private generatePatchHash(
    files: Array<{ filePath: string; updatedContent: string }>,
  ): string {
    const combined = files
      .map((f) => `${f.filePath}:${f.updatedContent}`)
      .join('||');
    return createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }
}
