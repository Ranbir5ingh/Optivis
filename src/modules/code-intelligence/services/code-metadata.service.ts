import { Injectable } from '@nestjs/common';
import { CodeMetadataRepository } from '../repositories/code-metadata.repository';
import { DomainError } from 'src/common/exceptions/domain-error';
import type { CodeManifest } from '../domain/code-manifest.model';

/**
 * Code Metadata Service
 * 
 * ✅ FIXED: Returns database row with ID after upload
 */
@Injectable()
export class CodeMetadataService {
  constructor(private readonly repo: CodeMetadataRepository) {}

  /**
   * Upload/store code metadata manifest from build plugin
   * ✅ FIXED: Returns the uploaded row with ID
   */
  async uploadManifest(manifest: CodeManifest): Promise<{
    id: string;
    projectId: string;
    commitSha: string;
    uploadedAt: Date;
  }> {
    // Upload manifest to database
    const row = await this.repo.upsert({
      projectId: manifest.projectId,
      commitSha: manifest.commitSha,
      branch: manifest.branch,
      framework: manifest.framework,
      components: manifest.components,
      elements: manifest.elements,
      metadata: manifest.metadata,
    });

    // ✅ Return the database row with ID
    return {
      id: row.id,
      projectId: row.projectId,
      commitSha: row.commitSha,
      uploadedAt: row.uploadedAt,
    };
  }

  /**
   * Get component info by ID
   * Returns: file path, name, exports
   */
  async getComponent(projectId: string, componentId: string): Promise<{
    id: string;
    name: string;
    file: string;
    exports: string[];
  } | null> {
    const file = await this.repo.resolveComponentFile(projectId, componentId);
    if (!file) return null;

    const manifest = await this.repo.getLatestForProject(projectId);
    if (!manifest) return null;

    const component = manifest.components[componentId];
    if (!component) return null;

    return {
      id: componentId,
      name: component.name,
      file: component.file,
      exports: component.exports,
    };
  }

  /**
   * Get element info by ID
   * Returns: component ID, JSX path, type
   */
  async getElement(projectId: string, elementId: string): Promise<{
    id: string;
    componentId: string;
    type: string;
    jsxPath: string;
  } | null> {
    const resolved = await this.repo.resolveElement(projectId, elementId);
    if (!resolved) return null;

    return {
      id: elementId,
      componentId: resolved.componentId,
      type: resolved.type,
      jsxPath: resolved.jsxPath,
    };
  }

  /**
   * List all components in project
   */
  async listComponents(projectId: string): Promise<Array<{
    id: string;
    name: string;
    file: string;
  }>> {
    const manifest = await this.repo.getLatestForProject(projectId);
    if (!manifest) return [];

    return Object.entries(manifest.components).map(([id, component]) => ({
      id,
      name: component.name,
      file: component.file,
    }));
  }

  /**
   * Validate manifest structure
   * Used by upload endpoint before storage
   */
  validateManifest(manifest: CodeManifest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!manifest.projectId) errors.push('Missing projectId');
    if (!manifest.commitSha) errors.push('Missing commitSha');
    if (!manifest.framework) errors.push('Missing framework');
    if (!manifest.components) errors.push('Missing components');
    if (!manifest.elements) errors.push('Missing elements');
    if (!manifest.metadata) errors.push('Missing metadata');

    // Validate no empty manifest
    if (Object.keys(manifest.components).length === 0) {
      errors.push('Manifest must contain at least one component');
    }

    // Validate element references valid components
    for (const [elementId, element] of Object.entries(manifest.elements)) {
      if (!manifest.components[element.componentId]) {
        errors.push(
          `Element ${elementId} references non-existent component ${element.componentId}`
        );
      }
    }

    // Validate ID formats
    for (const componentId of Object.keys(manifest.components)) {
      if (!/^wb_c_[a-f0-9]{8}$/.test(componentId)) {
        errors.push(`Invalid component ID format: ${componentId}`);
      }
    }

    for (const elementId of Object.keys(manifest.elements)) {
      if (!/^wb_el_[a-f0-9]{8}$/.test(elementId)) {
        errors.push(`Invalid element ID format: ${elementId}`);
      }
    }

    // Validate metadata counts match
    if (manifest.metadata.totalComponents !== Object.keys(manifest.components).length) {
      errors.push(
        `Metadata totalComponents (${manifest.metadata.totalComponents}) doesn't match actual components (${Object.keys(manifest.components).length})`
      );
    }

    if (manifest.metadata.totalElements !== Object.keys(manifest.elements).length) {
      errors.push(
        `Metadata totalElements (${manifest.metadata.totalElements}) doesn't match actual elements (${Object.keys(manifest.elements).length})`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}