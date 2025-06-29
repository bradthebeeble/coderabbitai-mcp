# CodeRabbit MCP Server

A Model Context Protocol (MCP) server for interacting with CodeRabbit AI reviews on GitHub pull requests. This server enables Large Language Models (LLMs) to analyze, understand, and implement CodeRabbit suggestions programmatically.

## Features

- **Get CodeRabbit Reviews**: Retrieve all CodeRabbit reviews for a specific pull request
- **Review Details**: Get detailed information about specific reviews including configuration and files reviewed
- **Extract Comments**: Get individual line comments with AI prompts and suggestions
- **Comment Details**: Deep dive into specific comments with context and fix examples
- **Resolve Comments**: Mark comments as addressed, won't fix, or not applicable

## Installation

```bash
npm install
npm run build
```

## Usage

### Starting the Server

```bash
npm start
```

The server runs on stdio transport and can be integrated with MCP-compatible clients.

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

## Integration with GitHub MCP

This server is designed to work alongside a GitHub MCP server. In production, you would:

1. Configure the GitHub MCP server with proper authentication
2. Connect this CodeRabbit MCP server to the GitHub MCP
3. Use both servers together for complete GitHub + CodeRabbit functionality

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

## Limitations

- Requires a configured GitHub MCP server for full functionality
- Comment resolution uses GitHub issue comments (API limitations)
- Search scope limited to recent pull requests for comment lookup

## License

MIT