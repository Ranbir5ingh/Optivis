// src/modules/projects/dto/setup-status.dto.ts

import { IsBoolean } from 'class-validator';

export class SetupStatusDto {
  @IsBoolean()
  hasSdkEvents: boolean;

  @IsBoolean()
  hasGithubRepo: boolean;

  @IsBoolean()
  hasCodeManifest: boolean;

  @IsBoolean()
  hasMinimumSessions: boolean;

  @IsBoolean()
  setupCompleted: boolean;
}
