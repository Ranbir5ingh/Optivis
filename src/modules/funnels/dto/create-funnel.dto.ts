import {
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsOptional,
  ArrayMinSize,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FunnelStepDto {
  @IsInt()
  @Min(1)
  index: number;

  @IsString()
  @MinLength(1)
  name: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  paths: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutMinutes?: number;
}

export class CreateFunnelDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunnelStepDto)
  @ArrayMinSize(2)
  steps: FunnelStepDto[];
}