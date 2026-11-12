# Plan

Local Markdown issues for the approved Rex Agents simplification. No hosted issues were created.

| ID | Title | Status | Labels | Mode |
|----|-------|--------|--------|------|
| 1 | [refactor(rex): simplify parent-led subagents in Rex panes](issues/001-simplify-rex-agents.md) | closed | enhancement, rex-agents | AFK |
| 2 | [refactor(rex): launch normal Pi children and reconnect after parent restart](issues/002-normal-pi-launch-and-reconnect.md) | closed | enhancement, rex-agents | AFK |
| 3 | [refactor(rex): simplify reusable child interaction and inspection](issues/003-reusable-interaction-and-inspection.md) | closed | enhancement, rex-agents | AFK |
| 4 | [feat(rex): show simple transcript-based child usage and cost estimates](issues/004-simple-child-cost-observability.md) | closed | enhancement, rex-agents | AFK |
| 5 | [feat(rex): wake the available parent when children need attention](issues/005-nonblocking-parent-wakeups.md) | closed | enhancement, rex-agents | AFK |

## Dependencies

```text
#1 Epic: simplify parent-led subagents
└─ #2 Normal Pi launch + reconnect
   └─ #3 Reusable interaction + inspection
      └─ #4 Simple cost observability
         └─ #5 Nonblocking parent wake-ups
```

The epic closes only after #2, #3, #4, and #5 close. Keep this table and each issue's status frontmatter synchronized.

## Scope and authorization

The user approved the issue drafts and requested local Markdown instead of GitHub publication. These files record implementation work; creating them does not implement it or change active configuration.
