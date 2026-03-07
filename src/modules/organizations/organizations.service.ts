import { Inject, Injectable } from '@nestjs/common';
import { OrganizationModel } from './domain/organization.model';
import { OrganizationRow } from 'src/database/drizzle/schema';
import { OrganizationsRepository } from './organizations.repository';
import { DomainError } from 'src/common/exceptions/domain-error';
import { PaginatedResult } from 'src/shared/types/pagination';
import { listOrganizationsDto } from './dto/list.organizations.dto';
import { OrganizationMembersRepository } from './members/organization-members.repository';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { OrganizationRole } from './domain/organization-role.enum';
import { OrganizationViewDto } from './dto/organization-view.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgRepo: OrganizationsRepository,
    private readonly memberRepo: OrganizationMembersRepository,
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
  ) {}

  private toModel(row: OrganizationRow): OrganizationModel {
    return {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toView(
    org: OrganizationRow,
    role: OrganizationRole,
  ): OrganizationViewDto {
    return {
      id: org.id,
      name: org.name,
      role,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  /**
   * CREATE
   * - transaction
   * - creator becomes OWNER member
   */
  async create(ownerId: string, name: string): Promise<OrganizationModel> {
    return this.db.transaction(async (tx) => {
      const org = await this.orgRepo.create({ name, ownerId }, tx);

      await this.memberRepo.addMember(
        {
          organizationId: org.id,
          userId: ownerId,
          role: OrganizationRole.Owner,
        },
        tx,
      );

      return this.toModel(org);
    });
  }

  /**
   * GET SINGLE ORG (membership enforced)
   */
  async getByIdForUser(
    orgId: string,
    userId: string,
  ): Promise<OrganizationViewDto> {
    const membership = await this.memberRepo.findMembership(orgId, userId);

    if (!membership) {
      throw new DomainError(
        'ORG_ACCESS_DENIED',
        'You do not have access to this organization',
        'forbidden',
        { orgId, userId },
      );
    }

    const org = await this.orgRepo.findById(orgId);
    if (!org) {
      throw new DomainError(
        'ORG_NOT_FOUND',
        'Organization not found',
        'not_found',
        { orgId },
      );
    }

    return this.toView(org, membership.role as OrganizationRole);
  }

  /**
   * LIST ORGS FOR USER (role-aware projection)
   */
  async listForUser(
    userId: string,
    { page, limit }: listOrganizationsDto,
  ): Promise<PaginatedResult<OrganizationViewDto>> {
    const offset = (page - 1) * limit;

    const { items, total } = await this.memberRepo.listOrganizationsForUser(
      userId,
      limit,
      offset,
    );

    return {
      items: items.map(({ org, role }) =>
        this.toView(org, role as OrganizationRole),
      ),
      meta: { page, limit, total },
    };
  }
}
