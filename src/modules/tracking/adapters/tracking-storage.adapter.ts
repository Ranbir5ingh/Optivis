import { TrackingEvent } from '../domain/tracking-event.model';

export interface TrackingStorageAdapter {
  writeBatch(events: TrackingEvent[]): Promise<void>;
}
