# CodeRabbit MCP Server

A Model Context Protocol (MCP) server for interacting with CodeRabbit AI reviews on GitHub pull requests. This server enables Large Language Models (LLMs) to analyze, understand, and implement CodeRabbit suggestions programmatically.

## Features

- **Get CodeRabbit Reviews**: Retrieve all CodeRabbit reviews for a specific pull request
- **Review Details**: Get detailed information about specific reviews including configuration and files reviewed
- **Extract Comments**: Get individual line comments with AI prompts and suggestions
- **Comment Details**: Deep dive into specific comments with context and fix examples
- **Resolve Comments**: Mark comments as addressed, won't fix, or not applicable
- **Automated Workflow Prompt**: Use `/coderabbit-review` slash command for complete review processing

## Quick Start

### Installation (NPX - Recommended)

No installation required! Run directly with npx:

```bash
# Install the latest stable version explicitly
npx coderabbitai-mcp@latest
```

### Prerequisites

1. **GitHub Personal Access Token**: Create at <https://github.com/settings/tokens>
   - Required scopes: `repo` (for private repos) or `public_repo` (for public only)
2. **Node.js 18+**: Required for running the server

<details>
<summary>Configuration</summary>

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "coderabbitai": {
      "command": "npx",
      "args": ["coderabbitai-mcp"],
      "env": {
        "GITHUB_PAT": "ghp_your_token_here"
      }
    }
  }
}
```

### Claude Code

Add to your project's `.claude/config.json`:

```json
{
  "mcpServers": {
    "coderabbitai": {
      "command": "npx",
      "args": ["coderabbitai-mcp"],
      "env": {
        "GITHUB_PAT": "ghp_your_token_here"
      }
    }
  }
}
```

</details>

## Usage

### Automated Review Processing (Recommended)

Use the built-in MCP prompt for complete workflow automation:

```text
/coderabbit-review owner:bradthebeeble repo:wiseguys pullNumber:15
```

This prompt automatically:
- Finds and analyzes CodeRabbit reviews
- Classifies issues by priority (high/medium/low)
- Gets your approval before making changes
- Systematically implements fixes
- Marks resolved comments in CodeRabbit
- Provides a completion summary

### Manual Tool Usage

<details>
<summary>Available Tools</summary>

#### 1. `get_coderabbit_reviews`
Get all CodeRabbit reviews for a specific pull request.

```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys", 
  "pullNumber": 15
}
```

#### 2. `get_review_details`
Get detailed information about a specific CodeRabbit review.

```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys",
  "pullNumber": 15,
  "reviewId": 2969007538
}
```

#### 3. `get_review_comments`
Get all individual line comments from CodeRabbit reviews.

```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys",
  "pullNumber": 15,
  "reviewId": 2969007538
}
```

#### 4. `get_comment_details`
Get detailed information about a specific CodeRabbit comment.

```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys",
  "commentId": 2173534099
}
```

#### 5. `resolve_comment`
Mark a CodeRabbit comment as resolved.

```json
{
  "owner": "bradthebeeble", 
  "repo": "wiseguys",
  "commentId": 2173534099,
  "resolution": "addressed",
  "note": "Implemented asyncHandler wrapper as suggested"
}
```

</details>

<details>
<summary>Development Installation</summary>

For development or local customization:

```bash
git clone https://github.com/bradthebeeble/coderabbitai-mcp.git
cd coderabbitai-mcp
npm install
npm run build
```

### Development Commands

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Clean build files
npm run clean

# Test the server
npm test
```

</details>

<details>
<summary>Environment Variables</summary>

Create a `.env` file (optional):

```bash
# GitHub Configuration (shorter variable name)
GITHUB_PAT=ghp_your_token_here

# Optional: CodeRabbit MCP Configuration
CODERABBIT_LOG_LEVEL=info
```

</details>

<details>
<summary>Troubleshooting</summary>

### Common Issues

**Server not loading (NPX):**
- Verify Node.js 18+ is installed: `node --version`
- Test npx execution manually: `npx coderabbitai-mcp` 
- Check your internet connection (npx downloads the latest version)

**GitHub API errors:**
- Verify your GitHub token has the required permissions
- Check that you have access to the repositories you're querying

**No CodeRabbit reviews found:**
- Verify the PR has CodeRabbit reviews (check GitHub web interface)
- Ensure you're using the correct owner/repo/pullNumber

### Debug Mode

Enable debug logging:

```bash
CODERABBIT_LOG_LEVEL=debug npx coderabbitai-mcp
```

</details>

## Integration Requirements

### Supported AI Clients

- **Claude Desktop**: Full support with configuration
- **Claude Code**: Project-level MCP integration with `/coderabbit-review` prompt
- **Other MCP Clients**: Any client supporting the Model Context Protocol

### Authentication

The GitHub Personal Access Token needs these permissions:
- `repo` (for private repositories) or `public_repo` (for public only)
- `read:org` (if accessing organization repositories)

## Architecture

- **TypeScript**: Fully typed implementation with Zod validation
- **MCP SDK**: Built on the official Model Context Protocol SDK
- **Modular Design**: Each tool is implemented in its own module
- **MCP Prompts**: Automated workflows available as slash commands

## API Rate Limits

The server respects GitHub's API rate limits:
- 5,000 requests/hour for authenticated requests
- Automatically handles rate limit responses

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the build: `npm run build`
5. Submit a pull request

## License

MIT

## Support

- **Issues**: [GitHub Issues](https://github.com/bradthebeeble/coderabbitai-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bradthebeeble/coderabbitai-mcp/discussions)
- **Documentation**: Full examples available in [EXAMPLES.md](./EXAMPLES.md)