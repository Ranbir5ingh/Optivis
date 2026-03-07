import { IsArray, ArrayMinSize, ArrayMaxSize, IsString } from 'class-validator';

/**
 * DTO for batch code fetch request
 */
export class FetchBatchDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'componentIds array cannot be empty' })
  @ArrayMaxSize(50, { message: 'Maximum 50 components per batch request' })
  @IsString({ each: true, message: 'Each componentId must be a string' })
  componentIds: string[];
}