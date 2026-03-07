export interface VisitorSession {
  visitorId: string;
  sessionId: string;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date;
  isActive: boolean;
}

export interface VisitorContext {
  visitorId: string;
  visitorCohort: 'new_users' | 'returning_users' | 'power_users';
  totalSessions: number;
}