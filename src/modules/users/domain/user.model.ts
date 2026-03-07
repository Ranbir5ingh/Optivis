import { UserRole } from './user-role.enum';

export interface UserModel {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  googleId?: string | null;
  githubId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
