// src/modules/ai-reasoning/ai-reasoning.module.ts

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AIReasoningController } from './ai-reasoning.controller';
import { AIReasoningService } from './services/ai-reasoning.service';
import { ContextAssemblerService } from './services/context-assembler.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { RecommendationGeneratorService } from './services/recommendation-generator.service';
import { AIReasoningRepository } from './repositories/ai-reasoning.repository';

import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { AI_PROVIDER } from './providers/ai-provider.tokens';

import { InsightsModule } from '../insights/insights.module';
import { CodeIntelligenceModule } from '../code-intelligence/code-intelligence.module';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { FunnelsModule } from '../funnels/funnels.module';
import { AIReasoningWorker } from './workers/ai-reasoning.worker';
import { AIReasoningProjectListener } from './listeners/ai-reasoning-project.listener';
import { AIReasoningJobsRepository } from './repositories/ai-reasoning-jobs.repository';
import { AIReasoningCursorRepository } from './repositories/ai-reasoning-cursor.repository';
import { AIReasoningSnapshotService } from './services/ai-reasoning-snapshot.service';
import { AIReasoningCursorInitializationService } from './services/ai-reasoning-cursor-initialization.service';
import { InsightsUpdatedListener } from './listeners/insights-updated.listener';

@Module({
  imports: [
    DrizzleModule,
    InsightsModule,
    CodeIntelligenceModule,
    ProjectsModule,
    OrganizationsModule,
    FunnelsModule,
  ],
  controllers: [AIReasoningController],
  providers: [
    AIReasoningService,
    ContextAssemblerService,
    PromptBuilderService,
    RecommendationGeneratorService,
    AIReasoningRepository,
    AIReasoningJobsRepository,
    AIReasoningCursorRepository,
    AIReasoningSnapshotService,
    AIReasoningCursorInitializationService,
    GeminiProvider,
    ClaudeProvider,
    AIReasoningWorker,
    AIReasoningProjectListener,
    InsightsUpdatedListener,
    {
      provide: AI_PROVIDER,
      useFactory: (
        config: ConfigService,
        gemini: GeminiProvider,
        claude: ClaudeProvider,
      ) => {
        const provider = config.get<string>('AI_PROVIDER') || 'gemini';

        if (provider === 'claude') {
          return claude;
        }

        return gemini;
      },
      inject: [ConfigService, GeminiProvider, ClaudeProvider],
    },
  ],
  exports: [AIReasoningService, AIReasoningRepository, AI_PROVIDER],
})
export class AiReasoningModule {}
