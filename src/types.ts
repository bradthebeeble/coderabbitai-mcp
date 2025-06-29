export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  html_url: string;
  type: string;
  site_admin: boolean;
}

export interface GitHubReview {
  id: number;
  node_id: string;
  user: GitHubUser;
  body: string;
  submitted_at: string;
  commit_id: string;
  html_url: string;
  pull_request_url: string;
  state: "COMMENTED" | "APPROVED" | "REQUEST_CHANGES";
  author_association: string;
}

export interface GitHubComment {
  id: number;
  node_id: string;
  body: string;
  path: string;
  diff_hunk: string;
  original_position?: number;
  original_line?: number;
  original_start_line?: number;
  side: "LEFT" | "RIGHT";
  start_side?: "LEFT" | "RIGHT";
  commit_id: string;
  original_commit_id: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  author_association: string;
  html_url: string;
  pull_request_review_id: number;
  subject_type: "line" | "file";
}

export interface CodeRabbitReview {
  id: number;
  submitted_at: string;
  html_url: string;
  state: string;
  actionable_comments: number;
  body: string;
  summary: string;
  commit_id: string;
}

export interface CodeRabbitComment {
  id: number;
  body: string;
  path: string;
  line_range: {
    start: number;
    end: number;
  };
  side: "LEFT" | "RIGHT";
  severity: "error" | "warning" | "info" | "suggestion";
  category: string;
  description: string;
  ai_prompt?: string;
  committable_suggestion?: string;
  html_url: string;
  diff_hunk: string;
  created_at: string;
  updated_at: string;
  is_resolved: boolean;
}

export interface CodeRabbitCommentDetails extends CodeRabbitComment {
  file_context: string;
  related_comments: number[];
  fix_examples: string[];
}

export interface ParsedCodeRabbitContent {
  actionable_comments: number;
  duplicate_comments: number;
  nitpick_comments: number;
  summary: string;
  comments: Array<{
    category: string;
    severity: string;
    description: string;
    ai_prompt?: string;
    committable_suggestion?: string;
    file_path?: string;
    line_range?: string;
  }>;
}