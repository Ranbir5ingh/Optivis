export interface ProjectKey {
  id: string;
  projectId: string;
  key: string;
  isActive: boolean;
  createdAt: Date;
  revokedAt?: Date | null;
}
