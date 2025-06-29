import { z } from 'zod';
import { GitHubComment, CodeRabbitCommentDetails } from '../types.js';

const GetCommentDetailsSchema = z.object({
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  commentId: z.number().int().positive("Comment ID must be positive")
});

export type GetCommentDetailsInput = z.infer<typeof GetCommentDetailsSchema>;

/**
 * Extract fix examples from CodeRabbit comment body
 */
function extractFixExamples(body: string): string[] {
  const examples: string[] = [];
  
  // Extract committable suggestions
  const committableMatches = body.matchAll(/📝 Committable suggestion[\s\S]*?```suggestion\n([\s\S]*?)\n```/g);
  for (const match of committableMatches) {
    examples.push(match[1].trim());
  }
  
  // Extract diff suggestions
  const diffMatches = body.matchAll(/```diff\n([\s\S]*?)\n```/g);
  for (const match of diffMatches) {
    examples.push(match[1].trim());
  }
  
  // Extract code block examples
  const codeMatches = body.matchAll(/```(?:javascript|typescript|python|java|go|rust|cpp|c)\n([\s\S]*?)\n```/g);
  for (const match of codeMatches) {
    examples.push(match[1].trim());
  }
  
  return examples;
}

/**
 * Extract file context around the comment
 */
function extractFileContext(diffHunk: string, path: string): string {
  if (!diffHunk) return '';
  
  // Clean up the diff hunk to provide readable context
  const lines = diffHunk.split('\n');
  const contextLines = lines.filter(line => 
    !line.startsWith('@@') && line.trim().length > 0
  ).map(line => {
    // Remove diff markers but keep indentation
    if (line.startsWith('+') || line.startsWith('-')) {
      return line.substring(1);
    }
    return line.startsWith(' ') ? line.substring(1) : line;
  });
  
  return `File: ${path}\n\n${contextLines.join('\n')}`;
}

/**
 * Find related comments based on file path and proximity
 */
function findRelatedComments(
  currentComment: GitHubComment,
  allComments: GitHubComment[]
): number[] {
  const related: number[] = [];
  
  for (const comment of allComments) {
    if (comment.id === currentComment.id) continue;
    
    // Same file
    if (comment.path === currentComment.path) {
      // Check if lines are close (within 10 lines)
      const currentLine = currentComment.original_line || 0;
      const commentLine = comment.original_line || 0;
      
      if (Math.abs(currentLine - commentLine) <= 10) {
        related.push(comment.id);
      }
    }
  }
  
  return related;
}

/**
 * Get detailed information about a specific CodeRabbit comment
 */
export async function getCommentDetails(
  input: GetCommentDetailsInput,
  githubMcp: any
): Promise<CodeRabbitCommentDetails> {
  // Validate input
  const validatedInput = GetCommentDetailsSchema.parse(input);
  const { owner, repo, commentId } = validatedInput;
  
  try {
    // First, get all PR comments to find the specific comment and its context
    // We need to find which PR this comment belongs to
    
    // Get recent PRs to search for the comment (this is a limitation of GitHub API)
    const recentPRs = await githubMcp.list_pull_requests({
      owner,
      repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      perPage: 20
    });
    
    let targetComment: GitHubComment | null = null;
    let allPRComments: GitHubComment[] = [];
    
    // Search through recent PRs to find the comment
    for (const pr of recentPRs) {
      try {
        const comments = await githubMcp.get_pull_request_comments({
          owner,
          repo,
          pullNumber: pr.number
        });
        
        allPRComments = comments;
        targetComment = comments.find((c: GitHubComment) => c.id === commentId);
        
        if (targetComment) break;
      } catch (error) {
        // Continue searching other PRs
        continue;
      }
    }
    
    if (!targetComment) {
      throw new Error(`Comment with ID ${commentId} not found in recent pull requests`);
    }
    
    // Verify this is a CodeRabbit comment
    if (targetComment.user.login !== 'coderabbitai[bot]') {
      throw new Error(`Comment ${commentId} is not from CodeRabbit AI`);
    }
    
    const body = targetComment.body;
    
    // Parse severity and category
    let severity: "error" | "warning" | "info" | "suggestion" = 'info';
    let category = 'General';
    
    if (body.includes('⚠️ Potential issue')) {
      severity = 'warning';
      category = 'Potential Issue';
    } else if (body.includes('🛠️ Refactor suggestion')) {
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
    
    // Extract description
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
    
    // Parse line range
    let lineRange = { start: 1, end: 1 };
    if (targetComment.original_start_line && targetComment.original_line) {
      lineRange = {
        start: targetComment.original_start_line,
        end: targetComment.original_line
      };
    } else if (targetComment.original_line) {
      lineRange = {
        start: targetComment.original_line,
        end: targetComment.original_line
      };
    }
    
    // Check if resolved
    const isResolved = body.includes('✅ Addressed') || body.includes('✅ Fixed') || body.includes('✅ Resolved');
    
    // Extract additional details
    const fileContext = extractFileContext(targetComment.diff_hunk, targetComment.path);
    const relatedComments = findRelatedComments(targetComment, allPRComments);
    const fixExamples = extractFixExamples(body);
    
    const commentDetails: CodeRabbitCommentDetails = {
      id: targetComment.id,
      body: targetComment.body,
      path: targetComment.path,
      line_range: lineRange,
      side: targetComment.side,
      severity,
      category,
      description,
      ai_prompt: aiPrompt,
      committable_suggestion: committableSuggestion,
      html_url: targetComment.html_url,
      diff_hunk: targetComment.diff_hunk,
      created_at: targetComment.created_at,
      updated_at: targetComment.updated_at,
      is_resolved: isResolved,
      file_context: fileContext,
      related_comments: relatedComments,
      fix_examples: fixExamples
    };
    
    return commentDetails;
    
  } catch (error) {
    throw new Error(`Failed to get comment details: ${error instanceof Error ? error.message : String(error)}`);
  }
}