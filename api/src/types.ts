export interface Env {
  DB: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
}

export interface Developer {
  id: string;
  github_id: string;
  github_username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  app_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface App {
  id: string;
  developer_id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  tags: string | null;
  repo_url: string;
  repo_tag: string;
  homepage_url: string | null;
  icon_url: string | null;
  screenshots: string | null;
  trust_level: string;
  has_backend: number;
  backend_url: string | null;
  file_size: number | null;
  status: string;
  version: string | null;
  total_views: number;
  total_visitors: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  app_id: string | null;
  developer_id: string;
  repo_url: string;
  repo_tag: string;
  app_name: string;
  app_slug: string;
  description: string | null;
  status: string;
  audit_result: string | null;
  audit_score: number | null;
  build_log: string | null;
  reject_reason: string | null;
  error_details: string | null;
  file_size: number | null;
  is_update: number;
  created_at: string;
  completed_at: string | null;
}

export interface JwtPayload {
  sub: string;
  github_username: string;
  iat: number;
  exp: number;
}
