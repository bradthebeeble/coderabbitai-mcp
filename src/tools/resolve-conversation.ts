import { z } from 'zod';
import { GitHubClient } from '../github-client.js';

const ResolveConversationSchema = z.object({
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  commentId: z.number().int().positive("Comment ID must be positive"),
  resolved: z.boolean().default(true),
  note: z.string().optional()
});

export type ResolveConversationInput = z.infer<typeof ResolveConversationSchema>;

export interface ResolveConversationResult {
  success: boolean;
  message: string;
  comment_id: number;
  resolved: boolean;
  resolution_method: string;
}

/**
 * Resolve or unresolve a GitHub pull request review conversation
 * 
 * This function marks a conversation thread as resolved in GitHub's UI,
 * which is different from just adding a comment about resolution.
 * It uses GitHub's conversation resolution API when available.
 */
export async function resolveConversation(
  input: ResolveConversationInput,
  githubClient: GitHubClient
): Promise<ResolveConversationResult> {
  // Validate input
  const validatedInput = ResolveConversationSchema.parse(input);
  const { owner, repo, commentId, resolved, note } = validatedInput;
  
  try {
    // Find the comment first to verify it exists and is from CodeRabbit
    const result = await githubClient.findCommentInRecentPRs(owner, repo, commentId);
    
    if (!result) {
      return {
        success: false,
        message: `Comment with ID ${commentId} not found in recent pull requests`,
        comment_id: commentId,
        resolved: false,
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
        resolved: false,
        resolution_method: 'none'
      };
    }
    
    let resolutionMethod = 'api';
    let resultMessage = '';
    
    try {
      if (resolved) {
        // Try to resolve the conversation
        await githubClient.resolveReviewConversation(owner, repo, commentId);
        resultMessage = `Conversation marked as resolved in PR #${targetPR.number}`;
        
        // Add optional note as a comment
        if (note) {
          await githubClient.addIssueComment(
            owner,
            repo,
            targetPR.number,
            `**Conversation resolved:** ${note}\n\n*Resolved via CodeRabbit MCP*`
          );
          resultMessage += ` with note: "${note}"`;
        }
      } else {
        // Try to unresolve the conversation
        await githubClient.unresolveReviewConversation(owner, repo, commentId);
        resultMessage = `Conversation marked as unresolved in PR #${targetPR.number}`;
        
        if (note) {
          await githubClient.addIssueComment(
            owner,
            repo,
            targetPR.number,
            `**Conversation reopened:** ${note}\n\n*Updated via CodeRabbit MCP*`
          );
          resultMessage += ` with note: "${note}"`;
        }
      }
      
    } catch (apiError) {
      // Fallback methods if direct API resolution fails
      resolutionMethod = 'fallback';
      
      if (resolved) {
        // Fallback 1: Add a positive reaction to indicate resolution
        try {
          await githubClient.addReactionToComment(owner, repo, commentId, '+1');
          resultMessage = `Added positive reaction to indicate resolution (API limitation)`;
        } catch (reactionError) {
          // Fallback 2: Add a comment to the PR
          const fallbackMessage = note 
            ? `**Conversation resolved:** ${note}\n\n*Note: Direct conversation resolution not available, using comment tracking*\n\n*Resolved via CodeRabbit MCP*`
            : `**Conversation resolved for comment [#${commentId}](${targetComment.html_url})**\n\n*Note: Direct conversation resolution not available*\n\n*Resolved via CodeRabbit MCP*`;
          
          await githubClient.addIssueComment(owner, repo, targetPR.number, fallbackMessage);
          resultMessage = `Added resolution comment to PR #${targetPR.number} (API limitations)`;
          resolutionMethod = 'comment';
        }
      } else {
        // For unresolving, we can only add a comment
        const unresolveMessage = note
          ? `**Conversation reopened:** ${note}\n\n*Reopened via CodeRabbit MCP*`
          : `**Conversation reopened for comment [#${commentId}](${targetComment.html_url})**\n\n*Reopened via CodeRabbit MCP*`;
        
        await githubClient.addIssueComment(owner, repo, targetPR.number, unresolveMessage);
        resultMessage = `Added reopen comment to PR #${targetPR.number}`;
        resolutionMethod = 'comment';
      }
    }
    
    return {
      success: true,
      message: resultMessage,
      comment_id: commentId,
      resolved,
      resolution_method: resolutionMethod
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to ${resolved ? 'resolve' : 'unresolve'} conversation: ${error instanceof Error ? error.message : String(error)}`,
      comment_id: commentId,
      resolved: false,
      resolution_method: 'error'
    };
  }
}