/**
 * Code Manifest - Exact output of build-time plugin
 * 
 * Structure mirrors @webruit/build-plugin output
 * Deterministic: same source code = same manifest
 */
export interface CodeManifest {
  // Project identification
  projectId: string;

  // Version control
  commitSha: string;
  branch: string;

  // Build metadata
  framework: 'nextjs' | 'vite' | 'react' | 'webpack' | 'other';
  timestamp: string; // ISO string
  version: string; // e.g., "1.0.0"

  // Component ID → Metadata mapping
  components: Record<string, ComponentMetadata>;

  // Element ID → Metadata mapping
  elements: Record<string, ElementMetadata>;

  // Manifest statistics (from build plugin)
  metadata: {
    totalComponents: number;
    totalElements: number;
    filesProcessed: number;
  };
}

export interface ComponentMetadata {
  // Component name
  name: string;

  // Source file path (relative to project root)
  file: string;

  // Exported names
  exports: string[];

  // Optional: source location
  lineStart?: number;
  lineEnd?: number;
}

export interface ElementMetadata {
  // Parent component ID
  componentId: string;

  // DOM element type
  type: string;

  // Stable JSX path (e.g., "HeroComponent > Button[key=cta]")
  jsxPath: string;

  // Optional: element attributes
  attributes?: Record<string, string>;

  // Optional: source line
  line?: number;
}