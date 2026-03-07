// dto/organization-view.dto.ts
import { OrganizationRole } from "../domain/organization-role.enum";

export interface OrganizationViewDto {
  id: string;
  name: string;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
}
