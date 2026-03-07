import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  users,
  NewUserRow,
  UserRow,
} from 'src/database/drizzle/schema/users.schema';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async create(data: NewUserRow): Promise<UserRow> {
    const [inserted] = await this.db.insert(users).values(data).returning();
    return inserted;
  }

  async findById(id: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ?? null;
  }

  async findByGoogleId(googleId: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);
    return row ?? null;
  }

  async findByGithubId(githubId: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.githubId, githubId))
      .limit(1);
    return row ?? null;
  }

  async update(id: string, data: Partial<NewUserRow>): Promise<UserRow> {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async bumpTokenVersion(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId));
  }
}
