// src/modules/evolution/services/recommendation-state-machine.service.ts

import { Injectable } from '@nestjs/common';
import { DomainError } from 'src/common/exceptions/domain-error';
import {
  RecommendationInstanceStatus,
} from '../domain/recommendation-instance.types';

@Injectable()
export class RecommendationStateMachineService {
  private readonly validTransitions: Record<
    RecommendationInstanceStatus,
    RecommendationInstanceStatus[]
  > = {
    new: ['accepted', 'rejected', 'expired'],
    accepted: ['patch_generated', 'rejected', 'expired'],
    patch_generated: ['pr_created', 'rejected', 'expired'],
    pr_created: ['merged', 'rejected', 'expired'],
    merged: ['evaluating', 'rejected', 'expired'],
    evaluating: ['validated', 'invalidated', 'expired'],
    validated: ['expired'],
    invalidated: ['expired'],
    rejected: [],
    expired: [],
  };

  isValidTransition(
    from: RecommendationInstanceStatus,
    to: RecommendationInstanceStatus,
  ): boolean {
    return this.validTransitions[from].includes(to);
  }

  assertValidTransition(
    from: RecommendationInstanceStatus,
    to: RecommendationInstanceStatus,
  ): void {
    if (!this.isValidTransition(from, to)) {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Cannot transition from ${from} to ${to}`,
        'conflict',
        { from, to, validTransitions: this.validTransitions[from] },
      );
    }
  }
}