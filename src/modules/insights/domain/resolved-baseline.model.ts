// src/modules/insights/domain/resolved-baseline.model.ts

import { BaselineEnvelope } from './baseline-envelope.model';
import { SampleValidationResult } from '../services/sample-size-validator.service';

export interface ResolvedBaseline {
  baseline: BaselineEnvelope;
  sampleValidation: SampleValidationResult;
  reason?: string;
}