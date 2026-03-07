import { UserRole } from 'src/modules/users/domain/user-role.enum';

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
}
