import { GitHubReview, GitHubComment, GitHubUser } from './types.js';

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubAPIError extends Error {
  status?: number;
  response?: any;
}

/**
 * Direct GitHub API client for CodeRabbit MCP server
 * Uses GitHub REST API v4 with Personal Access Token authentication
 */
export class GitHubClient {
  private token: string;
  private baseUrl: string;

  constructor(token?: string, baseUrl: string = 'https://api.github.com') {
    this.token = token || process.env.GITHUB_PAT || '';
    this.baseUrl = baseUrl;

    if (!this.token) {
      throw new Error('GITHUB_PAT environment variable is required');
    }
  }

  /**
   * Make an authenticated request to the GitHub API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CodeRabbit-MCP-Server/1.0.0'
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`GitHub API error: ${response.status} ${response.statusText}`) as GitHubAPIError;
        error.status = response.status;
        error.response = errorBody;
        throw error;
      }

      // Handle empty responses (e.g., 204 No Content)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Get all reviews for a pull request
   */
  async getPullRequestReviews(owner: string, repo: string, pullNumber: number): Promise<GitHubReview[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`;
    return this.makeRequest<GitHubReview[]>(endpoint);
  }

  /**
   * Get all comments for a pull request (review comments)
   */
  async getPullRequestComments(owner: string, repo: string, pullNumber: number): Promise<GitHubComment[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}/comments`;
    return this.makeRequest<GitHubComment[]>(endpoint);
  }

  /**
   * Get a specific pull request
   */
  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}`;
    return this.makeRequest<GitHubPullRequest>(endpoint);
  }

  /**
   * List pull requests for a repository
   */
  async listPullRequests(
    owner: string, 
    repo: string, 
    options: {
      state?: 'open' | 'closed' | 'all';
      sort?: 'created' | 'updated' | 'popularity';
      direction?: 'asc' | 'desc';
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubPullRequest[]> {
    const { 
      state = 'open', 
      sort = 'updated', 
      direction = 'desc', 
      perPage = 30,
      page = 1 
    } = options;

    const params = new URLSearchParams({
      state,
      sort,
      direction,
      per_page: perPage.toString(),
      page: page.toString()
    });

    const endpoint = `/repos/${owner}/${repo}/pulls?${params}`;
    return this.makeRequest<GitHubPullRequest[]>(endpoint);
  }

  /**
   * Add a comment to an issue (including pull requests)
   */
  async addIssueComment(
    owner: string, 
    repo: string, 
    issueNumber: number, 
    body: string
  ): Promise<any> {
    const endpoint = `/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
    return this.makeRequest(endpoint, 'POST', { body });
  }

  /**
   * Get a specific comment by ID
   */
  async getComment(owner: string, repo: string, commentId: number): Promise<GitHubComment> {
    const endpoint = `/repos/${owner}/${repo}/pulls/comments/${commentId}`;
    return this.makeRequest<GitHubComment>(endpoint);
  }

  /**
   * React to a comment (add reaction)
   */
  async addReactionToComment(
    owner: string, 
    repo: string, 
    commentId: number, 
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'
  ): Promise<any> {
    const endpoint = `/repos/${owner}/${repo}/pulls/comments/${commentId}/reactions`;
    return this.makeRequest(endpoint, 'POST', { content: reaction });
  }

  /**
   * Resolve a pull request review conversation
   * This marks the conversation thread as resolved
   * 
   * Note: GitHub's REST API doesn't support direct conversation resolution.
   * This method uses a fallback approach with reactions to indicate resolution.
   */
  async resolveReviewConversation(
    owner: string,
    repo: string,
    commentId: number
  ): Promise<any> {
    const endpoint = `/repos/${owner}/${repo}/pulls/comments/${commentId}`;
    
    // First get the comment to find the conversation ID
    const comment = await this.makeRequest<GitHubComment>(endpoint);
    
    if (!comment.pull_request_review_id) {
      throw new Error('Comment is not associated with a review conversation');
    }

    // GitHub API doesn't support direct conversation resolution via REST API
    // Fallback: Add a reaction to indicate resolution
    console.warn('GitHub conversation resolution API not available; using reaction fallback');
    return await this.addReactionToComment(owner, repo, commentId, '+1');
  }

  /**
   * Unresolve a pull request review conversation
   * 
   * Note: GitHub's REST API doesn't support direct conversation resolution.
   * This method uses a fallback approach with reactions to indicate unresolving.
   */
  async unresolveReviewConversation(
    owner: string,
    repo: string,
    commentId: number
  ): Promise<any> {
    // GitHub API doesn't support direct conversation resolution via REST API
    // For unresolving, we can only indicate this through external means
    console.warn('GitHub conversation resolution API not available for unresolving');
    
    // Fallback: Add a reaction to indicate the conversation needs attention
    try {
      return await this.addReactionToComment(owner, repo, commentId, 'eyes');
    } catch (error) {
      throw new Error('Cannot unresolve conversation: GitHub API does not support this operation via REST API');
    }
  }

  /**
   * Search for a comment across multiple pull requests
   * This is a helper method since GitHub doesn't provide direct comment search
   */
  async findCommentInRecentPRs(
    owner: string, 
    repo: string, 
    commentId: number,
    maxPRs: number = 20
  ): Promise<{ comment: GitHubComment; pr: GitHubPullRequest } | null> {
    try {
      // Get recent PRs
      const prs = await this.listPullRequests(owner, repo, {
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        perPage: maxPRs
      });

      // Search through each PR for the comment
      for (const pr of prs) {
        try {
          const comments = await this.getPullRequestComments(owner, repo, pr.number);
          const targetComment = comments.find(comment => comment.id === commentId);
          
          if (targetComment) {
            return { comment: targetComment, pr };
          }
        } catch (error) {
          // Continue searching other PRs if one fails
          console.warn(`Failed to get comments for PR #${pr.number}:`, error);
          continue;
        }
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to search for comment ${commentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the token has required permissions
   */
  async validateToken(): Promise<{ valid: boolean; scopes: string[]; user: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!response.ok) {
        return { valid: false, scopes: [], user: '' };
      }

      const user = await response.json();
      const scopes = response.headers.get('X-OAuth-Scopes')?.split(', ') || [];

      return {
        valid: true,
        scopes,
        user: user.login
      };
    } catch (error) {
      return { valid: false, scopes: [], user: '' };
    }
  }
}