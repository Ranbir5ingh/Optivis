import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CodeMetadataService } from '../services/code-metadata.service';
import { CodeFetchService } from '../services/code-fetch.service';
import { UploadManifestDto } from '../dto/upload-manifest.dto';
import { FetchBatchDto } from '../dto/fetch-batch.dto';
import { DomainError } from 'src/common/exceptions/domain-error';
import type { ApiSuccessResponse } from 'src/shared/types/api-response';
import { ProjectKeyGuard } from 'src/modules/project-keys/guards/project-key.guard';
import { ProjectId } from 'src/modules/project-keys/decorators/project-id.decorator';

/**
 * Code Metadata Controller
 * 
 * ✅ FIXED: Returns proper JSON response with manifestId
 */
@Controller('v1/code')
@UseGuards(ProjectKeyGuard)
export class CodeMetadataController {
  constructor(
    private readonly codeMetadata: CodeMetadataService,
    private readonly codeFetchService: CodeFetchService,
  ) {}

  /**
   * POST /v1/code/metadata
   * 
   * ✅ FIXED: Returns JSON response instead of 204 No Content
   */
  @Post('metadata')
  @HttpCode(HttpStatus.CREATED) // ✅ Changed from NO_CONTENT to CREATED
  async uploadManifest(
    @Body() dto: UploadManifestDto,
    @ProjectId() projectId: string,
  ): Promise<ApiSuccessResponse<{
    manifestId: string;
    projectId: string;
    commitSha: string;
    uploadedAt: string;
  }>> { // ✅ Returns proper response type
    // Verify projectId matches manifest
    if (dto.projectId !== projectId) {
      throw new DomainError(
        'PROJECT_MISMATCH',
        'Manifest projectId does not match authenticated project',
        'forbidden',
        { expected: projectId, provided: dto.projectId },
      );
    }

    // Validate manifest structure
    const validation = this.codeMetadata.validateManifest(dto);
    if (!validation.valid) {
      throw new DomainError(
        'INVALID_MANIFEST',
        'Manifest validation failed',
        'validation',
        { errors: validation.errors },
      );
    }

    // Upload manifest
    const result = await this.codeMetadata.uploadManifest(dto);

    // ✅ Return proper JSON response
    return {
      status: 'success',
      data: {
        manifestId: result.id, // From database row
        projectId: result.projectId,
        commitSha: result.commitSha,
        uploadedAt: result.uploadedAt.toISOString(),
      },
    };
  }

  /**
   * GET /v1/code/components/:componentId
   */
  @Get('components/:componentId')
  async resolveComponent(
    @Param('componentId') componentId: string,
    @ProjectId() projectId: string,
  ): Promise<ApiSuccessResponse<{
    id: string;
    name: string;
    file: string;
    exports: string[];
  } | null>> {
    const component = await this.codeMetadata.getComponent(projectId, componentId);

    if (!component) {
      throw new DomainError(
        'COMPONENT_NOT_FOUND',
        `Component ${componentId} not found in manifest`,
        'not_found',
        { componentId, projectId },
      );
    }

    return {
      status: 'success',
      data: component,
    };
  }

  /**
   * GET /v1/code/elements/:elementId
   */
  @Get('elements/:elementId')
  async resolveElement(
    @Param('elementId') elementId: string,
    @ProjectId() projectId: string,
  ): Promise<ApiSuccessResponse<{
    id: string;
    componentId: string;
    type: string;
    jsxPath: string;
  } | null>> {
    const element = await this.codeMetadata.getElement(projectId, elementId);

    if (!element) {
      throw new DomainError(
        'ELEMENT_NOT_FOUND',
        `Element ${elementId} not found in manifest`,
        'not_found',
        { elementId, projectId },
      );
    }

    return {
      status: 'success',
      data: element,
    };
  }

  /**
   * GET /v1/code/components
   */
  @Get('components')
  async listComponents(
    @ProjectId() projectId: string,
  ): Promise<ApiSuccessResponse<Array<{
    id: string;
    name: string;
    file: string;
  }>>> {
    const components = await this.codeMetadata.listComponents(projectId);

    return {
      status: 'success',
      data: components,
    };
  }

  /**
   * GET /v1/code/fetch/:componentId
   */
  @Get('fetch/:componentId')
  async fetchComponentCode(
    @Param('componentId') componentId: string,
    @ProjectId() projectId: string,
  ): Promise<ApiSuccessResponse<{
    componentId: string;
    name: string;
    filepath: string;
    code: string;
    lineStart?: number;
    lineEnd?: number;
    language: string;
  }>> {
    const codeData = await this.codeFetchService.fetchComponentCode(
      projectId,
      componentId,
    );

    return {
      status: 'success',
      data: codeData,
    };
  }

  /**
   * POST /v1/code/fetch/batch
   */
  @Post('fetch/batch')
  @HttpCode(HttpStatus.OK)
  async fetchMultipleComponents(
    @Body() dto: FetchBatchDto,
    @ProjectId() projectId: string,
  ): Promise<ApiSuccessResponse<{
    components: Array<{
      componentId: string;
      name: string;
      filepath: string;
      code: string;
      lineStart?: number;
      lineEnd?: number;
      language: string;
    }>;
    totalRequested: number;
    totalFetched: number;
  }>> {
    const components = await this.codeFetchService.fetchMultipleComponents(
      projectId,
      dto.componentIds,
    );

    return {
      status: 'success',
      data: {
        components,
        totalRequested: dto.componentIds.length,
        totalFetched: components.length,
      },
    };
  }
}