// src/modules/ai-reasoning/providers/claude.provider.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from 'src/common/exceptions/domain-error';
import {
  AIProvider,
  AICompletionParams,
  AICompletionResponse,
} from './ai-provider.interface';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: ClaudeMessage[];
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

@Injectable()
export class ClaudeProvider implements AIProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly apiKey: string;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    this.apiKey = key;
  }

  async complete(params: AICompletionParams): Promise<AICompletionResponse> {
    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.warn(`Retry attempt ${attempt}/${maxRetries}`);
          await this.delay(1000 * attempt);
        }

        const response = await this.makeRequest(params);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          `Claude API call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`,
        );
      }
    }

    throw new DomainError(
      'AI_REASONING_FAILED',
      'Failed to generate AI recommendations after retries',
      'unexpected',
      { error: lastError?.message },
    );
  }

  private async makeRequest(
    params: AICompletionParams,
  ): Promise<AICompletionResponse> {
    const requestBody: ClaudeRequest = {
      model: this.model,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: params.messages,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as ClaudeResponse;

      const text = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      this.logger.debug(
        `Claude API call completed: ${data.usage.input_tokens} in, ${data.usage.output_tokens} out`,
      );

      return {
        text,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        },
        model: this.model,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Claude API request timeout');
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}