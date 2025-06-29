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

/**
 * Mock GitHub MCP interface for development/testing
 * In production, this would connect to the actual GitHub MCP server
 */
class MockGitHubMCP {
  async get_pull_request_reviews(params: any) {
    throw new Error("GitHub MCP not available - please configure GitHub MCP server");
  }
  
  async get_pull_request_comments(params: any) {
    throw new Error("GitHub MCP not available - please configure GitHub MCP server");
  }
  
  async list_pull_requests(params: any) {
    throw new Error("GitHub MCP not available - please configure GitHub MCP server");
  }
  
  async add_issue_comment(params: any) {
    throw new Error("GitHub MCP not available - please configure GitHub MCP server");
  }
}

/**
 * CodeRabbit MCP Server
 * 
 * Provides tools for interacting with CodeRabbit AI reviews on GitHub pull requests
 */
class CodeRabbitMCPServer {
  private server: Server;
  private githubMcp: MockGitHubMCP;

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

    this.githubMcp = new MockGitHubMCP();
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
            const result = await getCoderabbitReviews(input, this.githubMcp);
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
            const result = await getReviewDetails(input, this.githubMcp);
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
            const result = await getReviewComments(input, this.githubMcp);
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
            const result = await getCommentDetails(input, this.githubMcp);
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
            const result = await resolveComment(input, this.githubMcp);
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
   * Set the GitHub MCP client for production use
   */
  setGitHubMCP(githubMcp: any): void {
    this.githubMcp = githubMcp;
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("CodeRabbit MCP server running on stdio");
  }
}

export { CodeRabbitMCPServer };