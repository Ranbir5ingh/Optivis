import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UserModel } from './domain/user.model';
import { UserRow } from 'src/database/drizzle/schema';
import { UserRole } from './domain/user-role.enum';
import { DomainError } from 'src/common/exceptions/domain-error';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private toModel(row: UserRow): UserModel {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      googleId: row.googleId ?? null,
      githubId: row.githubId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByIdOrThrow(id: string): Promise<UserModel> {
    const row = await this.usersRepository.findById(id);
    if (!row) {
      throw new DomainError(
        'USER_NOT_FOUND',
        `User with id ${id} not found`,
        'not_found',
        { id },
      );
    }
    return this.toModel(row);
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    const row = await this.usersRepository.findByEmail(email);
    return row ? this.toModel(row) : null;
  }

  async findAuthDataByEmail(email: string): Promise<{
    user: UserModel;
    tokenVersion: number;
    passwordHash: string | null;
  }> {
    const row = await this.usersRepository.findByEmail(email);
    if (!row) {
      throw new DomainError(
        'USER_NOT_FOUND',
        `User with email ${email} not found`,
        'not_found',
        { email },
      );
    }

    const userModel = this.toModel(row);

    return {
      user: userModel,
      tokenVersion: row.tokenVersion,
      passwordHash: row.passwordHash,
    };
  }

  async findAuthDataById(
    id: string,
  ): Promise<{ user: UserModel; tokenVersion: number }> {
    const row = await this.usersRepository.findById(id);

    if (!row) {
      throw new DomainError(
        'USER_NOT_FOUND',
        `User with id ${id} not found`,
        'not_found',
        { id },
      );
    }

    return {
      user: this.toModel(row),
      tokenVersion: row.tokenVersion,
    };
  }

  async createLocalUser(params: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserModel> {
    const existing = await this.usersRepository.findByEmail(params.email);
    if (existing) {
      throw new DomainError(
        'EMAIL_ALREADY_IN_USE',
        'Email is already registered',
        'already_exists',
        { email: params.email },
      );
    }

    const row = await this.usersRepository.create({
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      role: UserRole.User,
    });

    return this.toModel(row);
  }

  async findOrCreateFromGoogle(profile: {
    name: string;
    email: string;
    googleId: string;
  }): Promise<UserModel> {
    const existingByGoogle = await this.usersRepository.findByGoogleId(
      profile.googleId,
    );
    if (existingByGoogle) {
      return this.toModel(existingByGoogle);
    }

    const existingByEmail = await this.usersRepository.findByEmail(
      profile.email,
    );
    if (existingByEmail) {
      const updated = await this.usersRepository.update(existingByEmail.id, {
        googleId: profile.googleId,
      });
      return this.toModel(updated);
    }

    const row = await this.usersRepository.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.googleId,
      role: UserRole.User,
    });

    return this.toModel(row);
  }

  async findOrCreateFromGithub(profile: {
    name: string;
    email: string;
    githubId: string;
  }): Promise<UserModel> {
    const existingByGithub = await this.usersRepository.findByGithubId(
      profile.githubId,
    );
    if (existingByGithub) {
      return this.toModel(existingByGithub);
    }

    const existingByEmail = await this.usersRepository.findByEmail(
      profile.email,
    );
    if (existingByEmail) {
      const updated = await this.usersRepository.update(existingByEmail.id, {
        githubId: profile.githubId,
      });
      return this.toModel(updated);
    }

    const row = await this.usersRepository.create({
      name: profile.name,
      email: profile.email,
      githubId: profile.githubId,
      role: UserRole.User,
    });

    return this.toModel(row);
  }

  async bumpTokenVersion(userId: string) {
    await this.usersRepository.bumpTokenVersion(userId);
  }
}
