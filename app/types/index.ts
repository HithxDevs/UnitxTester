// GitHub API types
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir";
}

export interface GitHubContent {
  content: string;
  encoding: "base64";
}

// Test generation types
export interface TestCase {
  description: string;
  code: string;
  framework: "jest" | "mocha" | "junit" | "pytest" | "selenium";
}

export interface TestGenerationRequest {
  files: {
    path: string;
    content: string;
  }[];
  framework: TestCase["framework"];
}

export interface TestGenerationResponse {
  tests: TestCase[];
}

export interface PRCreationRequest {
  repo: string;
  branch: string;
  tests: TestCase[];
  framework: TestCase["framework"];
}

export interface PRCreationResponse {
  prUrl: string;
}