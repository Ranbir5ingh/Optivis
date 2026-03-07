import { Injectable } from "@nestjs/common";
import { OrganizationMembersRepository } from "../members/organization-members.repository";
import { DomainError } from "src/common/exceptions/domain-error";

@Injectable()
export class OrganizationPolicy {
  constructor(
    private readonly memberRepo: OrganizationMembersRepository,
  ) {}

  async assertMember(
    organizationId: string,
    userId: string,
  ) {
    const membership = await this.memberRepo.findMembership(
      organizationId,
      userId,
    );

    if (!membership) {
      throw new DomainError(
        'ORG_ACCESS_DENIED',
        'You are not a member of this organization',
        'forbidden',
        { organizationId, userId },
      );
    }

    return membership;
  }

  async assertOwner(
    organizationId: string,
    userId: string,
  ) {
    const membership = await this.assertMember(organizationId, userId);

    if (membership.role !== 'owner') {
      throw new DomainError(
        'ORG_OWNER_REQUIRED',
        'Only organization owners can perform this action',
        'forbidden',
        { organizationId, userId },
      );
    }

    return membership;
  }

  async assertAdminOrOwner(
    organizationId: string,
    userId: string,
  ) {
    const membership = await this.assertMember(organizationId, userId);

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new DomainError(
        'ORG_ADMIN_REQUIRED',
        'Admin or owner permissions required',
        'forbidden',
        { organizationId, userId },
      );
    }

    return membership;
  }
}
