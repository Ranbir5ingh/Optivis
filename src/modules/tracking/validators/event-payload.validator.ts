// src/modules/tracking/validators/event-payload.validator.ts

import { BadRequestException } from '@nestjs/common';
import { IngestTrackingEventDto } from '../dto/ingest-event.dto';
import { TrackingEventType } from '../domain/tracking-event-type.enum';

export class EventPayloadValidator {
  static validate(event: IngestTrackingEventDto): void {
    switch (event.type) {
      case TrackingEventType.PAGE_VIEW:
        this.validatePageView(event);
        break;
      case TrackingEventType.PAGE_EXIT:
        this.validatePageExit(event);
        break;
      case TrackingEventType.CLICK:
        this.validateClick(event);
        break;
      case TrackingEventType.SCROLL_DEPTH:
        this.validateScrollDepth(event);
        break;
      case TrackingEventType.VISIBILITY:
        this.validateVisibility(event);
        break;
      case TrackingEventType.PERFORMANCE:
        this.validatePerformance(event);
        break;
      case TrackingEventType.SESSION_END:
        this.validateSessionEnd(event);
        break;
      case TrackingEventType.RAGE_CLICK:
        this.validateRageClick(event);
        break;
      case TrackingEventType.EXIT_INTENT:
        this.validateExitIntent(event);
        break;
      case TrackingEventType.FORM_START:
        this.validateFormStart(event);
        break;
      case TrackingEventType.FORM_ABANDON:
        this.validateFormAbandon(event);
        break;
      case TrackingEventType.FORM_SUBMIT:
        this.validateFormSubmit(event);
        break;
      case TrackingEventType.FORM_ERROR:
        this.validateFormError(event);
        break;
      case TrackingEventType.CUSTOM:
        break;
    }
  }

  private static validatePageView(event: IngestTrackingEventDto): void {
    if (!event.path) {
      throw new BadRequestException(
        'page_view event must include path in metadata or top-level',
      );
    }
  }

  private static validatePageExit(event: IngestTrackingEventDto): void {
    if (!event.path) {
      throw new BadRequestException(
        'page_exit event must include path',
      );
    }

    if (event.metadata?.timeOnPageMs === undefined || typeof event.metadata.timeOnPageMs !== 'number') {
      throw new BadRequestException(
        'page_exit must include timeOnPageMs (number) in metadata',
      );
    }

    if (event.metadata.timeOnPageMs < 0) {
      throw new BadRequestException('timeOnPageMs must be non-negative');
    }

    if (event.metadata?.bounced !== undefined && typeof event.metadata.bounced !== 'boolean') {
      throw new BadRequestException('bounced must be boolean if provided');
    }
  }

  private static validateClick(event: IngestTrackingEventDto): void {
    if (!event.metadata?.x || event.metadata?.x === undefined) {
      throw new BadRequestException(
        'click event must include x coordinate in metadata',
      );
    }

    if (!event.metadata?.y && event.metadata?.y !== 0) {
      throw new BadRequestException(
        'click event must include y coordinate in metadata',
      );
    }

    const x = event.metadata.x;
    const y = event.metadata.y;

    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new BadRequestException('click coordinates must be numbers');
    }

    if (!Number.isInteger(x) || x < 0 || x > 10000) {
      throw new BadRequestException('click x must be integer between 0-10000');
    }

    if (!Number.isInteger(y) || y < 0 || y > 10000) {
      throw new BadRequestException('click y must be integer between 0-10000');
    }
  }

  private static validateScrollDepth(event: IngestTrackingEventDto): void {
    if (event.metadata?.depth === undefined) {
      throw new BadRequestException(
        'scroll_depth event must include depth (0-100) in metadata',
      );
    }

    const depth = event.metadata.depth as number;
    if (typeof depth !== 'number' || depth < 0 || depth > 100) {
      throw new BadRequestException(
        'scroll_depth must be a number between 0 and 100',
      );
    }
  }

  private static validateVisibility(event: IngestTrackingEventDto): void {
    if (event.metadata?.visibleTimeMs === undefined) {
      throw new BadRequestException(
        'visibility event must include visibleTimeMs (number) in metadata',
      );
    }

    if (typeof event.metadata.visibleTimeMs !== 'number') {
      throw new BadRequestException('visibleTimeMs must be a number');
    }

    if (event.metadata.visibleTimeMs < 0) {
      throw new BadRequestException('visibleTimeMs must be non-negative');
    }
  }

  private static validatePerformance(event: IngestTrackingEventDto): void {
    const metrics = event.metadata;
    if (
      !metrics ||
      (metrics.lcp === undefined &&
        metrics.cls === undefined &&
        metrics.inp === undefined &&
        metrics.ttfb === undefined)
    ) {
      throw new BadRequestException(
        'performance event must include at least one metric (lcp, cls, inp, ttfb)',
      );
    }

    if (metrics.lcp !== undefined && (typeof metrics.lcp !== 'number' || metrics.lcp < 0)) {
      throw new BadRequestException('lcp must be a non-negative number');
    }
    if (metrics.cls !== undefined && (typeof metrics.cls !== 'number' || metrics.cls < 0)) {
      throw new BadRequestException('cls must be a non-negative number');
    }
    if (metrics.inp !== undefined && (typeof metrics.inp !== 'number' || metrics.inp < 0)) {
      throw new BadRequestException('inp must be a non-negative number');
    }
    if (metrics.ttfb !== undefined && (typeof metrics.ttfb !== 'number' || metrics.ttfb < 0)) {
      throw new BadRequestException('ttfb must be a non-negative number');
    }
  }

  private static validateSessionEnd(event: IngestTrackingEventDto): void {
    const metadata = event.metadata;

    if (!metadata?.sessionId || typeof metadata.sessionId !== 'string') {
      throw new BadRequestException(
        'session_end event must include sessionId (string) in metadata',
      );
    }

    if (metadata.durationMs === undefined || typeof metadata.durationMs !== 'number') {
      throw new BadRequestException(
        'session_end must include durationMs (number)',
      );
    }

    if (metadata.pageCount === undefined || typeof metadata.pageCount !== 'number') {
      throw new BadRequestException(
        'session_end must include pageCount (number)',
      );
    }

    if (metadata.totalClicks === undefined || typeof metadata.totalClicks !== 'number') {
      throw new BadRequestException(
        'session_end must include totalClicks (number)',
      );
    }

    if (metadata.scrolled === undefined || typeof metadata.scrolled !== 'boolean') {
      throw new BadRequestException(
        'session_end must include scrolled (boolean)',
      );
    }

    if (metadata.maxScrollDepth === undefined || typeof metadata.maxScrollDepth !== 'number') {
      throw new BadRequestException(
        'session_end must include maxScrollDepth (number)',
      );
    }

    if (metadata.bounced === undefined || typeof metadata.bounced !== 'boolean') {
      throw new BadRequestException(
        'session_end must include bounced (boolean)',
      );
    }
  }

  private static validateRageClick(event: IngestTrackingEventDto): void {
    if (!event.elementId) {
      throw new BadRequestException(
        'rage_click event must include elementId',
      );
    }

    if (!event.componentId) {
      throw new BadRequestException(
        'rage_click event must include componentId',
      );
    }

    const metadata = event.metadata;

    if (metadata?.clickCount === undefined || typeof metadata.clickCount !== 'number') {
      throw new BadRequestException(
        'rage_click must include clickCount (number >= 3) in metadata',
      );
    }

    if (metadata.clickCount < 3) {
      throw new BadRequestException(
        'rage_click clickCount must be at least 3',
      );
    }

    if (metadata.timeWindowMs === undefined || typeof metadata.timeWindowMs !== 'number') {
      throw new BadRequestException(
        'rage_click must include timeWindowMs (number) in metadata',
      );
    }

    if (metadata.timeWindowMs < 0) {
      throw new BadRequestException('timeWindowMs must be non-negative');
    }
  }

  private static validateExitIntent(event: IngestTrackingEventDto): void {
    if (!event.path) {
      throw new BadRequestException(
        'exit_intent event must include path',
      );
    }

    const metadata = event.metadata;

    if (metadata?.timeOnPageMs === undefined || typeof metadata.timeOnPageMs !== 'number') {
      throw new BadRequestException(
        'exit_intent must include timeOnPageMs (number) in metadata',
      );
    }

    if (metadata.timeOnPageMs < 0) {
      throw new BadRequestException('timeOnPageMs must be non-negative');
    }

    if (metadata.scrollDepth === undefined || typeof metadata.scrollDepth !== 'number') {
      throw new BadRequestException(
        'exit_intent must include scrollDepth (0-100 number) in metadata',
      );
    }

    if (metadata.scrollDepth < 0 || metadata.scrollDepth > 100) {
      throw new BadRequestException(
        'scrollDepth must be between 0 and 100',
      );
    }

    if (metadata.mouseY === undefined || typeof metadata.mouseY !== 'number') {
      throw new BadRequestException(
        'exit_intent must include mouseY (number) in metadata',
      );
    }
  }

  private static validateFormStart(event: IngestTrackingEventDto): void {
    if (!event.elementId) {
      throw new BadRequestException(
        'form_start event must include elementId',
      );
    }

    const metadata = event.metadata;

    if (metadata?.fieldCount === undefined || typeof metadata.fieldCount !== 'number') {
      throw new BadRequestException(
        'form_start must include fieldCount (number) in metadata',
      );
    }

    if (metadata.fieldCount < 1) {
      throw new BadRequestException('fieldCount must be at least 1');
    }
  }

  private static validateFormAbandon(event: IngestTrackingEventDto): void {
    if (!event.elementId) {
      throw new BadRequestException(
        'form_abandon event must include elementId',
      );
    }

    const metadata = event.metadata;

    if (metadata?.timeSpentMs === undefined || typeof metadata.timeSpentMs !== 'number') {
      throw new BadRequestException(
        'form_abandon must include timeSpentMs (number) in metadata',
      );
    }

    if (metadata.timeSpentMs < 0) {
      throw new BadRequestException('timeSpentMs must be non-negative');
    }

    if (metadata.fieldsInteracted === undefined || typeof metadata.fieldsInteracted !== 'number') {
      throw new BadRequestException(
        'form_abandon must include fieldsInteracted (number) in metadata',
      );
    }

    if (metadata.fieldsInteracted < 0) {
      throw new BadRequestException('fieldsInteracted must be non-negative');
    }
  }

  private static validateFormSubmit(event: IngestTrackingEventDto): void {
    if (!event.elementId) {
      throw new BadRequestException(
        'form_submit event must include elementId',
      );
    }

    const metadata = event.metadata;

    if (metadata?.timeToSubmitMs === undefined || typeof metadata.timeToSubmitMs !== 'number') {
      throw new BadRequestException(
        'form_submit must include timeToSubmitMs (number) in metadata',
      );
    }

    if (metadata.timeToSubmitMs < 0) {
      throw new BadRequestException('timeToSubmitMs must be non-negative');
    }

    if (metadata.fieldsInteracted === undefined || typeof metadata.fieldsInteracted !== 'number') {
      throw new BadRequestException(
        'form_submit must include fieldsInteracted (number) in metadata',
      );
    }

    if (metadata.fieldsInteracted < 0) {
      throw new BadRequestException('fieldsInteracted must be non-negative');
    }

    if (metadata.fieldCount === undefined || typeof metadata.fieldCount !== 'number') {
      throw new BadRequestException(
        'form_submit must include fieldCount (number) in metadata',
      );
    }

    if (metadata.fieldCount < 1) {
      throw new BadRequestException('fieldCount must be at least 1');
    }
  }

  private static validateFormError(event: IngestTrackingEventDto): void {
    if (!event.elementId) {
      throw new BadRequestException(
        'form_error event must include elementId',
      );
    }

    const metadata = event.metadata;

    if (!metadata?.fieldName || typeof metadata.fieldName !== 'string') {
      throw new BadRequestException(
        'form_error must include fieldName (string) in metadata',
      );
    }

    if (!metadata?.fieldType || typeof metadata.fieldType !== 'string') {
      throw new BadRequestException(
        'form_error must include fieldType (string) in metadata',
      );
    }

    if (!metadata?.validationMessage || typeof metadata.validationMessage !== 'string') {
      throw new BadRequestException(
        'form_error must include validationMessage (string) in metadata',
      );
    }
  }
}