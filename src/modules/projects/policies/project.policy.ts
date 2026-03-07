import { Injectable } from "@nestjs/common";
import { OrganizationPolicy } from "src/modules/organizations/policies/organization.policy";

@Injectable()
export class ProjectsPolicy {
  constructor(
    private readonly orgPolicy: OrganizationPolicy,
  ) {}

  async assertCanManageProject(
    userId: string,
    organizationId: string,
  ) {
    // Phase 2 rule:
    // Only owners can create / delete projects
    return this.orgPolicy.assertOwner(organizationId, userId);
  }

  async assertCanViewProject(
    userId: string,
    organizationId: string,
  ) {
    // Phase 2 rule:
    // Any member can view projects
    return this.orgPolicy.assertMember(organizationId, userId);
  }
}
