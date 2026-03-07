import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAccessGuard } from "../auth/guards/jwt-access.guard";
import { OrganizationsService } from "./organizations.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/domain/auth-user.model";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { ApiSuccessResponse } from "src/shared/types/api-response";
import { OrganizationModel } from "./domain/organization.model";
import { listOrganizationsDto } from "./dto/list.organizations.dto";
import { PaginatedResult } from "src/shared/types/pagination";
import { OrganizationViewDto } from "./dto/organization-view.dto";

@Controller('organizations')
@UseGuards(JwtAccessGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<ApiSuccessResponse<OrganizationModel>> {
    const org = await this.orgsService.create(user.userId, dto.name);
    return { status: 'success', data: org };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: listOrganizationsDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<OrganizationViewDto>>> {
    const result = await this.orgsService.listForUser(user.userId, query);
    return { status: 'success', data: result };
  }

  @Get(':organizationId')
  async getOne(
    @CurrentUser() user: AuthUser,
    @Param('organizationId') organizationId: string,
  ): Promise<ApiSuccessResponse<OrganizationViewDto>> {
    const org = await this.orgsService.getByIdForUser(
      organizationId,
      user.userId,
    );
    return { status: 'success', data: org };
  }
}
