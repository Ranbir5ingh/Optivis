export interface GitHubBranch {
  name: string;
  isDefault: boolean;
  commitSha: string;
}

export interface ProjectGithubConnection {
  id: string;
  projectId: string;
  orgInstallationId: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  connectedAt: Date;
}

export interface ProjectGithubConnectionStatus {
  isInstallationConnected: boolean;
  hasRepositorySelected: boolean;
  repository: {
    owner: string;
    name: string;
    branch: string;
  } | null;
}