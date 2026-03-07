// src/modules/tracking/domain/tracking-event.model.ts

import { TrackingEventType } from './tracking-event-type.enum';

export interface TrackingEvent {
  projectId: string;
  visitorId: string;
  sessionId: string;

  type: TrackingEventType;
  path?: string;
  componentId?: string;
  elementId?: string;

  metadata?: EventMetadata;

  occurredAt: Date;
  receivedAt: Date;
}

export type EventMetadata =
  | PageViewMetadata
  | PageExitMetadata
  | ClickMetadata
  | ScrollMetadata
  | VisibilityMetadata
  | PerformanceMetadata
  | SessionEndMetadata
  | RageClickMetadata
  | ExitIntentMetadata
  | FormStartMetadata
  | FormAbandonMetadata
  | FormSubmitMetadata
  | FormErrorMetadata
  | CustomMetadata;

export interface PageViewMetadata {
  title?: string;
  referrer?: string;
  userAgent?: string;
}

export interface PageExitMetadata {
  timeOnPageMs: number;
  bounced?: boolean;
  userAgent?: string;
}

export interface ClickMetadata {
  x: number;
  y: number;
  elementType?: string;
  text?: string;
  userAgent?: string;
}

export interface ScrollMetadata {
  depth: number;
  timeToReachMs?: number;
  userAgent?: string;
}

export interface VisibilityMetadata {
  visibleTimeMs: number;
  scrollDepth?: number;
  elementRect?: {
    top: number;
    height: number;
  };
  userAgent?: string;
}

export interface PerformanceMetadata {
  lcp?: number;
  cls?: number;
  inp?: number;
  ttfb?: number;
  userAgent?: string;
}

export interface SessionEndMetadata {
  visitorId: string;
  sessionId: string;
  durationMs: number;
  pageCount: number;
  totalClicks: number;
  scrolled: boolean;
  maxScrollDepth: number;
  bounced: boolean;
  userAgent?: string;
}

export interface RageClickMetadata {
  clickCount: number;
  timeWindowMs: number;
  elementType: string;
  text?: string;
  userAgent?: string;
}

export interface ExitIntentMetadata {
  timeOnPageMs: number;
  scrollDepth: number;
  mouseY: number;
  timestamp: number;
  userAgent?: string;
}

export interface FormStartMetadata {
  fieldCount: number;
  formAction?: string;
  userAgent?: string;
}

export interface FormAbandonMetadata {
  timeSpentMs: number;
  fieldsInteracted: number;
  userAgent?: string;
}

export interface FormSubmitMetadata {
  timeToSubmitMs: number;
  fieldsInteracted: number;
  fieldCount: number;
  userAgent?: string;
}

export interface FormErrorMetadata {
  fieldName: string;
  fieldType: string;
  validationMessage: string;
  userAgent?: string;
}

export interface CustomMetadata {
  [key: string]: unknown;
  userAgent?: string;
}