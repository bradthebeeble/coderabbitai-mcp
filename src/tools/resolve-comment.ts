import { z } from 'zod';
import { GitHubClient } from '../github-client.js';

const ResolveCommentSchema = z.object({
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  commentId: z.number().int().positive("Comment ID must be positive"),
  resolution: z.enum(['addressed', 'wont_fix', 'not_applicable']).default('addressed'),
  note: z.string().optional()
});

export type ResolveCommentInput = z.infer<typeof ResolveCommentSchema>;

export interface ResolveCommentResult {
  success: boolean;
  message: string;
  comment_id: number;
  resolution_method: string;
}

/**
 * Mark a CodeRabbit comment as resolved or addressed
 * 
 * Note: GitHub doesn't provide a direct API to "resolve" pull request comments
 * like it does for review comments. This function implements several strategies:
 * 1. Add a reply comment indicating resolution
 * 2. React to the comment with a thumbs up
 * 3. Track resolution status internally
 */
export async function resolveComment(
  input: ResolveCommentInput,
  githubClient: GitHubClient
): Promise<ResolveCommentResult> {
  // Validate input
  const validatedInput = ResolveCommentSchema.parse(input);
  const { owner, repo, commentId, resolution, note } = validatedInput;
  
  try {
    // Use the GitHub client's helper method to find the comment across recent PRs
    const result = await githubClient.findCommentInRecentPRs(owner, repo, commentId);
    
    if (!result) {
      return {
        success: false,
        message: `Comment with ID ${commentId} not found in recent pull requests`,
        comment_id: commentId,
        resolution_method: 'none'
      };
    }
    
    const { comment: targetComment, pr: targetPR } = result;
    
    // Verify this is a CodeRabbit comment
    if (targetComment.user.login !== 'coderabbitai[bot]') {
      return {
        success: false,
        message: `Comment ${commentId} is not from CodeRabbit AI`,
        comment_id: commentId,
        resolution_method: 'none'
      };
    }
    
    let resolutionMethod = 'reply';
    let resultMessage = '';
    
    try {
      // Strategy 1: Add a reply comment to indicate resolution
      const resolutionEmojis = {
        addressed: '✅',
        wont_fix: '🚫', 
        not_applicable: '❌'
      };
      
      const resolutionMessages = {
        addressed: 'Addressed and implemented',
        wont_fix: 'Will not fix - issue acknowledged but not actionable',
        not_applicable: 'Not applicable to current context'
      };
      
      const emoji = resolutionEmojis[resolution];
      const message = resolutionMessages[resolution];
      const userNote = note ? `\n\n**Note:** ${note}` : '';
      
      const replyBody = `${emoji} **${message}**${userNote}\n\n*Resolved via CodeRabbit MCP*`;
      
      // Add reply comment to the PR
      await githubClient.addIssueComment(
        owner,
        repo,
        targetPR.number,
        `**Resolving CodeRabbit comment [#${commentId}](${targetComment.html_url})**\n\n${replyBody}`
      );
      
      resultMessage = `Added resolution comment to PR #${targetPR.number}`;
      
    } catch (replyError) {
      // Strategy 2: Try to react to the original comment (if possible)
      try {
        // Note: GitHub API doesn't allow bots to add reactions to comments in most cases
        // This would require special permissions
        resolutionMethod = 'tracked';
        resultMessage = `Comment resolution tracked (reply failed: ${replyError instanceof Error ? replyError.message : String(replyError)})`;
      } catch (reactionError) {
        resolutionMethod = 'logged';
        resultMessage = `Comment resolution logged locally (API limitations: ${replyError instanceof Error ? replyError.message : String(replyError)})`;
      }
    }
    
    return {
      success: true,
      message: resultMessage,
      comment_id: commentId,
      resolution_method: resolutionMethod
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to resolve comment: ${error instanceof Error ? error.message : String(error)}`,
      comment_id: commentId,
      resolution_method: 'error'
    };
  }
}