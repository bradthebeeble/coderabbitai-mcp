import { z } from 'zod';
import { GitHubReview, ParsedCodeRabbitContent } from '../types.js';
import { GitHubClient } from '../github-client.js';

const GetReviewDetailsSchema = z.object({
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  pullNumber: z.number().int().positive("Pull request number must be positive"),
  reviewId: z.number().int().positive("Review ID must be positive")
});

export type GetReviewDetailsInput = z.infer<typeof GetReviewDetailsSchema>;

export interface CodeRabbitReviewDetails {
  id: number;
  submitted_at: string;
  html_url: string;
  state: string;
  commit_id: string;
  body: string;
  parsed_content: ParsedCodeRabbitContent;
  files_reviewed: string[];
  configuration_used: string;
  review_profile: string;
}

/**
 * Parse CodeRabbit review body to extract detailed structured information
 */
function parseCoderabbitReviewBodyDetailed(body: string): ParsedCodeRabbitContent & {
  files_reviewed: string[];
  configuration_used: string;
  review_profile: string;
} {
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
  
  // Extract configuration information
  const configMatch = body.match(/\*\*Configuration used: (.+?)\*\*/);
  const configuration = configMatch ? configMatch[1] : 'Unknown';
  
  // Extract review profile
  const profileMatch = body.match(/\*\*Review profile: (.+?)\*\*/);
  const reviewProfile = profileMatch ? profileMatch[1] : 'Unknown';
  
  // Extract files reviewed from the "Files selected for processing" section
  const filesSection = body.match(/📒 Files selected for processing.*?\n(.*?)(?=\n\n|\n<|$)/s);
  const filesReviewed: string[] = [];
  
  if (filesSection) {
    const fileLines = filesSection[1].split('\n');
    for (const line of fileLines) {
      const fileMatch = line.match(/\* `([^`]+)`/);
      if (fileMatch) {
        filesReviewed.push(fileMatch[1]);
      }
    }
  }
  
  // Extract summary from review details section
  let summary = "";
  const summaryMatch = body.match(/📜 Review details[\s\S]*?(?=\n\n|\n<|$)/);
  if (summaryMatch) {
    summary = summaryMatch[0].replace(/📜 Review details/, '').trim();
  }
  
  // Parse detailed comments from the review body
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
  const commentSections = body.split('<details>');
  
  for (const section of commentSections) {
    if (!section.includes('</details>')) continue;
    
    // Extract category from summary
    const summaryMatch = section.match(/<summary>(.*?)<\/summary>/);
    if (!summaryMatch) continue;
    
    const category = summaryMatch[1].trim();
    
    // Skip non-code-review sections
    if (category.includes('Commits') || category.includes('Files ignored')) continue;
    
    // Parse individual comments within this section
    const commentBlocks = section.split('</blockquote>');
    
    for (const block of commentBlocks) {
      if (!block.trim()) continue;
      
      // Determine severity from emoji/markers
      let severity = 'info';
      if (block.includes('⚠️ Potential issue') || block.includes('_⚠️ Potential issue_')) {
        severity = 'warning';
      } else if (block.includes('🛠️ Refactor suggestion') || block.includes('_🛠️ Refactor suggestion_')) {
        severity = 'suggestion';
      } else if (block.includes('🧹 Nitpick')) {
        severity = 'info';
      } else if (block.includes('🔒 Security')) {
        severity = 'error';
      }
      
      // Extract AI prompt
      const aiPromptMatch = block.match(/🤖 Prompt for AI Agents[\s\S]*?```\n([\s\S]*?)\n```/);
      const aiPrompt = aiPromptMatch ? aiPromptMatch[1].trim() : undefined;
      
      // Extract committable suggestion
      const committableMatch = block.match(/📝 Committable suggestion[\s\S]*?```suggestion\n([\s\S]*?)\n```/);
      const committableSuggestion = committableMatch ? committableMatch[1].trim() : undefined;
      
      // Extract file path from the block
      const filePathMatch = block.match(/`([^`]+\.(js|ts|tsx|jsx|py|java|cpp|c|h|go|rs|rb|php|cs|kt|swift))`/);
      const filePath = filePathMatch ? filePathMatch[1] : undefined;
      
      // Extract line range
      const lineRangeMatch = block.match(/lines? (\d+(?:-\d+)?)/i);
      const lineRange = lineRangeMatch ? lineRangeMatch[1] : undefined;
      
      // Extract description (remove markdown formatting)
      const descLines = block.split('\n').filter(line => 
        line.trim() && 
        !line.includes('⚠️') && 
        !line.includes('🛠️') && 
        !line.includes('🤖 Prompt') &&
        !line.includes('📝 Committable') &&
        !line.trim().startsWith('<') &&
        !line.trim().startsWith('```') &&
        !line.trim().startsWith('---') &&
        line.trim() !== 'suggestion'
      );
      
      let description = descLines.slice(0, 2).join(' ').trim();
      description = description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1');
      
      if (description && (aiPrompt || committableSuggestion || filePath)) {
        comments.push({
          category,
          severity,
          description: description || 'CodeRabbit suggestion',
          ai_prompt: aiPrompt,
          committable_suggestion: committableSuggestion,
          file_path: filePath,
          line_range: lineRange
        });
      }
    }
  }
  
  return {
    actionable_comments: actionableCount,
    duplicate_comments: duplicateCount,
    nitpick_comments: nitpickCount,
    summary,
    comments,
    files_reviewed: filesReviewed,
    configuration_used: configuration,
    review_profile: reviewProfile
  };
}

/**
 * Get detailed information about a specific CodeRabbit review
 */
export async function getReviewDetails(
  input: GetReviewDetailsInput,
  githubClient: GitHubClient
): Promise<CodeRabbitReviewDetails> {
  // Validate input
  const validatedInput = GetReviewDetailsSchema.parse(input);
  const { owner, repo, pullNumber, reviewId } = validatedInput;
  
  try {
    // Get all reviews for the PR
    const reviews: GitHubReview[] = await githubClient.getPullRequestReviews(owner, repo, pullNumber);
    
    // Find the specific CodeRabbit review
    const targetReview = reviews.find(review => 
      review.id === reviewId && review.user.login === 'coderabbitai[bot]'
    );
    
    if (!targetReview) {
      throw new Error(`CodeRabbit review with ID ${reviewId} not found in PR #${pullNumber}`);
    }
    
    // Parse the review body for detailed information
    const parsed = parseCoderabbitReviewBodyDetailed(targetReview.body);
    
    const reviewDetails: CodeRabbitReviewDetails = {
      id: targetReview.id,
      submitted_at: targetReview.submitted_at,
      html_url: targetReview.html_url,
      state: targetReview.state,
      commit_id: targetReview.commit_id,
      body: targetReview.body,
      parsed_content: {
        actionable_comments: parsed.actionable_comments,
        duplicate_comments: parsed.duplicate_comments,
        nitpick_comments: parsed.nitpick_comments,
        summary: parsed.summary,
        comments: parsed.comments
      },
      files_reviewed: parsed.files_reviewed,
      configuration_used: parsed.configuration_used,
      review_profile: parsed.review_profile
    };
    
    return reviewDetails;
    
  } catch (error) {
    throw new Error(`Failed to get review details: ${error instanceof Error ? error.message : String(error)}`);
  }
}