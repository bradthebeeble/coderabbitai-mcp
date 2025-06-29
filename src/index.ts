#!/usr/bin/env node

import { CodeRabbitMCPServer } from "./server.js";

/**
 * Main entry point for the CodeRabbit MCP Server
 */
async function main() {
  const server = new CodeRabbitMCPServer();
  
  // In a production environment, you would configure the GitHub MCP client here
  // For example:
  // const githubMcp = new GitHubMCPClient();
  // server.setGitHubMCP(githubMcp);
  
  await server.run();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('Failed to start CodeRabbit MCP server:', error);
  process.exit(1);
});