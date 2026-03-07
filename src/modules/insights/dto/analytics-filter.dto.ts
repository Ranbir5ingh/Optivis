// src/modules/analytics-query/dto/analytics-filter.dto.ts

import { IsDateString, IsOptional, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { TimeBucket } from '../domain/time-bucket.enum';

export class AnalyticsFilterDto {
  @IsDateString()
  @Type(() => String)
  startDate: string; // ISO 8601

  @IsDateString()
  @Type(() => String)
  endDate: string; // ISO 8601

  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsString()
  elementId?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsIn(Object.values(TimeBucket))
  granularity?: TimeBucket;
}