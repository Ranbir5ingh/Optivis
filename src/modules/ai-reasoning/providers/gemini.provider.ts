// src/modules/ai-reasoning/providers/gemini.provider.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { DomainError } from 'src/common/exceptions/domain-error';
import {
  AIProvider,
  AICompletionParams,
  AICompletionResponse,
} from './ai-provider.interface';

/**
 * GeminiProvider
 *
 * Wraps the official @google/genai SDK to fulfil the AIProvider interface.
 *
 * Migration notes (raw-fetch → SDK):
 *  - GoogleGenAI client is initialised once in onModuleInit and reused
 *  - systemInstruction is a first-class config field (no message wrapping)
 *  - AbortController / manual timeout boilerplate is removed; the SDK
 *    handles transport internally
 *  - usageMetadata surface is flat on the response object
 *  - Retry / back-off logic mirrors ClaudeProvider for consistency
 *
 * Model choice:
 *  - Default: gemini-2.0-flash  (stable, production-ready)
 *  - Override via AI_GEMINI_MODEL env var (e.g. gemini-2.5-pro-preview)
 */
@Injectable()
export class GeminiProvider implements AIProvider, OnModuleInit {
  private readonly logger = new Logger(GeminiProvider.name);
  private client!: GoogleGenAI;
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    // Resolve model at construction time so it is available for logging
    this.modelName =
      this.config.get<string>('AI_GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
  }

  // ─── Lifecycle
  //────────────────────────────────────────────────────────────

  onModuleInit(): void {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. ' +
          'Set the environment variable before starting the application.',
      );
    }

    this.client = new GoogleGenAI({ apiKey });

    this.logger.log(`GeminiProvider initialised — model: ${this.modelName}`);
  }

  // ─── AIProvider implementation ────────────────────────────────────────────

  async complete(params: AICompletionParams): Promise<AICompletionResponse> {
    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.warn(
            `GeminiProvider retry ${attempt}/${maxRetries} for model ${this.modelName}`,
          );
          await this.delay(1000 * attempt);
        }

        return await this.makeRequest(params);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.error(
          `Gemini API call failed ` +
            `(attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`,
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

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async makeRequest(
    params: AICompletionParams,
  ): Promise<AICompletionResponse> {
    // Map internal message format → Gemini contents array
    const contents = params.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    let response: GenerateContentResponse;

    try {
      response = await this.client.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: params.systemPrompt,
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 4096,
        },
      });
    } catch (error) {
      // Re-throw so the retry loop in complete() can handle it
      throw error instanceof Error ? error : new Error(String(error));
    }

    const text = response.text;

    if (!text) {
      throw new Error(
        'Gemini returned an empty response. ' +
          'The prompt may have triggered a safety filter or the model ' +
          'produced no candidates.',
      );
    }

    const inputTokens = response.usageMetadata?.promptTokenCount;
    const outputTokens = response.usageMetadata?.candidatesTokenCount;

    this.logger.debug(
      `Gemini API call completed — ` +
        `model: ${this.modelName}, ` +
        `in: ${inputTokens ?? '?'} tokens, ` +
        `out: ${outputTokens ?? '?'} tokens`,
    );

    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
      },
      model: this.modelName,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
