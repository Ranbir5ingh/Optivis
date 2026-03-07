// src/modules/evolution/dto/accept-recommendation.dto.ts

import { IsUUID } from 'class-validator';

export class AcceptRecommendationDto {
  @IsUUID()
  instanceId: string;
}