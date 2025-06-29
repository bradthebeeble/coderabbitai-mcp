---
name: coderabbit
description: Automated CodeRabbit review processing and issue resolution
---

I'll process CodeRabbit reviews for the current branch systematically. Here's my optimized workflow:

## **Phase 1: Discovery & Assessment**

1. **Find open PR** for current branch
2. **Get CodeRabbit review summary** from `get_coderabbit_reviews` (use summary data, avoid large comment responses)
3. **Extract actionable items** from review body using actionable_comments count and summary
4. **Create todo list** with prioritized issues from review summary (avoid calling `get_review_comments` initially due to token limits)

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
4. **Get individual comment details** only when needed using `get_comment_details`
5. **Resolve each comment** with `resolve_comment` including fix details

## **Phase 5: Completion**

- Mark all todos as completed
- Report final status: "Ready to merge" or list remaining issues
- Provide summary of all fixes applied

## **Error Handling for Large Responses:**

If `get_review_comments` exceeds token limits:
1. Extract actionable items from review summary instead
2. Parse review body for specific file/line mentions
3. Use targeted `get_comment_details` for individual issues
4. Work from review metadata rather than full comment dump

Let me start the process: