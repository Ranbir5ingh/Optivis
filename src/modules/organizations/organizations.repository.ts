import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  NewOrganizationRow,
  OrganizationRow,
  organizations,
} from 'src/database/drizzle/schema';

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async create(
    data: NewOrganizationRow,
    tx: NodePgDatabase = this.db,
  ): Promise<OrganizationRow> {
    const [row] = await tx.insert(organizations).values(data).returning();
    return row;
  }

  async findById(id: string): Promise<OrganizationRow | null> {
    const [row] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return row ?? null;
  }


}
