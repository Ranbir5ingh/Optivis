// src/modules/insights/domain/insight-status.enum.ts

export enum InsightStatus {
  NEW = 'new',
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  ACTED_UPON = 'acted_upon',
  RESOLVED = 'resolved',
  REGRESSED = 'regressed',
}