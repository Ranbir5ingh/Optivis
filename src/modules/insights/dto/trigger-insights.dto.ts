import { IsString } from 'class-validator';

export class TriggerInsightsDto {
  @IsString()
  projectId: string;
}
