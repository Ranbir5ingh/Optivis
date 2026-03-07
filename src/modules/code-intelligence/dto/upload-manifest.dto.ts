import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsObject,
  ValidateNested,
  IsNumber,
} from 'class-validator';

export enum Framework {
  NextJS = 'nextjs',
  Vite = 'vite',
  React = 'react',
  Webpack = 'webpack',
  Other = 'other',
}

export class MetadataDto {
  @IsNumber()
  totalComponents: number;

  @IsNumber()
  totalElements: number;

  @IsNumber()
  filesProcessed: number;
}

export class UploadManifestDto {
  @IsString()
  projectId: string;

  @IsString()
  commitSha: string;

  @IsString()
  branch: string;

  @IsEnum(Framework)
  framework: Framework;

  @IsString()
  timestamp: string; // ISO timestamp from build plugin

  @IsString()
  version: string; // e.g., "1.0.0"

  @IsObject()
  components: Record<
    string,
    {
      name: string;
      file: string;
      exports: string[];
      lineStart?: number;
      lineEnd?: number;
    }
  >;

  @IsObject()
  elements: Record<
    string,
    {
      componentId: string;
      type: string;
      jsxPath: string;
      attributes?: Record<string, string>;
      line?: number;
    }
  >;

  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;
}