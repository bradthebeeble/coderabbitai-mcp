#!/usr/bin/env node

import { CodeRabbitMCPServer } from "./server.js";

/**
 * Main entry point for the CodeRabbit MCP Server
 */
async function main() {
  // Ensure GITHUB_PERSONAL_ACCESS_TOKEN is set
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    console.error("❌ Error: GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required");
    console.error("   Please set your GitHub Personal Access Token as an environment variable");
    console.error("   Example: export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here");
    process.exit(1);
  }

  const server = new CodeRabbitMCPServer();
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