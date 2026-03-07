// src/modules/tracking/dto/ingest-event.dto.ts

import {
  IsEnum,
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
  IsInt,
} from 'class-validator';
import { TrackingEventType } from '../domain/tracking-event-type.enum';

export class IngestTrackingEventDto {
  @IsEnum(TrackingEventType)
  type: TrackingEventType;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsString()
  elementId?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    title?: string;
    referrer?: string;

    x?: number;
    y?: number;
    elementType?: string;
    text?: string;

    depth?: number;
    timeToReachMs?: number;

    visibleTimeMs?: number;
    scrollDepth?: number;
    elementRect?: {
      top: number;
      height: number;
    };

    cls?: number;
    lcp?: number;
    inp?: number;
    ttfb?: number;

    visitorId?: string;
    sessionId?: string;
    durationMs?: number;
    pageCount?: number;
    totalClicks?: number;
    scrolled?: boolean;
    maxScrollDepth?: number;
    bounced?: boolean;

    timeOnPageMs?: number;

    clickCount?: number;
    timeWindowMs?: number;

    mouseY?: number;
    timestamp?: number;

    fieldCount?: number;
    formAction?: string;
    fieldsInteracted?: number;
    timeSpentMs?: number;
    timeToSubmitMs?: number;
    fieldName?: string;
    fieldType?: string;
    validationMessage?: string;

    [key: string]: unknown;
  };

  @IsNumber()
  @IsInt()
  timestamp: number;
}