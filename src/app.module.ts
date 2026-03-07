import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './database/drizzle/drizzle.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { jwtConfig } from './config/jwt.config';
import { googleConfig } from './config/google.config';
import { githubConfig } from './config/github.config';
import { corsConfig } from './config/cors.config';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CodeIntelligenceModule } from './modules/code-intelligence/code-intelligence.module';
import { ProjectKeysModule } from './modules/project-keys/project-keys.module';
import { githubAppConfig } from './config/github-app.config';
import { AggregationModule } from './modules/aggregation/aggregation.module';
import { FunnelsModule } from './modules/funnels/funnels.module';
import { InsightsModule } from './modules/insights/insights.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AiReasoningModule } from './modules/ai-reasoning/ai-reasoning.module';
import { ProjectSummaryModule } from './modules/project-summary/project-summary.module';
import { EvolutionModule } from './modules/evolution/evolution.module';

@Module({
  imports: [
    DrizzleModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, googleConfig, githubConfig, corsConfig, githubAppConfig],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    UsersModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    ProjectKeysModule,
    TrackingModule,
    AggregationModule,
    InsightsModule,
    FunnelsModule,
    CodeIntelligenceModule,
    AiReasoningModule,
    ProjectSummaryModule,
    EvolutionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}