export type RepoRef = {
  owner: string;
  repo: string;
  branch: string;
};

export type TreeEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  sha?: string;
  size?: number;
  isExcalidraw: boolean;
};

export type Scene = {
  type: "excalidraw";
  version: number;
  source: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type RepoSummary = {
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
};

export type GithubError = {
  error: string;
  status?: number;
};
