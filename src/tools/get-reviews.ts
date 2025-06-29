import { z } from 'zod';
import { GitHubReview, CodeRabbitReview, ParsedCodeRabbitContent } from '../types.js';

const GetCoderabbitReviewsSchema = z.object({
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"), 
  pullNumber: z.number().int().positive("Pull request number must be positive")
});

export type GetCoderabbitReviewsInput = z.infer<typeof GetCoderabbitReviewsSchema>;

/**
 * Parse CodeRabbit review body to extract structured information
 */
function parseCoderabbitReviewBody(body: string): ParsedCodeRabbitContent {
  const lines = body.split('\n');
  
  // Extract actionable comments count
  const actionableMatch = body.match(/\*\*Actionable comments posted: (\d+)\*\*/);
  const actionableCount = actionableMatch ? parseInt(actionableMatch[1]) : 0;
  
  // Extract duplicate comments count  
  const duplicateMatch = body.match(/♻️ Duplicate comments \((\d+)\)/);
  const duplicateCount = duplicateMatch ? parseInt(duplicateMatch[1]) : 0;
  
  // Extract nitpick comments count
  const nitpickMatch = body.match(/🧹 Nitpick comments \((\d+)\)/);
  const nitpickCount = nitpickMatch ? parseInt(nitpickMatch[1]) : 0;
  
  // Extract summary from review details section
  let summary = "";
  const summaryMatch = body.match(/📜 Review details[\s\S]*?(?=\n\n|\n<|$)/);
  if (summaryMatch) {
    summary = summaryMatch[0].replace(/📜 Review details\n/, '').trim();
  }
  
  // Parse embedded comments in the review body
  const comments: Array<{
    category: string;
    severity: string; 
    description: string;
    ai_prompt?: string;
    committable_suggestion?: string;
    file_path?: string;
    line_range?: string;
  }> = [];
  
  // Look for comment blocks in details sections
  const commentBlocks = body.split('<details>');
  
  for (const block of commentBlocks) {
    if (!block.includes('</details>')) continue;
    
    // Extract category from summary
    const summaryMatch = block.match(/<summary>(.*?)<\/summary>/);
    const category = summaryMatch ? summaryMatch[1].trim() : 'Unknown';
    
    // Determine severity from emoji/markers
    let severity = 'info';
    if (block.includes('⚠️ Potential issue') || block.includes('_⚠️ Potential issue_')) {
      severity = 'warning';
    } else if (block.includes('🛠️ Refactor suggestion') || block.includes('_🛠️ Refactor suggestion_')) {
      severity = 'suggestion';
    } else if (block.includes('🧹 Nitpick')) {
      severity = 'info';
    }
    
    // Extract AI prompt
    const aiPromptMatch = block.match(/🤖 Prompt for AI Agents[\s\S]*?```\n([\s\S]*?)\n```/);
    const aiPrompt = aiPromptMatch ? aiPromptMatch[1].trim() : undefined;
    
    // Extract committable suggestion
    const committableMatch = block.match(/📝 Committable suggestion[\s\S]*?```suggestion\n([\s\S]*?)\n```/);
    const committableSuggestion = committableMatch ? committableMatch[1].trim() : undefined;
    
    // Extract file path and line range if present
    const filePathMatch = block.match(/`([^`]+\.(js|ts|tsx|jsx|py|java|cpp|c|h|go|rs|rb|php|cs|kt|swift))`/);
    const filePath = filePathMatch ? filePathMatch[1] : undefined;
    
    const lineRangeMatch = block.match(/lines? (\d+(?:-\d+)?)/i);
    const lineRange = lineRangeMatch ? lineRangeMatch[1] : undefined;
    
    // Extract description (first substantial text block)
    const descMatch = block.match(/<\/summary><blockquote>\n\n(.*?)(?=\n\n|\n<)/s);
    const description = descMatch ? descMatch[1].replace(/\*\*/g, '').trim() : category;
    
    if (aiPrompt || committableSuggestion || description !== category) {
      comments.push({
        category,
        severity,
        description,
        ai_prompt: aiPrompt,
        committable_suggestion: committableSuggestion,
        file_path: filePath,
        line_range: lineRange
      });
    }
  }
  
  return {
    actionable_comments: actionableCount,
    duplicate_comments: duplicateCount,
    nitpick_comments: nitpickCount,
    summary,
    comments
  };
}

/**
 * Get all CodeRabbit reviews for a specific pull request
 */
export async function getCoderabbitReviews(
  input: GetCoderabbitReviewsInput,
  githubMcp: any
): Promise<CodeRabbitReview[]> {
  // Validate input
  const validatedInput = GetCoderabbitReviewsSchema.parse(input);
  const { owner, repo, pullNumber } = validatedInput;
  
  try {
    // Get all reviews for the PR using GitHub MCP
    const reviews: GitHubReview[] = await githubMcp.get_pull_request_reviews({
      owner,
      repo, 
      pullNumber
    });
    
    // Filter for CodeRabbit reviews only
    const coderabbitReviews = reviews.filter(review => 
      review.user.login === 'coderabbitai[bot]'
    );
    
    // Parse and enrich each CodeRabbit review
    const enrichedReviews: CodeRabbitReview[] = coderabbitReviews.map(review => {
      const parsed = parseCoderabbitReviewBody(review.body);
      
      return {
        id: review.id,
        submitted_at: review.submitted_at,
        html_url: review.html_url,
        state: review.state,
        actionable_comments: parsed.actionable_comments,
        body: review.body,
        summary: parsed.summary,
        commit_id: review.commit_id
      };
    });
    
    return enrichedReviews;
    
  } catch (error) {
    throw new Error(`Failed to get CodeRabbit reviews: ${error instanceof Error ? error.message : String(error)}`);
  }
}