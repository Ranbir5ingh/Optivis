// src/modules/ai-reasoning/services/prompt-builder.service.ts

import { Injectable } from '@nestjs/common';
import { AssembledContext } from './context-assembler.service';

@Injectable()
export class PromptBuilderService {
  buildSystemPrompt(): string {
    return `You are an expert web performance and UX optimization consultant analyzing website behavioral data and source code.

Your role is to:
1. Analyze detected insights (engagement drops, performance regressions, high bounce rates, etc.)
2. Review relevant component source code
3. Identify root causes by connecting behavioral patterns to code implementation
4. Generate specific, actionable recommendations with justified confidence scores

CRITICAL CONTEXT - Insight Detection Methodology:

Baseline Types:
- Historical: Baseline computed from project's aggregated historical data (30-day window standard)
  * Indicates: Sufficient data volume, mature metrics, reliable comparison
  * Treatment: Use as primary signal with high confidence
  
- Heuristic: Fallback baseline when insufficient historical data (low confidence, capped at 50%)
  * Indicates: Low-volume components, new features, or immature metrics
  * Treatment: Treat with extreme caution; data may be unreliable, flag for customer awareness

Confidence Model:

Each insight includes a confidenceMetadata.model that determines reliability:

Statistical Model:
- Derived from p-value, z-score, effect size, and sample size weighting
- These insights have mathematical support and stronger reliability
- Confidence based on: pValue (1 - pValue), zScore magnitude, effectSize, sampleSizeWeight
- Use as primary basis for recommendations (higher priority)

Heuristic Model:
- Derived from rule-based thresholds without statistical validation
- These insights may be correct but lack statistical backing
- Confidence always capped at 0.5 (cannot exceed this threshold)
- Treatment: Directional signals only, not definitive proof
- Flag recommendations based on these insights

Sample Size Gating (CRITICAL):
- Below minimum: Insight not created (data unreliable)
- Low sampleSizeWeight (< 0.5): Data volume is weak, recommendations should be cautious
- High sampleSizeWeight (>= 0.8): Data volume is strong, recommendations are reliable

Detection Lenses (How insights are identified):

Distribution Lens:
- Compares current metric against historical percentile distribution (p25, p50, p75, p90, p99)
- Reflects position in historical distribution shape
- Example: "CTR is 40% below median (p50)" indicates user behavior change relative to baseline
- Interpretation: Position shift, not necessarily trend direction
- Use this to understand absolute performance positioning

Trend Lens:
- Analyzes temporal slope using regression over last 7-30 days
- Does NOT compare against baseline (focuses on velocity)
- Measures: Direction and strength of recent change
- Example: "CTR declining at 5% per day" indicates acceleration regardless of absolute value
- Interpretation: Even acceptable absolute values can have concerning trends
- Use this to detect recent regressions early

Statistical Lens:
- Applies hypothesis testing (z-score, p-value)
- Determines if observed difference is statistically significant (p < 0.05 typically)
- Confidence = 1 - pValue, capped at 0.95
- Example: "CTR difference has p=0.01 (99% significant)"
- Interpretation: Difference is unlikely due to random variation alone

Threshold Lens:
- Rule-based violation of predefined limits
- Often behavioral or funnel logic (e.g., bounce rate > 70%)
- No statistical comparison, deterministic violation detection
- Interpretation: Absolute rule breach, requires action

Confidence Score Interpretation (Global Range: 0.4-0.95):
- 0.4-0.5: Low confidence (weak signal, heuristic baseline, or immature data)
  * Action: Directional signal only, verify before implementing
  * Risk: High false-positive rate, gather more data
  
- 0.5-0.7: Moderate confidence (solid historical data, medium severity)
  * Action: Can implement with moderate precaution
  * Risk: Medium false-positive rate, consider A/B testing
  
- 0.7-0.85: High confidence (strong historical data, high severity, or strong trend)
  * Action: Can implement with confidence
  * Risk: Low false-positive rate, direct implementation acceptable
  
- 0.85-0.95: Very high confidence (statistically significant with large sample)
  * Action: High-priority implementation
  * Risk: Very low false-positive rate, safe to implement widely

Confidence Derivation Rules:
- Recommendation confidence should be AT LEAST as strong as source insight confidence
- If insight confidence is 0.6, recommendation cannot exceed 0.6
- If source insight is heuristic (model='heuristic'), cap recommendation confidence at 0.65
- If sampleSizeWeight < 0.5, reduce confidence by 10-15 percentage points
- Never invent confidence - always trace back to underlying insight data strength

Root Cause Inference:
- Root cause is interpretive, NOT statistical - YOU derive it from:
  * Insight metadata (severity, trend direction, lens type)
  * Code context (implementation patterns, recent changes)
  * Funnel structure (where users drop off)
  * Metric relationships (what changed together)
- Synthesize cause from available behavioral and code signals

Output Format (STRICT JSON):
{
  "recommendations": [
    {
      "id": "rec_<uuid>",
      "insightFlag": "LOW_CTR" | "ENGAGEMENT_DROP" | etc,
      "sourceInsightIds": ["<actual-insight-id-uuid>"],
      "componentId": "wb_c_xxxxx",
      "actionType": "copy_change" | "style_change" | "layout_change" | "logic_change" | "performance_optimization" | "experiment",
      "riskLevel": "low" | "medium" | "high",
      "priority": "high" | "medium" | "low",
      "confidence": 0.0-1.0 (DERIVED from source insight, never invented),
      "title": "Brief title",
      "explanation": "Why this is happening (2-3 sentences) - connect behavior to code",
      "recommendation": "What to do (specific and actionable)",
      "implementationSteps": ["Step 1", "Step 2"],
      "expectedImpact": "Quantified expected improvement",
      "reasoning": "How you arrived at this conclusion (reference confidence, lens type, etc.)",
      "scope": {
        "componentIds": ["wb_c_xxxxx"],
        "files": ["path/to/file.tsx"],
        "estimatedLinesChanged": number
      },
      "successMetric": {
        "metric": "ctr" | "engagement" | "scroll_depth" | "ttfb" | "bounce_rate" | "conversion_rate" | "time_on_page",
        "expectedDelta": number,
        "evaluationWindowDays": number
      },
      "status": "new",
      "requiresMoreContext": boolean,
      "recommendationHash": "hash(sourceInsightIds + componentIds + actionType)"
    }
  ],
  "summary": {
    "totalIssues": number,
    "criticalIssues": number,
    "estimatedImprovementPotential": "X% engagement increase"
  }
}

Guidelines:
- Be specific about code changes, not vague advice
- Reference actual code patterns you see
- Prioritize fixes by impact and effort
- Provide confidence scores based on source insight evidence only
- Focus on actionable insights, not observations
- Avoid hallucination - only reference code you can see
- If code context is insufficient, set requiresMoreContext: true
- For funnel insights, explain impact on conversion funnel
- Account for detection lens: distribution insights differ from trend insights
- Heuristic baseline + low sampleSizeWeight = strong caution flag
- High confidence insights (>0.8) indicate very strong statistical basis`;
  }

  buildUserPrompt(context: AssembledContext): string {
    const insightsSection = this.formatInsights(context.insights);
    const codeSection = this.formatCode(context.codeContext);
    const funnelSection = this.formatFunnels(context.funnelContext);

    return `# Behavioral Insights

${insightsSection}

${funnelSection}

# Component Source Code

${codeSection}

# Task

Analyze these insights and code to generate specific, actionable recommendations. Focus on:
1. Root cause identification (connect behavior to code)
2. Prioritized action items with proper actionType and riskLevel
3. Expected impact quantification with success metrics
4. Implementation guidance with accurate scope
5. Only reference code that is provided - flag when additional context needed
6. For funnel-related insights, explain impact on conversion and suggest optimization
7. Account for insight confidence level when prioritizing (high confidence = stronger basis)
8. Identify insights based on heuristic baselines and flag for customer awareness

Insight Analysis Context:
- Total insights: ${context.metadata.totalInsights}
- Critical (high severity): ${context.metadata.criticalInsights}
- Components analyzed: ${context.metadata.componentsAnalyzed}
- Funnels analyzed: ${context.metadata.funnelsAnalyzed}

IMPORTANT: When identifying improvements, consider:
- Is the baseline historical (data-backed) or heuristic (fallback)?
- How strong is the confidence score? (affects recommendation weight)
- What detection lens was used? (distribution vs trend vs statistical)
- Are there sample-size constraints limiting insight reliability?`;
  }

  private formatInsights(insights: AssembledContext['insights']): string {
    if (insights.length === 0) {
      return 'No insights available.';
    }

    return insights
      .map((insight, idx) => {
        const lines = [
          `## Insight ${idx + 1}: ${insight.flag} [${insight.severity.toUpperCase()}]`,
          `- ID: ${insight.id}`,
          `- Component: ${insight.componentId || 'N/A'}`,
          `- Element: ${insight.elementId || 'N/A'}`,
          `- Reason: ${insight.reason}`,
        ];

        if (insight.value !== undefined) {
          lines.push(`- Current Value: ${insight.value}`);
        }
        if (insight.baseline !== undefined) {
          lines.push(`- Baseline: ${insight.baseline}`);
        }

        if (insight.baselineType !== undefined) {
          const baselineTypeLabel =
            insight.baselineType === 'heuristic'
              ? 'Heuristic (⚠️ LOW CONFIDENCE - Insufficient Data)'
              : 'Historical (Data-Backed)';
          lines.push(`- Baseline Type: ${baselineTypeLabel}`);
        }

        if (insight.baselineWindowDays !== undefined) {
          lines.push(`- Baseline Window: ${insight.baselineWindowDays} days`);
        }

        if (insight.percentageChange !== undefined) {
          lines.push(`- Change: ${insight.percentageChange.toFixed(1)}%`);
        }

        if (insight.confidence !== undefined) {
          const confidenceLabel = this.getConfidenceLabel(insight.confidence);
          lines.push(
            `- Confidence: ${(insight.confidence * 100).toFixed(0)}% [${confidenceLabel}]`,
          );
        }

        if (insight.confidenceMetadata) {
          const modelLabel =
            insight.confidenceMetadata.model === 'statistical'
              ? 'Statistical (Math-Based)'
              : 'Heuristic (Rule-Based)';
          lines.push(`- Confidence Model: ${modelLabel}`);

          if (insight.confidenceMetadata.sampleSizeWeight !== undefined) {
            const sampleWeightLabel =
              insight.confidenceMetadata.sampleSizeWeight >= 0.8
                ? 'Strong'
                : insight.confidenceMetadata.sampleSizeWeight >= 0.5
                  ? 'Moderate'
                  : 'Weak';
            lines.push(
              `- Sample Size Weight: ${(insight.confidenceMetadata.sampleSizeWeight * 100).toFixed(0)}% [${sampleWeightLabel}]`,
            );
          }

          if (insight.confidenceMetadata.pValue !== undefined) {
            lines.push(
              `- P-Value: ${insight.confidenceMetadata.pValue.toFixed(4)}`,
            );
          }

          if (insight.confidenceMetadata.zScore !== undefined) {
            lines.push(
              `- Z-Score: ${insight.confidenceMetadata.zScore.toFixed(2)}`,
            );
          }

          if (insight.confidenceMetadata.effectSize !== undefined) {
            lines.push(
              `- Effect Size: ${insight.confidenceMetadata.effectSize.toFixed(2)}`,
            );
          }
        }

        if (insight.zScore !== undefined) {
          lines.push(`- Z-Score: ${insight.zScore.toFixed(2)}`);
        }

        if (insight.pValue !== undefined) {
          lines.push(`- P-Value: ${insight.pValue.toFixed(4)}`);
        }

        if (insight.comparison) {
          lines.push(
            `- Detection Lens: ${insight.comparison.lens} (${insight.comparison.mode} baseline)`,
          );
          if (insight.comparison.baselinePercentile) {
            lines.push(
              `- Comparison Threshold: p${insight.comparison.baselinePercentile}`,
            );
          }
          lines.push(`- Direction: ${insight.comparison.direction}`);

          if (insight.comparison.baselineFallbackReason) {
            lines.push(
              `- Baseline Note: ${insight.comparison.baselineFallbackReason}`,
            );
          }
        }

        if (insight.context) {
          lines.push(`- Context Type: ${insight.context.type}`);
          if (insight.context.funnelId) {
            lines.push(`- Funnel ID: ${insight.context.funnelId}`);
            lines.push(`- Funnel Step: ${insight.context.funnelStep}`);
          }
          if (insight.context.path) {
            lines.push(`- Page Path: ${insight.context.path}`);
          }
        }

        return lines.join('\n');
      })
      .join('\n\n');
  }

  private formatCode(codeContext: AssembledContext['codeContext']): string {
    if (codeContext.length === 0) {
      return 'No code context available. GitHub repository may not be connected.';
    }

    return codeContext
      .map((component) => {
        return `## Component: ${component.name} (${component.componentId})
File: ${component.filepath}
Language: ${component.language}

\`\`\`${component.language}
${this.trimCode(component.code)}
\`\`\``;
      })
      .join('\n\n');
  }

  private formatFunnels(
    funnelContext: AssembledContext['funnelContext'],
  ): string {
    if (funnelContext.length === 0) {
      return '';
    }

    const section = funnelContext
      .map((funnel) => {
        const stepsStr = funnel.steps
          .map((s) => `${s.index}. ${s.name}`)
          .join(' → ');
        return `## Funnel: ${funnel.funnelName}
Steps: ${stepsStr}
Associated Insights: ${funnel.associatedInsights.join(', ')}`;
      })
      .join('\n\n');

    return `# Funnel Context\n\n${section}`;
  }

  private trimCode(code: string): string {
    const maxLines = 100;
    const lines = code.split('\n');

    if (lines.length <= maxLines) {
      return code;
    }

    return lines.slice(0, maxLines).join('\n') + '\n\n[... code truncated ...]';
  }

  private getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.85) return 'Very High';
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.5) return 'Moderate';
    return 'Low';
  }
}
