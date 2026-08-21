/**
 * Starts approved Plannotator plans in a clean Pi session.
 *
 * Plannotator must use executionMode: "external". Its approved-plan event
 * arrives after planning state has been restored, so this extension can make
 * an isolated implementation thread without mutating the planning thread.
 */

import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ModelRef = { provider: string; id: string };
type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

type ApprovedPlan = {
  cwd: string;
  planFilePath: string;
  planContent: string;
  feedback?: string;
};

const EXECUTION_MODEL: ModelRef = {
  provider: "openai-codex",
  id: "gpt-5.6-luna",
};

const EXECUTION_THINKING: ThinkingLevel = "medium";

function kickoffPrompt(plan: ApprovedPlan): string {
  const feedback = plan.feedback?.trim();

  return [
    "Implement approved plan below. Work through every unchecked step.",
    "Inspect current code before edits. Run plan verification. Report files changed and test results.",
    `Plan file: ${plan.planFilePath}`,
    feedback ? `Approval notes:\n${feedback}` : undefined,
    "## Approved plan",
    plan.planContent.trim(),
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export default function plannotatorExecutionHandoff(pi: ExtensionAPI): void {
  const pendingHandoffs = new Map<string, { plan: ApprovedPlan; prompt: string }>();

  pi.events.on("plannotator:plan-approved", async (data) => {
    const plan = data as Partial<ApprovedPlan> | null;
    if (
      !plan ||
      typeof plan.cwd !== "string" ||
      typeof plan.planFilePath !== "string" ||
      typeof plan.planContent !== "string" ||
      !plan.planContent.trim()
    ) {
      return;
    }

    const prompt = kickoffPrompt(plan as ApprovedPlan);
    const handoffId = randomUUID();
    pendingHandoffs.set(handoffId, { plan: plan as ApprovedPlan, prompt });

    // The extension API cannot expose session controls from event handlers.
    // Queue a dedicated command. It runs after current turn is idle and can
    // safely create replacement session with requested model.
    pi.sendUserMessage(`/plannotator-implement ${handoffId}`, { deliverAs: "followUp" });
  });

  pi.registerCommand("plannotator-implement", {
    description: "Internal: start approved Plannotator plan in execution session",
    handler: async (args, ctx) => {
      const payload = pendingHandoffs.get(args.trim());
      if (!payload) {
        ctx.ui.notify("Plannotator handoff: invalid approved-plan payload.", "error");
        return;
      }
      pendingHandoffs.delete(args.trim());

      const targetModel = ctx.modelRegistry.find(EXECUTION_MODEL.provider, EXECUTION_MODEL.id);
      if (!targetModel) {
        ctx.ui.notify(
          `Plannotator handoff: model ${EXECUTION_MODEL.provider}/${EXECUTION_MODEL.id} not found.`,
          "error",
        );
        return;
      }

      const parentSession = ctx.sessionManager.getSessionFile();
      const result = await ctx.newSession({
        parentSession,
        setup: async (session) => {
          session.appendModelChange(targetModel.provider, targetModel.id);
          session.appendThinkingLevelChange(EXECUTION_THINKING);
          session.appendSessionInfo(`Implement: ${basename(payload.plan.planFilePath)}`);
        },
        withSession: async (replacementCtx) => {
          await replacementCtx.sendUserMessage(payload.prompt);
        },
      });

      if (result.cancelled) {
        ctx.ui.notify("Plannotator handoff: new session cancelled.", "info");
      }
    },
  });
}
