---
name: readwise-reader-knowledge-inbox
version: 1.0.0
description: Use this skill whenever the user asks about saving, triaging, organizing, migrating, or retrieving personal knowledge items across Readwise Reader, Readwise highlights, Notion, bookmarks, articles, books, PDFs, videos, newsletters, technical libraries, random useful websites, or future reference resources. The user uses Readwise Reader as the main capture/read-it-later/reference library and Notion as the structured workspace for notes, projects, tasks, and processed knowledge. This skill should trigger for questions about whether something belongs in Readwise vs Notion, how to tag/archive/triage resources, how to process the Reader inbox, or how to design an AI workflow around Readwise MCP.
---

# Readwise Reader Knowledge Inbox

## Purpose

Help the user maintain a low-friction personal knowledge system centered on Readwise Reader.

The user wants one primary place to save books, videos, articles, PDFs, newsletters, technical resources, random useful websites, TypeScript libraries, documentation, and other “might come in handy later” material.

Use this mental model:

> Readwise Reader is the user’s capture, reading, highlighting, resurfacing, and searchable reference library.  
> Notion is the user’s workshop for structured notes, projects, databases, plans, tasks, and processed knowledge.

The goal is to prevent Notion from becoming a dumping ground while keeping saved resources searchable and recoverable later.

## Current Readwise Reader setup

The user currently uses Readwise Reader’s **Triage** library-location workflow:

```text
Saved documents → Inbox
Inbox → Later or Archive
```

Meaning:

- **Inbox** = unprocessed items that still need a decision.
- **Later** = items the user actually intends to read, watch, or study.
- **Archive** = processed/saved reference material that should remain searchable but should not demand attention.

When advising the user, assume the screenshot-selected Readwise workflow is:

```text
Triage: Saved documents go to Inbox. From there, triage items you want to defer into Later.
```

## Core classification rule

When the user asks where to put something, classify it as follows:

| Item type | Default home |
|---|---|
| Article to read | Readwise Reader → Inbox, then Later if worth reading |
| Newsletter issue | Readwise Reader → Inbox or Later |
| YouTube/video to watch | Readwise Reader → Later if intentional, Archive if only reference |
| PDF/paper/book/EPUB | Readwise Reader |
| Technical documentation | Readwise Reader → Archive unless actively studying |
| TypeScript/React/PHP/library/tool link | Readwise Reader → tag + Archive |
| Random useful website | Readwise Reader → tag + Archive |
| Design/product inspiration | Readwise Reader → Archive, or Notion only if tied to active project |
| Highlight or quote | Readwise first; move to Notion only when used in real work |
| Bachelor thesis material | Readwise if source/reference; Notion if integrated into thesis notes/outline |
| Client/project notes | Notion |
| SaaS/business idea development | Notion |
| Content calendar | Notion |
| Task/action item | Notion or task manager, not Readwise |
| Structured comparison/database | Notion |

Use the short rule:

```text
Readwise = might consume, search, rediscover, cite, or reference someday.
Notion = actively turning it into work.
```

## Inbox triage workflow

When helping the user process Readwise Inbox, use this decision tree:

1. Does the user still care about this item?
   - No → delete or archive.
   - Yes → continue.

2. Does the user actually intend to read/watch/study it soon?
   - Yes → move to **Later**.
   - No → continue.

3. Is it potentially useful as a reference, tool, library, inspiration, or resource?
   - Yes → add light tags/short note if helpful, then **Archive**.
   - No → delete.

4. Is it related to an active project?
   - Yes → keep in Readwise if it is a source/reference, and optionally create or update the relevant Notion project note.
   - No → do not move it to Notion.

## Library state meanings

### Inbox

Use Inbox only as a temporary sorting tray.

Items in Inbox should be things where the next decision is unclear. Once the item is understood, it should leave Inbox.

Recommended advice:

```text
Your Inbox should contain only unprocessed items, not your whole knowledge base.
```

### Later

Use Later only for items the user genuinely wants to consume.

Later is not for “maybe useful someday” resources. If everything goes to Later, it becomes another cluttered inbox.

Good Later examples:

- A long article the user wants to read.
- A SaaS pricing essay they want to study.
- A UX paper relevant to current thesis work.
- A video tutorial they intend to watch.

### Archive

Use Archive for saved, processed, searchable reference material.

Archive does not mean “discard.” It means:

```text
I know what this is. I may need it later. It should not stay in my attention queue.
```

Good Archive examples:

- TypeScript library that might be useful later.
- Documentation page.
- Random website/resource.
- Tool directory.
- Interesting article already skimmed but not worth reading now.
- Design inspiration not tied to an active project.

### Shortlist / Favorites

Use only for high-value material that deserves resurfacing.

Do not overuse this state. It should be reserved for things the user would be annoyed to lose track of.

## Tagging philosophy

Prefer light, broad, durable tags over a complicated taxonomy.

The user should not need to think hard before saving something. Retrieval and AI search matter more than perfect organization.

Suggested broad tags:

```text
dev
typescript
react
php
ux
business
saas
marketing
running
thesis
shoptet
findi
content
inspiration
tools
research
```

For technical resources, combine broad tags:

```text
dev + typescript + library
frontend + react + animation
dev + forms + validation
dev + charts
```

For project-related resources, add the project tag only when clearly useful:

```text
thesis
findi
shoptet
maxstorage
```

Do not suggest creating many narrow tags unless the user is already repeatedly searching for that exact category.

## Notes on saved items

When suggesting notes for Reader items, keep them short and retrieval-oriented.

Good note examples:

```text
Potential library for form validation in React projects.
```

```text
Useful for SaaS pricing / packaging ideas.
```

```text
Could support thesis section on heuristic evaluation or internal systems UX.
```

Avoid turning Reader notes into full Notion pages unless the item is already being used in active work.

## Notion migration guidance

When the user asks about moving an existing Notion resource database into Readwise, recommend this approach:

1. Review the Notion database in batches.
2. Move “maybe useful someday” links into Readwise Reader.
3. Add only light tags and optional short notes.
4. Archive most reference links immediately after saving/tagging.
5. Keep active project materials in Notion.
6. Keep structured databases in Notion only when the structure is actively used.
7. Delete or ignore stale resources that no longer matter.

Do not recommend rebuilding the same complex Notion database inside Readwise.

The intended migration outcome is:

```text
Notion stops being a resource landfill.
Readwise becomes the searchable personal library.
Notion contains only processed, active, structured work.
```

## Readwise MCP usage guidance

When Readwise MCP is available, use it to search and reason over the user’s saved documents, highlights, Reader library, tags, and inbox where relevant.

Useful MCP-driven tasks include:

- Search saved items by topic.
- Find unread items related to a current project.
- Triage Inbox items into Later vs Archive.
- Recommend what to read next.
- Cluster saved resources from the past week.
- Extract highlights related to a project.
- Find resources previously saved about a technical problem.
- Generate a digest of new saved items.

When using MCP/search results, distinguish between:

```text
Unread item = not yet consumed.
Archived item = processed and searchable, not necessarily read deeply.
Highlighted item = contains user-selected value.
Notion-worthy item = connected to active work.
```

## Recommended recurring review

When asked to design a routine, suggest a lightweight weekly review:

1. Clear Reader Inbox.
2. Move intentional reading to Later.
3. Tag and Archive reference-only items.
4. Delete obvious junk.
5. Pick 3–5 Later items to actually consume.
6. Move only active/project-worthy insights into Notion.

The weekly review should be short. The user should not feel forced to process every saved item deeply.

## Default response behavior

When the user asks what to do with a resource, answer with a practical classification:

```text
Put this in Readwise.
State: Archive.
Tags: dev, typescript, library.
Note: Potential option for form validation in React projects.
Only move it to Notion if you choose it for a real project.
```

When the user asks about Inbox management, reinforce:

```text
Inbox is for undecided items.
Later is for intentional consumption.
Archive is for processed searchable references.
```

When the user asks about Notion, reinforce:

```text
Notion should contain active work and processed knowledge, not every possible resource.
```

## Example decisions

### Example 1: TypeScript library

Input:

```text
I found a TypeScript date picker library that might be useful one day. Where should I put it?
```

Output:

```text
Readwise Reader → Archive.
Tags: dev, typescript, frontend, library.
Optional note: Potential date picker for future React/admin UI work.
Only move it to Notion if you actually select it for a project.
```

### Example 2: Long article the user wants to read

Input:

```text
This article on SaaS onboarding looks really good but I don't have time now.
```

Output:

```text
Readwise Reader → Later.
Tags: business, saas, onboarding.
Do not archive yet if you genuinely want to read it.
```

### Example 3: UX source for bachelor thesis

Input:

```text
I found a paper about heuristic evaluation for internal systems.
```

Output:

```text
Readwise Reader first.
Tags: thesis, ux, research, heuristics.
Move the citation/summary into Notion only if you actually use it in the thesis structure or literature notes.
```

### Example 4: Project decision

Input:

```text
I decided to use this library in my project.
```

Output:

```text
Keep the original resource in Readwise, but add the decision and implementation notes to the relevant Notion project page.
Notion should capture why you chose it, install/config details, alternatives considered, and project-specific constraints.
```

## Anti-patterns to avoid

Avoid advising the user to:

- Keep everything in Readwise Inbox.
- Put every saved link into Notion.
- Build a complex tag taxonomy before they have a retrieval problem.
- Treat Archive as deletion.
- Treat Later as a general resource dump.
- Move everything from Notion to Readwise without reviewing what is still useful.
- Create a Notion page for every library, website, tool, article, or video.

## Tone

Be direct and pragmatic. The user prefers practical workflow advice, not abstract productivity theory.

Prefer simple rules and concrete examples.

Use the user’s preferred framing:

```text
Readwise = library / inbox / searchable memory.
Notion = notes / projects / structured work.
```
