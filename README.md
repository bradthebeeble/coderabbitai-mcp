# CodeRabbit MCP Server

A Model Context Protocol (MCP) server for interacting with CodeRabbit AI reviews on GitHub pull requests. This server enables Large Language Models (LLMs) to analyze, understand, and implement CodeRabbit suggestions programmatically.

## Features

- **Get CodeRabbit Reviews**: Retrieve all CodeRabbit reviews for a specific pull request
- **Review Details**: Get detailed information about specific reviews including configuration and files reviewed
- **Extract Comments**: Get individual line comments with AI prompts and suggestions
- **Comment Details**: Deep dive into specific comments with context and fix examples
- **Resolve Comments**: Mark comments as addressed, won't fix, or not applicable

## Installation

### Prerequisites

1. **GitHub Personal Access Token**: Required for GitHub API access
2. **Node.js 18+**: Required for running the server

### Install Dependencies

```bash
git clone https://github.com/bradthebeeble/coderabbitai-mcp.git
cd coderabbitai-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    },
    "coderabbitai": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/coderabbitai-mcp"
    }
  }
}
```

### Claude Code

Add to your project's `.claude/config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    },
    "coderabbitai": {
      "command": "node", 
      "args": ["dist/index.js"],
      "cwd": "/path/to/coderabbitai-mcp"
    }
  }
}
```

### Environment Variables

Create a `.env` file (optional):

```bash
# GitHub Configuration (handled by GitHub MCP)
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token_here

# CodeRabbit MCP Configuration
CODERABBIT_LOG_LEVEL=info
```

### Docker (Alternative)

```bash
# Build the image
docker build -t coderabbitai-mcp .

# Run with Docker Compose
docker run --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=your_token \
  coderabbitai-mcp
```

## Usage

### Prerequisites

1. **GitHub MCP Server**: This server requires the GitHub MCP server to be running alongside it
2. **GitHub Access**: Ensure your GitHub token has access to the repositories you want to analyze

### Starting the Server

The server is automatically started by your MCP client (Claude Desktop/Code) when configured properly.

For manual testing:

```bash
npm start
```

The server runs on stdio transport and integrates with MCP-compatible clients.

### Available Tools

#### 1. `get_coderabbit_reviews`

Get all CodeRabbit reviews for a specific pull request.

**Input:**
```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys", 
  "pullNumber": 15
}
```

**Output:**
```json
[
  {
    "id": 2969007538,
    "submitted_at": "2025-06-28T21:43:11Z",
    "html_url": "https://github.com/bradthebeeble/wiseguys/pull/15#pullrequestreview-2969007538",
    "state": "COMMENTED",
    "actionable_comments": 9,
    "summary": "Configuration used: CodeRabbit UI, Review profile: CHILL",
    "commit_id": "63e45f6dc32544e76f5bfbf02d8836b2a8a3da07"
  }
]
```

#### 2. `get_review_details`

Get detailed information about a specific CodeRabbit review.

**Input:**
```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys",
  "pullNumber": 15,
  "reviewId": 2969007538
}
```

**Output:**
```json
{
  "id": 2969007538,
  "submitted_at": "2025-06-28T21:43:11Z", 
  "files_reviewed": [
    "backend/controllers/messageController.js",
    "backend/services/messageService.js",
    "test-messaging.sh"
  ],
  "configuration_used": "CodeRabbit UI",
  "review_profile": "CHILL",
  "parsed_content": {
    "actionable_comments": 9,
    "duplicate_comments": 1,
    "nitpick_comments": 4,
    "comments": [...]
  }
}
```

#### 3. `get_review_comments`

Get all individual line comments from CodeRabbit reviews.

**Input:**
```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys",
  "pullNumber": 15,
  "reviewId": 2969007538
}
```

**Output:**
```json
[
  {
    "id": 2173534099,
    "path": "backend/routes/messages.js",
    "line_range": { "start": 34, "end": 82 },
    "severity": "warning",
    "category": "Potential Issue", 
    "description": "Add error handling for async route handlers to prevent unhandled promise rejections",
    "ai_prompt": "In backend/routes/messages.js from lines 34 to 82, the async route handlers lack error handling...",
    "committable_suggestion": "router.post('/', async (req, res, next) => { ... })",
    "is_resolved": true
  }
]
```

#### 4. `get_comment_details`

Get detailed information about a specific CodeRabbit comment.

**Input:**
```json
{
  "owner": "bradthebeeble",
  "repo": "wiseguys",
  "commentId": 2173534099
}
```

**Output:**
```json
{
  "id": 2173534099,
  "path": "backend/routes/messages.js",
  "line_range": { "start": 34, "end": 82 },
  "severity": "warning",
  "category": "Potential Issue",
  "description": "Add error handling for async route handlers",
  "ai_prompt": "In backend/routes/messages.js from lines 34 to 82, the async route handlers lack error handling, which can cause unhandled promise rejections. To fix this, create an asyncHandler wrapper function...",
  "file_context": "File: backend/routes/messages.js\n\nrouter.post('/', async (req, res) => {\n  await messageController.createMessage(req, res);\n});",
  "fix_examples": [
    "router.post('/', async (req, res, next) => {\n  try {\n    await messageController.createMessage(req, res);\n  } catch (error) {\n    next(error);\n  }\n});"
  ],
  "related_comments": [2173534100, 2173534101]
}
```

#### 5. `resolve_comment`

Mark a CodeRabbit comment as resolved.

**Input:**
```json
{
  "owner": "bradthebeeble", 
  "repo": "wiseguys",
  "commentId": 2173534099,
  "resolution": "addressed",
  "note": "Implemented asyncHandler wrapper as suggested"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Added resolution comment to PR #15",
  "comment_id": 2173534099,
  "resolution_method": "reply"
}
```

## Quick Start

1. **Get a GitHub Token**: Create a Personal Access Token at https://github.com/settings/tokens
2. **Install the Server**: Follow the installation steps above
3. **Configure Your AI Client**: Add both GitHub and CodeRabbit MCP servers to your configuration
4. **Start Using**: Ask your AI assistant to analyze CodeRabbit reviews!

Example prompt:
```
Show me all CodeRabbit reviews for PR #15 in bradthebeeble/wiseguys, then get the details of any comments that have AI prompts I can implement.
```

## Integration Requirements

### GitHub MCP Server

This server **requires** the [GitHub MCP Server](https://github.com/github/github-mcp-server) to function. The CodeRabbit MCP server uses the GitHub MCP to:

- Fetch pull request reviews
- Get individual comments 
- Access repository information
- Post resolution comments

### Supported AI Clients

- **Claude Desktop**: Full support with configuration
- **Claude Code**: Project-level MCP integration
- **Other MCP Clients**: Any client supporting the Model Context Protocol

### Authentication

The GitHub Personal Access Token needs these permissions:
- `repo` (for private repositories) or `public_repo` (for public only)
- `read:org` (if accessing organization repositories)

## Complete Setup Example

Here's a complete working configuration for Claude Desktop:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    },
    "coderabbitai": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/Users/yourname/coderabbitai-mcp"
    }
  }
}
```

After configuration:
1. Restart Claude Desktop
2. Verify both servers are loaded (check Claude Desktop logs)
3. Test with a simple query: "List CodeRabbit reviews for a recent PR"

## Example Workflow

1. **Browse Reviews**: Use `get_coderabbit_reviews` to see all CodeRabbit feedback on a PR
2. **Analyze Comments**: Use `get_review_comments` to get actionable suggestions  
3. **Get Implementation Guidance**: Use `get_comment_details` to get AI prompts for specific fixes
4. **Implement Changes**: Use the AI prompts and committable suggestions to make code changes
5. **Mark as Resolved**: Use `resolve_comment` to track which suggestions have been addressed

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Clean build files
npm run clean
```

## Architecture

- **TypeScript**: Fully typed implementation with Zod validation
- **MCP SDK**: Built on the official Model Context Protocol SDK
- **Modular Design**: Each tool is implemented in its own module
- **Error Handling**: Comprehensive error handling and validation
- **GitHub Integration**: Designed to work with GitHub MCP servers

## Troubleshooting

### Common Issues

**Server not loading:**
- Verify Node.js 18+ is installed: `node --version`
- Check that the path in `cwd` is correct
- Ensure `npm run build` was executed successfully

**GitHub API errors:**
- Verify your GitHub token has the required permissions
- Check that the GitHub MCP server is properly configured
- Ensure you have access to the repositories you're querying

**No CodeRabbit reviews found:**
- Verify the PR has CodeRabbit reviews (check GitHub web interface)
- Ensure CodeRabbit bot has reviewed the specific PR
- Check that you're using the correct owner/repo/pullNumber

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# For GitHub MCP
GITHUB_API_DEBUG=true

# For CodeRabbit MCP  
CODERABBIT_LOG_LEVEL=debug
```

### Logs

**Claude Desktop logs:**
- macOS: `~/Library/Logs/Claude/mcp*.log`
- Windows: `%APPDATA%/Claude/logs/mcp*.log`

**Manual server logs:**
```bash
npm start 2>&1 | tee coderabbit-mcp.log
```

## API Rate Limits

The server respects GitHub's API rate limits:
- 5,000 requests/hour for authenticated requests
- Uses the same limits as the GitHub MCP server
- Automatically handles rate limit responses

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the build: `npm run build`
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/bradthebeeble/coderabbitai-mcp.git
cd coderabbitai-mcp
npm install
npm run dev  # Watch mode for development
```

## Limitations

- Requires a configured GitHub MCP server for full functionality
- Comment resolution uses GitHub issue comments (API limitations)
- Search scope limited to recent pull requests for comment lookup
- Only supports CodeRabbit reviews (not other bot reviews)

## Roadmap

- [ ] Support for GitHub Enterprise Server
- [ ] Direct GitHub API integration (remove GitHub MCP dependency)
- [ ] CodeRabbit webhook integration for real-time updates
- [ ] Advanced filtering and search capabilities
- [ ] Integration with other code review bots

## License

MIT

## Support

- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/bradthebeeble/coderabbitai-mcp/issues)
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/bradthebeeble/coderabbitai-mcp/discussions)
- **Documentation**: Full examples available in [EXAMPLES.md](./EXAMPLES.md)