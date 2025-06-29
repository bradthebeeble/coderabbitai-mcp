import { z } from 'zod';
import { GitHubComment, CodeRabbitComment } from '../types.js';
import { GitHubClient } from '../github-client.js';

const GetReviewCommentsSchema = z.object({
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"), 
  pullNumber: z.number().int().positive("Pull request number must be positive"),
  reviewId: z.number().int().positive("Review ID must be positive").optional()
});

export type GetReviewCommentsInput = z.infer<typeof GetReviewCommentsSchema>;

/**
 * Parse CodeRabbit comment body to extract structured information
 */
function parseCoderabbitComment(comment: GitHubComment): CodeRabbitComment {
  const body = comment.body;
  
  // Determine severity from markers
  let severity: "error" | "warning" | "info" | "suggestion" = 'info';
  let category = 'General';
  
  if (body.includes('⚠️ Potential issue') || body.includes('_⚠️ Potential issue_')) {
    severity = 'warning';
    category = 'Potential Issue';
  } else if (body.includes('🛠️ Refactor suggestion') || body.includes('_🛠️ Refactor suggestion_')) {
    severity = 'suggestion';
    category = 'Refactor Suggestion';
  } else if (body.includes('🧹 Nitpick')) {
    severity = 'info';
    category = 'Nitpick';
  } else if (body.includes('🔒 Security')) {
    severity = 'error';
    category = 'Security';
  }
  
  // Extract AI prompt
  const aiPromptMatch = body.match(/🤖 Prompt for AI Agents[\s\S]*?```\n([\s\S]*?)\n```/);
  const aiPrompt = aiPromptMatch ? aiPromptMatch[1].trim() : undefined;
  
  // Extract committable suggestion
  const committableMatch = body.match(/📝 Committable suggestion[\s\S]*?```suggestion\n([\s\S]*?)\n```/);
  const committableSuggestion = committableMatch ? committableMatch[1].trim() : undefined;
  
  // Extract main description (first substantial paragraph)
  const descLines = body.split('\n').filter(line => 
    line.trim() && 
    !line.includes('_⚠️') && 
    !line.includes('_🛠️') && 
    !line.includes('🤖 Prompt') &&
    !line.includes('📝 Committable') &&
    !line.trim().startsWith('<') &&
    !line.trim().startsWith('```')
  );
  
  const description = descLines.slice(0, 3).join(' ').trim() || 'CodeRabbit suggestion';
  
  // Parse line range from diff_hunk or comment position
  let lineRange = { start: 1, end: 1 };
  if (comment.original_start_line && comment.original_line) {
    lineRange = {
      start: comment.original_start_line,
      end: comment.original_line
    };
  } else if (comment.original_line) {
    lineRange = {
      start: comment.original_line,
      end: comment.original_line
    };
  }
  
  // Check if comment is resolved (GitHub doesn't provide this directly, so we check for resolution indicators)
  const isResolved = body.includes('✅ Addressed') || body.includes('✅ Fixed') || body.includes('✅ Resolved');
  
  return {
    id: comment.id,
    body: comment.body,
    path: comment.path,
    line_range: lineRange,
    side: comment.side,
    severity,
    category,
    description,
    ai_prompt: aiPrompt,
    committable_suggestion: committableSuggestion,
    html_url: comment.html_url,
    diff_hunk: comment.diff_hunk,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    is_resolved: isResolved
  };
}

/**
 * Get all CodeRabbit comments for a pull request or specific review
 */
export async function getReviewComments(
  input: GetReviewCommentsInput,
  githubClient: GitHubClient
): Promise<CodeRabbitComment[]> {
  // Validate input
  const validatedInput = GetReviewCommentsSchema.parse(input);
  const { owner, repo, pullNumber, reviewId } = validatedInput;
  
  try {
    // Get all comments for the PR using GitHub API
    const allComments: GitHubComment[] = await githubClient.getPullRequestComments(owner, repo, pullNumber);
    
    // Filter for CodeRabbit comments
    let coderabbitComments = allComments.filter(comment => 
      comment.user.login === 'coderabbitai[bot]'
    );
    
    // If reviewId is specified, filter for that specific review
    if (reviewId) {
      coderabbitComments = coderabbitComments.filter(comment => 
        comment.pull_request_review_id === reviewId
      );
    }
    
    // Parse and enrich each comment
    const enrichedComments: CodeRabbitComment[] = coderabbitComments.map(parseCoderabbitComment);
    
    // Sort by file path and line number for better organization
    enrichedComments.sort((a, b) => {
      if (a.path !== b.path) {
        return a.path.localeCompare(b.path);
      }
      return a.line_range.start - b.line_range.start;
    });
    
    return enrichedComments;
    
  } catch (error) {
    throw new Error(`Failed to get review comments: ${error instanceof Error ? error.message : String(error)}`);
  }
}