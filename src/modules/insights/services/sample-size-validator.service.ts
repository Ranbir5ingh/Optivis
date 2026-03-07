// src/modules/insights/services/sample-size-validator.service.ts

import { Injectable } from '@nestjs/common';
import { SAMPLE_SIZE_GATES } from '../config/sample-size-gates.config';

export type SampleValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

@Injectable()
export class SampleSizeValidatorService {
  validateBehavioralRageClick(
    eventCount: number,
    sessionCount: number,
  ): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.behavioral.rage_click;

    if (eventCount < gate.minEvents) {
      return {
        valid: false,
        reason: `Insufficient rage click events (${eventCount} < ${gate.minEvents})`,
      };
    }

    if (sessionCount < gate.minSessions) {
      return {
        valid: false,
        reason: `Insufficient rage click sessions (${sessionCount} < ${gate.minSessions})`,
      };
    }

    return { valid: true };
  }

  validateExitIntent(
    eventCount: number,
    sessionCount: number,
  ): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.behavioral.exit_intent;

    if (eventCount < gate.minEvents) {
      return {
        valid: false,
        reason: `Insufficient exit intent events (${eventCount} < ${gate.minEvents})`,
      };
    }

    if (sessionCount < gate.minSessions) {
      return {
        valid: false,
        reason: `Insufficient exit intent sessions (${sessionCount} < ${gate.minSessions})`,
      };
    }

    return { valid: true };
  }

  validateFunnelStep(enteredCount: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.funnel.step;

    if (enteredCount < gate.minEntered) {
      return {
        valid: false,
        reason: `Insufficient funnel step entries (${enteredCount} < ${gate.minEntered})`,
      };
    }

    return { valid: true };
  }

  validateCohort(sessions: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.cohort.perCohort;

    if (sessions < gate.minSessions) {
      return {
        valid: false,
        reason: `Insufficient cohort sessions (${sessions} < ${gate.minSessions})`,
      };
    }

    return { valid: true };
  }

  validateEngagement(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.engagement;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient engagement samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validateTimeVisible(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.time_visible;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient time-visible samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validateCtr(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.ctr;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient CTR samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validatePerformanceMetric(
    metric: 'lcp' | 'inp' | 'cls' | 'ttfb',
    sampleSize: number,
  ): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.performance[metric];

    if (sampleSize < gate) {
      return {
        valid: false,
        reason: `Insufficient ${metric.toUpperCase()} samples (${sampleSize} < ${gate})`,
      };
    }

    return { valid: true };
  }

  validateForm(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.form;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient form samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validateDropOffRate(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.drop_off_rate;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient drop-off rate samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validateFormAbandonRate(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.form_abandon_rate;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient form abandon rate samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validateFormCompletionRate(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.form_completion_rate;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient form completion rate samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validateFormErrorRate(sampleSize: number): SampleValidationResult {
    const gate = SAMPLE_SIZE_GATES.form_error_rate;

    if (sampleSize < gate.minSamples) {
      return {
        valid: false,
        reason: `Insufficient form error rate samples (${sampleSize} < ${gate.minSamples})`,
      };
    }

    return { valid: true };
  }

  validateMetricSample(
    metric:
      | 'ctr'
      | 'engagement'
      | 'time_visible'
      | 'form'
      | 'lcp'
      | 'cls'
      | 'inp'
      | 'ttfb'
      | 'drop_off_rate'
      | 'form_abandon_rate'
      | 'form_completion_rate'
      | 'form_error_rate',
    sampleSize: number,
  ): SampleValidationResult {
    switch (metric) {
      case 'ctr':
        return this.validateCtr(sampleSize);
      case 'engagement':
        return this.validateEngagement(sampleSize);
      case 'time_visible':
        return this.validateTimeVisible(sampleSize);
      case 'lcp':
      case 'cls':
      case 'inp':
      case 'ttfb':
        return this.validatePerformanceMetric(metric, sampleSize);
      case 'form':
        return this.validateForm(sampleSize);
      case 'drop_off_rate':
        return this.validateDropOffRate(sampleSize);
      case 'form_abandon_rate':
        return this.validateFormAbandonRate(sampleSize);
      case 'form_completion_rate':
        return this.validateFormCompletionRate(sampleSize);
      case 'form_error_rate':
        return this.validateFormErrorRate(sampleSize);
      default:
        return { valid: false, reason: `Unknown metric ${metric}` };
    }
  }
}
