import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "context-tokens";

function formatInt(n: number): string {
	return Math.round(n).toLocaleString("en-US");
}

function updateContextTokenStatus(ctx: ExtensionContext): void {
	const usage = ctx.getContextUsage?.();
	const used = usage?.tokens;
	const window = ctx.model?.contextWindow;

	if (typeof used !== "number" || used <= 0 || typeof window !== "number" || window <= 0) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return;
	}

	const remaining = Math.max(0, window - used);
	ctx.ui.setStatus(
		STATUS_KEY,
		ctx.ui.theme.fg(
			"dim",
			`ctx ${formatInt(used)}/${formatInt(window)} rem ${formatInt(remaining)}`,
		),
	);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => updateContextTokenStatus(ctx));
	pi.on("model_select", async (_event, ctx) => updateContextTokenStatus(ctx));
	pi.on("message_end", async (_event, ctx) => updateContextTokenStatus(ctx));
	pi.on("agent_end", async (_event, ctx) => updateContextTokenStatus(ctx));
	pi.on("session_compact", async (_event, ctx) => updateContextTokenStatus(ctx));
	pi.on("session_tree", async (_event, ctx) => updateContextTokenStatus(ctx));

	pi.registerCommand("context-tokens", {
		description: "Refresh exact context token count in the footer",
		handler: async (_args, ctx) => {
			updateContextTokenStatus(ctx);
			ctx.ui.notify("Context token footer refreshed", "info");
		},
	});
}
