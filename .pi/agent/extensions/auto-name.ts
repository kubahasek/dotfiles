/**
 * Auto-name agent threads/sessions based on the first user prompt.
 *
 * Uses GPT-5.3-codex-spark to generate a concise, descriptive name for each
 * session. Falls back to a heuristic truncation if the model is unavailable.
 *
 * Works in interactive mode, RPC/ACP mode, and headless mode.
 *
 * Commands:
 *   /auto-name [name]  - Manually set or trigger AI auto-naming
 *                        (uses current conversation if no argument given)
 *
 * Installation: save to ~/.pi/agent/extensions/auto-name.ts
 */

import { complete, type UserMessage, type Model, type Api } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── Constants ─────────────────────────────────────────────────────

const NAMING_MODEL_PROVIDER = "openai-codex-personal";
const NAMING_MODEL_ID = "gpt-5.3-codex-spark";

const NAMING_SYSTEM_PROMPT =
  "You are a thread-naming assistant. Given a user's first prompt in a conversation, " +
  "generate a concise, descriptive name for the thread. Return ONLY the name — no quotes, " +
  "no explanations, no trailing punctuation. The name must be 60 characters or fewer. " +
  "Capture the core topic, task, or question. Be specific, not generic. " +
  "Examples of good names: 'Fix login redirect bug', 'Add rate limiting to API', " +
  "'Refactor user auth module'.";

/** Names that look like auto-generated defaults — safe to override. */
const DEFAULT_PLACEHOLDER_NAMES = new Set([
  "New agent thread",
  "New session",
  "Untitled",
  "New thread",
]);

/** Track whether we've auto-named the current session (module-level state). */
let hasAutoNamed = false;

// ── Extension ──────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── Reset flag on new session ──────────────────────────────────
  pi.on("session_start", async (_event, _ctx) => {
    hasAutoNamed = false;
  });

  // ── Auto-name on first user prompt ─────────────────────────────
  pi.on("before_agent_start", async (event, ctx) => {
    await tryAutoName(pi, event.prompt?.trim(), ctx);
  });

  // ── Fallback: also try on first user message end ───────────────
  //     This catches ACP/RPC flows where before_agent_start may fire
  //     differently or where the session name was set to a default
  //     placeholder before the first prompt arrives.
  pi.on("message_end", async (event, ctx) => {
    if (hasAutoNamed) return;
    if (event.message.role !== "user") return;

    const promptText = extractTextFromContent(event.message.content);
    await tryAutoName(pi, promptText, ctx);
  });

  // ── Manual auto-name command ───────────────────────────────────
  pi.registerCommand("auto-name", {
    description:
      "Set session name manually, or auto-generate via AI (usage: /auto-name [name])",
    handler: async (args, ctx) => {
      const manualName = args.trim();

      if (manualName) {
        pi.setSessionName(manualName);
        hasAutoNamed = true;
        if (ctx.hasUI) {
          ctx.ui.notify(`Session named: ${manualName}`, "info");
        }
        return;
      }

      // ── AI-generate from the last user message ─────────────────
      const branch = ctx.sessionManager.getBranch();
      const userMessages = branch.filter(
        (
          entry,
        ): entry is {
          type: "message";
          message: { role: string; content?: unknown };
        } => entry.type === "message" && entry.message?.role === "user",
      );

      if (userMessages.length === 0) {
        if (ctx.hasUI) ctx.ui.notify("No user messages to name from", "warning");
        return;
      }

      const lastUserMsg = userMessages[userMessages.length - 1];
      const promptText = extractTextFromContent(lastUserMsg.message.content);
      if (!promptText) {
        if (ctx.hasUI) ctx.ui.notify("Could not extract text from last message", "warning");
        return;
      }

      const name = await generateSessionName(promptText, ctx);
      if (name) {
        pi.setSessionName(name);
        hasAutoNamed = true;
        if (ctx.hasUI) ctx.ui.notify(`Session named: ${name}`, "info");
      } else {
        if (ctx.hasUI) ctx.ui.notify("Could not generate a name", "warning");
      }
    },
  });
}

// ── Core auto-name logic ──────────────────────────────────────────

async function tryAutoName(
  pi: ExtensionAPI,
  prompt: string | undefined,
  ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1],
): Promise<void> {
  if (hasAutoNamed) return;
  if (!prompt) return;

  // Respect manually-set names, but override known default placeholders
  const existingName = pi.getSessionName();
  if (existingName && !DEFAULT_PLACEHOLDER_NAMES.has(existingName)) return;

  const name = await generateSessionName(prompt, ctx);
  if (name) {
    pi.setSessionName(name);
    hasAutoNamed = true;
  }
}

// ── AI-powered name generation ────────────────────────────────────

/**
 * Generate a session name: try AI (GPT-5.3-codex-spark) first, fall back to heuristic.
 */
async function generateSessionName(
  prompt: string,
  ctx: { modelRegistry: { find(provider: string, modelId: string): Model<Api> | undefined; getApiKeyAndHeaders(model: Model<Api>): Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }> } },
): Promise<string | null> {
  // Try AI naming first
  const aiName = await generateAIName(prompt, ctx);
  if (aiName) return aiName;

  // Fall back to heuristic
  return generateHeuristicName(prompt);
}

/**
 * Call GPT-5.3-codex-spark to generate a concise thread name.
 * Returns null if the model is unavailable or the call fails.
 */
async function generateAIName(
  prompt: string,
  ctx: { modelRegistry: { find(provider: string, modelId: string): Model<Api> | undefined; getApiKeyAndHeaders(model: Model<Api>): Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }> } },
): Promise<string | null> {
  try {
    const namingModel = ctx.modelRegistry.find(NAMING_MODEL_PROVIDER, NAMING_MODEL_ID);
    if (!namingModel) return null;

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(namingModel);
    if (!auth.ok || !auth.apiKey) return null;

    const cleanedPrompt = cleanPromptForNaming(prompt);

    const userMessage: UserMessage = {
      role: "user",
      content: [{ type: "text", text: cleanedPrompt }],
      timestamp: Date.now(),
    };

    const response = await complete(
      namingModel,
      {
        systemPrompt: NAMING_SYSTEM_PROMPT,
        messages: [userMessage],
      },
      { apiKey: auth.apiKey, headers: auth.headers },
    );

    const text = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join(" ")
      .trim();

    // Clean up the model output: remove quotes, extra whitespace, trailing dots
    const cleaned = text
      .replace(/^["']|["']$/g, "")
      .replace(/\s+/g, " ")
      .replace(/[.!]+$/, "")
      .trim();

    if (cleaned && cleaned.length > 0) {
      return truncateToLength(cleaned, 60);
    }
  } catch {
    // Silently fall back to heuristic
  }

  return null;
}

// ── Heuristic fallback name generation ────────────────────────────

function generateHeuristicName(prompt: string): string | null {
  // Remove slash commands at the start (/skill:name, /command, etc.)
  let text = prompt.replace(/^\/\S+\s*/, "").trim();
  if (!text) {
    text = prompt.trim();
  }

  // Take the first meaningful line
  const firstLine = text.split("\n")[0]?.trim();
  if (!firstLine) return null;

  return truncateToLength(firstLine, 60);
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Clean a user prompt for use as naming input.
 * Strips slash commands and normalizes whitespace.
 */
function cleanPromptForNaming(prompt: string): string {
  return prompt.replace(/^\/\S+\s*/, "").replace(/\s+/g, " ").trim();
}

/**
 * Truncate text to maxLen, breaking at word boundaries when possible.
 */
function truncateToLength(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const truncated = text.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.6) {
    return truncated.slice(0, lastSpace) + "…";
  }
  return truncated + "…";
}

/**
 * Extract plain text from a message content field.
 * Content can be a string or an array of content blocks.
 */
function extractTextFromContent(content: unknown): string | null {
  if (typeof content === "string") return content.trim() || null;
  if (!Array.isArray(content)) return null;

  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object" && "type" in block) {
      const b = block as { type?: string; text?: string };
      if (b.type === "text" && typeof b.text === "string") {
        parts.push(b.text);
      }
    }
  }
  return parts.length > 0 ? parts.join(" ").trim() : null;
}
