import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  Tool,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Import tool implementations
import { getCoderabbitReviews, GetCoderabbitReviewsInput } from "./tools/get-reviews.js";
import { getReviewDetails, GetReviewDetailsInput } from "./tools/get-review-details.js";
import { getReviewComments, GetReviewCommentsInput } from "./tools/get-comments.js";
import { getCommentDetails, GetCommentDetailsInput } from "./tools/get-comment-details.js";
import { resolveComment, ResolveCommentInput } from "./tools/resolve-comment.js";
import { resolveConversation, ResolveConversationInput } from "./tools/resolve-conversation.js";
import { GitHubClient } from "./github-client.js";

/**
 * CodeRabbit MCP Server
 * 
 * Provides tools for interacting with CodeRabbit AI reviews on GitHub pull requests
 */
class CodeRabbitMCPServer {
  private server: Server;
  private githubClient: GitHubClient;

  constructor() {
    this.server = new Server(
      {
        name: "coderabbitai-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    // Initialize GitHub client with environment variable
    try {
      this.githubClient = new GitHubClient();
    } catch (error) {
      console.error("Failed to initialize GitHub client:", error);
      console.error("Please ensure GITHUB_PAT environment variable is set");
      throw error;
    }

    this.setupToolHandlers();
    this.setupPromptHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupPromptHandlers(): void {
    // Handle prompt listing
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: "coderabbit-review",
            description: "Automated CodeRabbit review processing and issue resolution for the current branch",
            arguments: [
              {
                name: "owner",
                description: "Repository owner (username or organization)",
                required: true
              },
              {
                name: "repo", 
                description: "Repository name",
                required: true
              },
              {
                name: "pullNumber",
                description: "Pull request number to process",
                required: true
              }
            ]
          }
        ] as Prompt[]
      };
    });

    // Handle prompt execution
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "coderabbit-review") {
        const owner = args?.owner || "";
        const repo = args?.repo || "";
        const pullNumber = args?.pullNumber || "";

        const promptText = `I'll process CodeRabbit reviews for this pull request systematically. Here's my optimized workflow:

## **Phase 1: Discovery & Assessment**

1. **Find open PR** for current branch
2. **Get CodeRabbit review summary** from \`get_coderabbit_reviews\` (use summary data, avoid large comment responses)
3. **Extract actionable items** from review body using actionable_comments count and summary
4. **Create todo list** with prioritized issues from review summary (avoid calling \`get_review_comments\` initially due to token limits)

## **Phase 2: Issue Classification**

**Assessment Guidelines:**
- **HIGH PRIORITY (Must Fix):**
  - Security vulnerabilities
  - Breaking changes or bugs
  - TypeScript/compilation errors
  - Performance issues with significant impact
  - Logic errors or incorrect implementations

- **MEDIUM PRIORITY (Should Fix):**
  - Type safety improvements
  - Performance optimizations (moderate impact)
  - Code maintainability issues
  - Missing error handling

- **LOW PRIORITY (Nice to Have):**
  - Style/formatting nitpicks
  - Code organization suggestions
  - Minor optimizations
  - Documentation improvements

- **SKIP (Not Actionable):**
  - Purely subjective style preferences
  - Suggestions without clear benefit
  - Comments that require significant architecture changes
  - Out-of-scope recommendations

## **Phase 3: User Approval**

Present the categorized todo list to the user for approval before starting work:
- Show issue priorities and brief descriptions
- Ask user to confirm which issues to address
- Allow user to modify priorities or skip items

## **Phase 4: Implementation**

For approved issues:
1. **Work on HIGH priority items first**
2. **Use TodoWrite to track progress** (mark in_progress, then completed)
3. **Apply fixes systematically** by reading files and making targeted edits
4. **Get individual comment details** only when needed using \`get_comment_details\`
5. **Resolve each comment** with \`resolve_comment\` including fix details

## **Phase 5: Completion**

- Mark all todos as completed
- Report final status: "Ready to merge" or list remaining issues
- Provide summary of all fixes applied

## **Error Handling for Large Responses:**

If \`get_review_comments\` exceeds token limits:
1. Extract actionable items from review summary instead
2. Parse review body for specific file/line mentions
3. Use targeted \`get_comment_details\` for individual issues
4. Work from review metadata rather than full comment dump

${owner && repo && pullNumber ? `\n\nLet me start the process for ${owner}/${repo}#${pullNumber}:` : '\n\nPlease provide the repository owner, repo name, and pull request number to begin processing.'}`;

        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: promptText
              }
            }
          ]
        };
      }

      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown prompt: ${name}`
      );
    });
  }

  private setupToolHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_coderabbit_reviews",
            description: "Get all CodeRabbit reviews for a specific GitHub pull request",
            inputSchema: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner (username or organization)"
                },
                repo: {
                  type: "string", 
                  description: "Repository name"
                },
                pullNumber: {
                  type: "number",
                  description: "Pull request number"
                }
              },
              required: ["owner", "repo", "pullNumber"]
            }
          },
          {
            name: "get_review_details",
            description: "Get detailed information about a specific CodeRabbit review",
            inputSchema: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner (username or organization)"
                },
                repo: {
                  type: "string",
                  description: "Repository name"
                },
                pullNumber: {
                  type: "number",
                  description: "Pull request number"
                },
                reviewId: {
                  type: "number", 
                  description: "Review ID"
                }
              },
              required: ["owner", "repo", "pullNumber", "reviewId"]
            }
          },
          {
            name: "get_review_comments",
            description: "Get all individual line comments from CodeRabbit reviews",
            inputSchema: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner (username or organization)"
                },
                repo: {
                  type: "string",
                  description: "Repository name"
                },
                pullNumber: {
                  type: "number",
                  description: "Pull request number"
                },
                reviewId: {
                  type: "number",
                  description: "Optional: specific review ID to filter comments",
                  optional: true
                }
              },
              required: ["owner", "repo", "pullNumber"]
            }
          },
          {
            name: "get_comment_details",
            description: "Get detailed information about a specific CodeRabbit comment including AI prompts",
            inputSchema: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner (username or organization)"
                },
                repo: {
                  type: "string",
                  description: "Repository name"
                },
                commentId: {
                  type: "number",
                  description: "Comment ID"
                }
              },
              required: ["owner", "repo", "commentId"]
            }
          },
          {
            name: "resolve_comment",
            description: "Mark a CodeRabbit comment as resolved or addressed",
            inputSchema: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner (username or organization)"
                },
                repo: {
                  type: "string",
                  description: "Repository name"
                },
                commentId: {
                  type: "number",
                  description: "Comment ID"
                },
                resolution: {
                  type: "string",
                  enum: ["addressed", "wont_fix", "not_applicable"],
                  description: "Resolution type",
                  default: "addressed"
                },
                note: {
                  type: "string",
                  description: "Optional note about the resolution",
                  optional: true
                }
              },
              required: ["owner", "repo", "commentId"]
            }
          },
          {
            name: "resolve_conversation",
            description: "Resolve or unresolve a CodeRabbit review conversation in GitHub",
            inputSchema: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner (username or organization)"
                },
                repo: {
                  type: "string",
                  description: "Repository name"
                },
                commentId: {
                  type: "number",
                  description: "Comment ID of the conversation to resolve"
                },
                resolved: {
                  type: "boolean",
                  description: "Whether to resolve (true) or unresolve (false) the conversation",
                  default: true
                },
                note: {
                  type: "string",
                  description: "Optional note about the resolution",
                  optional: true
                }
              },
              required: ["owner", "repo", "commentId"]
            }
          }
        ] as Tool[]
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_coderabbit_reviews": {
            const input = args as GetCoderabbitReviewsInput;
            const result = await getCoderabbitReviews(input, this.githubClient);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case "get_review_details": {
            const input = args as GetReviewDetailsInput;
            const result = await getReviewDetails(input, this.githubClient);
            return {
              content: [
                {
                  type: "text", 
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case "get_review_comments": {
            const input = args as GetReviewCommentsInput;
            const result = await getReviewComments(input, this.githubClient);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case "get_comment_details": {
            const input = args as GetCommentDetailsInput;
            const result = await getCommentDetails(input, this.githubClient);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case "resolve_comment": {
            const input = args as ResolveCommentInput;
            const result = await resolveComment(input, this.githubClient);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case "resolve_conversation": {
            const input = args as ResolveConversationInput;
            const result = await resolveConversation(input, this.githubClient);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  /**
   * Validate GitHub token and connection
   */
  async validateGitHubConnection(): Promise<boolean> {
    try {
      const validation = await this.githubClient.validateToken();
      if (validation.valid) {
        console.error(`✅ GitHub connection validated for user: ${validation.user}`);
        console.error(`📋 Token scopes: ${validation.scopes.join(', ')}`);
        return true;
      } else {
        console.error("❌ GitHub token validation failed");
        return false;
      }
    } catch (error) {
      console.error("❌ GitHub connection error:", error);
      return false;
    }
  }

  async run(): Promise<void> {
    // Validate GitHub connection on startup
    const isValid = await this.validateGitHubConnection();
    if (!isValid) {
      console.error("⚠️  GitHub connection validation failed, but server will still start");
      console.error("   Some features may not work properly");
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("🚀 CodeRabbit MCP server running on stdio");
  }
}

export { CodeRabbitMCPServer };