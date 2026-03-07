// src/modules/insights/services/insight-identity.service.ts

import { Injectable } from '@nestjs/common';
import { InsightFlag } from '../domain/insight-flag.enum';
import { DetectedInsight } from '../domain/detected-insight.model';

@Injectable()
export class InsightIdentityService {
  createKey(
    flag: InsightFlag | string,
    componentId?: string | null,
    elementId?: string | null,
  ): string {
    const comp = componentId || 'null';
    const elem = elementId || 'null';
    return `${flag}:${comp}:${elem}`;
  }

  createKeyFromInsight(insight: DetectedInsight): string {
    return this.createKey(
      insight.flag,
      insight.componentId,
      insight.elementId,
    );
  }

  parseKey(key: string): {
    flag: string;
    componentId: string | null;
    elementId: string | null;
  } {
    const [flag, comp, elem] = key.split(':');
    return {
      flag,
      componentId: comp === 'null' ? null : comp,
      elementId: elem === 'null' ? null : elem,
    };
  }
}