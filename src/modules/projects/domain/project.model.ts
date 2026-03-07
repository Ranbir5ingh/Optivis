export type ProjectStatus = 'active' | 'archived';

export interface ProjectModel {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  websiteUrl: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}
