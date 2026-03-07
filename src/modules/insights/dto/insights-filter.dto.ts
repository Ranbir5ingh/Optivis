import { Type } from "class-transformer";
import { IsDateString } from "class-validator";

export class InsightsFilterDto {
  @IsDateString()
  @Type(() => String)
  startDate: string;

  @IsDateString()
  @Type(() => String)
  endDate: string;
}