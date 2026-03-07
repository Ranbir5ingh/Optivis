import { Type } from 'class-transformer';
import { ValidateNested, ArrayMinSize } from 'class-validator';
import { IngestTrackingEventDto } from './ingest-event.dto';

export class IngestTrackingBatchDto {
  @ValidateNested({ each: true })
  @Type(() => IngestTrackingEventDto)
  @ArrayMinSize(1)
  events: IngestTrackingEventDto[];
}
