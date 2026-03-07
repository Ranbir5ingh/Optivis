import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  IsOptional,
  IsArray,
  IsIn,
  IsString,
} from 'class-validator';

export class GenerateRecommendationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxInsights?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxComponents?: number;

  @IsOptional()
  @IsArray()
  @IsIn(['high', 'medium', 'low', 'info'], { each: true })
  severityFilter?: Array<'high' | 'medium' | 'low' | 'info'>;

  @IsOptional()
  @IsString()
  commitSha?: string;
}
