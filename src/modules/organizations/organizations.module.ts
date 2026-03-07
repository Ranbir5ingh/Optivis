import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsRepository } from './organizations.repository';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { OrganizationPolicy } from './policies/organization.policy';
import { OrganizationMembersRepository } from './members/organization-members.repository';

@Module({
  imports: [DrizzleModule],
  providers: [
    OrganizationsService,
    OrganizationsRepository,
    OrganizationMembersRepository,
    OrganizationPolicy,
  ],
  controllers: [OrganizationsController],
  exports: [OrganizationsService, OrganizationPolicy],
})
export class OrganizationsModule {}
