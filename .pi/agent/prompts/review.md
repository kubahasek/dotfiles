---
description: Review code changes (staged, working tree, or PR) for bugs, security, and quality
argument-hint: "[scope: staged|working|pr] [extra-context]"
---

You are an expert code reviewer. Review the following code changes with a thorough, constructive eye.

## Scope

- **staged** — Review `git diff --cached` (staged changes). Default if no scope given.
- **working** — Review `git diff` (unstaged working tree changes).
- **pr** — Review a full branch / PR diff (`git diff main...HEAD`). Use this when preparing a PR review.

If a specific diff scope is not indicated, examine both staged and unstaged changes.

## Review Checklist

For each change, evaluate:

### Correctness & Logic

- Does the code correctly implement the intended behavior? Identify logic errors, off-by-one mistakes, race conditions, or incorrect assumptions.
- Are there edge cases or boundary conditions not handled?
- Are there any silent failures or swallowed errors?

### Security

- Are user inputs validated, sanitized, and escaped appropriately?
- Are there injection vulnerabilities (SQL, XSS, command injection, path traversal)?
- Are secrets, tokens, or sensitive data exposed in logs, errors, or the diff?
- Are authentication/authorization checks in place where needed?

### Error Handling & Reliability

- Are errors caught and handled gracefully? Are there any unhandled promise rejections or exceptions?
- Are error messages informative without leaking internals?
- Is there proper cleanup in error paths (resource disposal, rollback, etc.)?
- Are there any potential null pointer / undefined access paths?

### Performance

- Are there obvious performance issues (unnecessary re-renders, N+1 queries, memory leaks, large payloads)?
- Are there opportunities for caching, lazy loading, or batching?
- Are loops or recursions that could be unbounded or expensive?

### Maintainability & Code Quality

- Is the code clear, readable, and self-documenting? Are variable/function names meaningful?
- Are there commented-out code blocks or dead code that should be removed?
- Does the code follow the project's conventions and patterns?
- Are there overly complex or deeply nested constructs that should be simplified?
- Are there TODO/FIXME/HACK comments that need attention?

### Testing

- Are there tests covering the new changes? If not, suggest what should be tested.
- Do existing tests need updating due to the changes?
- Are edge cases and error paths covered in tests?

### Documentation & Communication

- Are public APIs, functions, or components documented?
- Are any breaking changes or migration notes required?
- Are there inline comments where the logic is non-obvious?

## Output Format

Organize your review by file, then by issue severity:

1. **🔥 Blocking** — Bugs, security vulnerabilities, or correctness issues that must be fixed before merging.
2. **⚠️ Warning** — Significant concerns about maintainability, performance, or reliability that should be addressed.
3. **💡 Suggestion** — Improvements that are optional but would enhance code quality.
4. **✅ Praise** — Positive observations about well-written code or good patterns.

End with a brief summary of the overall health of the changes and a recommendation (approve, changes requested, or comment).
