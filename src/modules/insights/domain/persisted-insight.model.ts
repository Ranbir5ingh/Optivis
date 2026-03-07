import { DetectedInsight } from "./detected-insight.model";
import { InsightStatus } from "./insight-status.enum";

// persisted-insight.model.ts
export interface PersistedInsight extends DetectedInsight {
  id: string;
  status: InsightStatus;
  firstDetectedAt: Date;
  lastSeenAt: Date;
}
