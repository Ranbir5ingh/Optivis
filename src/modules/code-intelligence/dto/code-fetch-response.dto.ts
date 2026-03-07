/**
 * Component code response DTO
 */
export interface ComponentCodeDto {
  componentId: string;
  name: string;
  filepath: string;
  code: string;
  lineStart?: number;
  lineEnd?: number;
  language: string;
}

/**
 * Batch fetch response DTO
 */
export interface BatchFetchResponseDto {
  components: ComponentCodeDto[];
  totalRequested: number;
  totalFetched: number;
}