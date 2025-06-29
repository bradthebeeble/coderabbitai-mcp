import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Import tool implementations
import { getCoderabbitReviews, GetCoderabbitReviewsInput } from "./tools/get-reviews.js";
import { getReviewDetails, GetReviewDetailsInput } from "./tools/get-review-details.js";
import { getReviewComments, GetReviewCommentsInput } from "./tools/get-comments.js";
import { getCommentDetails, GetCommentDetailsInput } from "./tools/get-comment-details.js";
import { resolveComment, ResolveCommentInput } from "./tools/resolve-comment.js";
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
        },
      }
    );

    // Initialize GitHub client with environment variable
    try {
      this.githubClient = new GitHubClient();
    } catch (error) {
      console.error("Failed to initialize GitHub client:", error);
      console.error("Please ensure GITHUB_PERSONAL_ACCESS_TOKEN environment variable is set");
      throw error;
    }

    this.setupToolHandlers();
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