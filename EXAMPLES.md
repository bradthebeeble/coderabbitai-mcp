# CodeRabbit MCP Server Usage Examples

This document provides practical examples of how to use the CodeRabbit MCP server to interact with CodeRabbit AI reviews.

## Example: Complete Review Analysis Workflow

Here's how you might use Claude Code with the CodeRabbit MCP server to analyze and implement CodeRabbit suggestions:

### 1. Get All CodeRabbit Reviews for a PR

```
User: Show me all CodeRabbit reviews for PR #15 in bradthebeeble/wiseguys

Claude: I'll get all the CodeRabbit reviews for that pull request.

[Uses get_coderabbit_reviews tool]

Found 1 CodeRabbit review:
- Review ID: 2969007538
- Submitted: 2025-06-28T21:43:11Z  
- Status: COMMENTED
- Actionable Comments: 9
- Configuration: CodeRabbit UI (CHILL profile)
```

### 2. Get Detailed Review Information

```
User: Give me the details of that review

Claude: Let me get the detailed information about review 2969007538.

[Uses get_review_details tool]

Review Details:
- Files Reviewed: 10 files including messageController.js, messageService.js, test-messaging.sh
- Actionable Comments: 9
- Duplicate Comments: 1  
- Nitpick Comments: 4
- Comments cover: error handling, initialization patterns, security issues, performance optimizations
```

### 3. Get Specific Comments with AI Prompts

```
User: Show me the specific comments with AI prompts that I can implement

Claude: I'll get all the line comments from this review to see the specific suggestions.

[Uses get_review_comments tool]

Here are the key actionable comments:

1. **Error Handling Issue** (backend/routes/messages.js:34-82)
   - Severity: Warning
   - AI Prompt: "In backend/routes/messages.js from lines 34 to 82, the async route handlers lack error handling, which can cause unhandled promise rejections. To fix this, create an asyncHandler wrapper function that catches errors and passes them to the next middleware..."
   - Committable Code: Shows exact implementation

2. **Initialization Race Condition** (backend/routes/messages.js:6-23)
   - Severity: Warning  
   - AI Prompt: "The MessageController is instantiated at module load time causing race conditions. Remove the controller instantiation and initialization logic from this file. Instead, initialize the MessageController once during server startup..."

3. **Security - ReDoS Attack** (backend/services/messageService.js:213-229)
   - Severity: Warning
   - AI Prompt: "The searchTerm is used directly in a regex without escaping special characters, which can lead to ReDoS attacks. Fix this by sanitizing the searchTerm input..."
```

### 4. Get Deep Details on a Specific Comment

```
User: Get me the full details on that ReDoS security issue

Claude: Let me get the complete details for that security comment.

[Uses get_comment_details tool]

**ReDoS Security Issue - Comment #2173534104**

File: backend/services/messageService.js (lines 213-229)
Severity: Warning (Security)
Category: Potential Issue

**AI Prompt for Implementation:**
"In backend/services/messageService.js around lines 213 to 229, the searchTerm is used directly in a regex without escaping special characters, which can lead to ReDoS attacks. Fix this by sanitizing the searchTerm input: escape all regex special characters before constructing the regex. Additionally, consider refactoring the search to use MongoDB's text search feature instead of regex for improved performance and security."

**File Context:**
```javascript
async searchMessages(groupId, searchTerm, options = {}) {
  const { limit = 20 } = options;

  return await this.messages
    .find({
      groupId,
      isDeleted: false,
      $or: [
        { 'content.text': { $regex: searchTerm, $options: 'i' } },
        { 'content.title': { $regex: searchTerm, $options: 'i' } },
        { 'content.description': { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}
```

**Fix Example:**
```javascript
// Escape special regex characters to prevent ReDoS
const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

return await this.messages.find({
  groupId,
  isDeleted: false,
  $or: [
    { 'content.text': { $regex: escapedSearchTerm, $options: 'i' } },
    { 'content.title': { $regex: escapedSearchTerm, $options: 'i' } },
    { 'content.description': { $regex: escapedSearchTerm, $options: 'i' } }
  ]
})
```

**Related Comments:** [2173534105, 2173534107] (same file, nearby issues)
```

### 5. Implement the Fix

```
User: Implement that ReDoS fix in the code

Claude: I'll implement the ReDoS security fix as suggested by CodeRabbit.

[Claude would then use the Edit tool to implement the fix using the provided AI prompt and code example]

✅ Applied the ReDoS security fix:
- Added regex escaping function  
- Sanitized searchTerm before using in MongoDB regex
- Prevents potential ReDoS attacks from malicious search input

The fix has been implemented in backend/services/messageService.js:213-229
```

### 6. Mark Comment as Resolved

```
User: Mark that ReDoS comment as resolved

Claude: I'll mark the ReDoS security comment as addressed.

[Uses resolve_comment tool]

✅ Comment #2173534104 has been marked as resolved
- Resolution: addressed
- Method: Added reply comment to PR #15
- Message: "Added resolution comment to PR #15"

The resolution has been tracked and a comment was added to the pull request indicating that this security issue has been addressed.
```

## Advanced Usage Patterns

### Batch Processing All Comments

```python
# Pseudo-code for processing all CodeRabbit comments
reviews = get_coderabbit_reviews(owner, repo, pr_number)
for review in reviews:
    comments = get_review_comments(owner, repo, pr_number, review.id)
    for comment in comments:
        if comment.ai_prompt and comment.severity in ['error', 'warning']:
            details = get_comment_details(owner, repo, comment.id)
            # Implement the fix using the AI prompt
            # Mark as resolved
            resolve_comment(owner, repo, comment.id, 'addressed')
```

### Filtering by Severity

```python
# Get only high-priority security and error comments
comments = get_review_comments(owner, repo, pr_number)
critical_comments = [c for c in comments if c.severity in ['error'] or 'security' in c.category.lower()]
```

### Integration with Development Workflow

```bash
# Example workflow script
# 1. Get CodeRabbit reviews
# 2. Filter for actionable items  
# 3. Implement fixes
# 4. Mark as resolved
# 5. Create commit with fixes

for comment_id in $(get_actionable_comments); do
  details=$(get_comment_details $comment_id)
  implement_fix "$details.ai_prompt" "$details.file_path" 
  resolve_comment $comment_id "addressed" "Implemented via automated workflow"
done
```

## Benefits

1. **Conversational Code Review**: Discuss CodeRabbit suggestions naturally with Claude
2. **Guided Implementation**: Get step-by-step guidance on implementing fixes
3. **Context Preservation**: Maintain full context about file locations and related issues
4. **Progress Tracking**: Mark suggestions as resolved and track progress
5. **Batch Processing**: Handle multiple suggestions efficiently
6. **Learning Tool**: Understand why changes are suggested and learn best practices
