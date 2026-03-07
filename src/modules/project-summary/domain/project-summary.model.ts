export interface ProjectSummaryModel {
  projectId: string;
  projectName: string;
  recommendationsActive: number;
  healthScore: number;
  healthState: 'healthy' | 'moderate' | 'warning' | 'critical';
}
