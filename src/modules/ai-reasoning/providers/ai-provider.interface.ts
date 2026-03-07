// src/modules/ai-reasoning/providers/ai-provider.interface.ts

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AICompletionParams {
  systemPrompt: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  model: string;
}

export interface AIProvider {
  complete(params: AICompletionParams): Promise<AICompletionResponse>;
}