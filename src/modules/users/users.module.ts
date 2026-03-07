import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  providers: [UsersService, UsersRepository],
  exports:[UsersService]
})
export class UsersModule {}
