/**
 * Dual ChatGPT Accounts Extension
 *
 * Registers an `openai-codex-personal` provider so you can use a second
 * ChatGPT subscription alongside the built-in `openai-codex` (work) provider.
 *
 * Usage:
 *   1. /reload (or restart pi)
 *   2. /login openai-codex-personal  →  browser opens, authenticate with
 *      your personal ChatGPT account
 *   3. Switch between accounts via /model:
 *      - openai-codex/gpt-5.1          →  work
 *      - openai-codex-personal/gpt-5.1 →  personal
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";

// =============================================================================
// PKCE helpers (cross-platform Web Crypto — works in Node 20+ and Bun)
// =============================================================================

function base64urlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
	const verifierBytes = new Uint8Array(32);
	crypto.getRandomValues(verifierBytes);
	const verifier = base64urlEncode(verifierBytes);
	const data = new TextEncoder().encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);
	const challenge = base64urlEncode(new Uint8Array(hash));
	return { verifier, challenge };
}

// =============================================================================
// OpenAI Codex OAuth constants
// =============================================================================

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const SCOPE = "openid profile email offline_access";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
const CALLBACK_PORT = 1455;
const CALLBACK_HOST = "127.0.0.1";

// =============================================================================
// Models — mirrors the built-in openai-codex provider
// =============================================================================

const MODELS: Array<{
	id: string;
	name: string;
	reasoning: boolean;
	thinkingLevelMap?: Record<string, string>;
	input: readonly ("text" | "image")[];
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextWindow: number;
	maxTokens: number;
}> = [
	{
		id: "gpt-5.1",
		name: "GPT-5.1",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.1-codex-max",
		name: "GPT-5.1 Codex Max",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.1-codex-mini",
		name: "GPT-5.1 Codex Mini",
		reasoning: true,
		thinkingLevelMap: { minimal: "medium", low: "medium", medium: "medium", high: "high" },
		input: ["text", "image"],
		cost: { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.2",
		name: "GPT-5.2",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text", "image"],
		cost: { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.2-codex",
		name: "GPT-5.2 Codex",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text", "image"],
		cost: { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.3-codex",
		name: "GPT-5.3 Codex",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text", "image"],
		cost: { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.3-codex-spark",
		name: "GPT-5.3 Codex Spark",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.4",
		name: "GPT-5.4",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text", "image"],
		cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.4-mini",
		name: "GPT-5.4 Mini",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text", "image"],
		cost: { input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
	{
		id: "gpt-5.5",
		name: "GPT-5.5",
		reasoning: true,
		thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
		input: ["text", "image"],
		cost: { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
	},
];

// =============================================================================
// OAuth helpers
// =============================================================================

function createState(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function decodeJwt(token: string): Record<string, unknown> | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		return JSON.parse(atob(parts[1] ?? ""));
	} catch {
		return null;
	}
}

function parseAuthorizationInput(input: string): { code?: string; state?: string } {
	const value = input.trim();
	if (!value) return {};

	try {
		const url = new URL(value);
		return {
			code: url.searchParams.get("code") ?? undefined,
			state: url.searchParams.get("state") ?? undefined,
		};
	} catch {
		// not a URL — fall through
	}

	if (value.includes("#")) {
		const [code, state] = value.split("#", 2);
		return { code, state };
	}

	if (value.includes("code=")) {
		const params = new URLSearchParams(value);
		return {
			code: params.get("code") ?? undefined,
			state: params.get("state") ?? undefined,
		};
	}

	return { code: value };
}

function getAccountId(accessToken: string): string | null {
	const payload = decodeJwt(accessToken);
	const auth = payload?.[JWT_CLAIM_PATH] as Record<string, unknown> | undefined;
	const accountId = auth?.chatgpt_account_id;
	return typeof accountId === "string" && accountId.length > 0 ? accountId : null;
}

async function createAuthorizationFlow(originator: string): Promise<{
	verifier: string;
	state: string;
	url: string;
}> {
	const { verifier, challenge } = await generatePKCE();
	const state = createState();
	const url = new URL(AUTHORIZE_URL);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", CLIENT_ID);
	url.searchParams.set("redirect_uri", REDIRECT_URI);
	url.searchParams.set("scope", SCOPE);
	url.searchParams.set("code_challenge", challenge);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("state", state);
	url.searchParams.set("id_token_add_organizations", "true");
	url.searchParams.set("codex_cli_simplified_flow", "true");
	url.searchParams.set("originator", originator);
	return { verifier, state, url: url.toString() };
}

async function exchangeAuthorizationCode(
	code: string,
	verifier: string,
): Promise<{ access: string; refresh: string; expires: number }> {
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			client_id: CLIENT_ID,
			code,
			code_verifier: verifier,
			redirect_uri: REDIRECT_URI,
		}),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(
			`OpenAI token exchange failed (${response.status}): ${text || response.statusText}`,
		);
	}

	const json = (await response.json()) as Record<string, unknown>;
	if (
		typeof json.access_token !== "string" ||
		typeof json.refresh_token !== "string" ||
		typeof json.expires_in !== "number"
	) {
		throw new Error(`OpenAI token exchange response missing fields: ${JSON.stringify(json)}`);
	}

	return {
		access: json.access_token,
		refresh: json.refresh_token,
		expires: Date.now() + json.expires_in * 1000,
	};
}

async function refreshAccessToken(
	refreshToken: string,
): Promise<{ access: string; refresh: string; expires: number }> {
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CLIENT_ID,
		}),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(
			`OpenAI token refresh failed (${response.status}): ${text || response.statusText}`,
		);
	}

	const json = (await response.json()) as Record<string, unknown>;
	if (
		typeof json.access_token !== "string" ||
		typeof json.refresh_token !== "string" ||
		typeof json.expires_in !== "number"
	) {
		throw new Error(`OpenAI token refresh response missing fields: ${JSON.stringify(json)}`);
	}

	return {
		access: json.access_token,
		refresh: json.refresh_token,
		expires: Date.now() + json.expires_in * 1000,
	};
}

// =============================================================================
// Local OAuth callback server
// =============================================================================

async function startLocalOAuthServer(state: string): Promise<{
	close: () => void;
	cancelWait: () => void;
	waitForCode: () => Promise<{ code: string } | null>;
}> {
	// Dynamic import — only available in Node.js / Bun
	const http = await import("node:http");

	let settleWait: ((value: { code: string } | null) => void) | null = null;
	const waitForCodePromise = new Promise<{ code: string } | null>((resolve) => {
		let settled = false;
		settleWait = (value) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
	});

	const server = http.createServer((req, res) => {
		try {
			const url = new URL(req.url ?? "", "http://localhost");

			if (url.pathname !== "/auth/callback") {
				res.statusCode = 404;
				res.setHeader("Content-Type", "text/html; charset=utf-8");
				res.end("Not found — expected /auth/callback");
				return;
			}

			if (url.searchParams.get("state") !== state) {
				res.statusCode = 400;
				res.setHeader("Content-Type", "text/html; charset=utf-8");
				res.end("State mismatch — possible CSRF attempt");
				return;
			}

			const code = url.searchParams.get("code");
			if (!code) {
				res.statusCode = 400;
				res.setHeader("Content-Type", "text/html; charset=utf-8");
				res.end("Missing authorization code");
				return;
			}

			res.statusCode = 200;
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.end(
				"<html><body><h1>Authentication successful!</h1><p>You can close this window and return to pi.</p></body></html>",
			);

			settleWait?.({ code });
		} catch {
			res.statusCode = 500;
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.end("Internal error while processing OAuth callback");
		}
	});

	return new Promise((resolve) => {
		server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
			resolve({
				close: () => server.close(),
				cancelWait: () => settleWait?.(null),
				waitForCode: () => waitForCodePromise,
			});
		});
	});
}

// =============================================================================
// OAuth login flow
// =============================================================================

async function loginOpenAICodexPersonal(
	callbacks: OAuthLoginCallbacks,
): Promise<OAuthCredentials & { accountId?: string }> {
	const { verifier, state, url } = await createAuthorizationFlow("pi-personal");
	const server = await startLocalOAuthServer(state);

	callbacks.onAuth({
		url,
		instructions:
			"A browser window should open. If it doesn't, paste the URL into a browser to log in.",
	});

	let code: string | undefined;

	try {
		// Race: browser callback vs manual input
		let manualCode: string | undefined;
		let manualError: Error | undefined;

		if (callbacks.onManualCodeInput) {
			const manualPromise = callbacks
				.onManualCodeInput()
				.then((input) => {
					manualCode = input;
					server.cancelWait();
				})
				.catch((err: unknown) => {
					manualError = err instanceof Error ? err : new Error(String(err));
					server.cancelWait();
				});

			const result = await server.waitForCode();

			if (manualError) throw manualError;

			if (result?.code) {
				code = result.code; // browser callback won
			} else if (manualCode) {
				const parsed = parseAuthorizationInput(manualCode);
				if (parsed.state && parsed.state !== state) {
					throw new Error("State mismatch");
				}
				code = parsed.code;
			}

			// If still no code, wait for manual promise to fully settle
			if (!code) {
				await manualPromise;
				if (manualError) throw manualError;
				if (manualCode) {
					const parsed = parseAuthorizationInput(manualCode);
					if (parsed.state && parsed.state !== state) {
						throw new Error("State mismatch");
					}
					code = parsed.code;
				}
			}
		} else {
			// Wait for browser callback, then fall back to prompt
			const result = await server.waitForCode();
			if (result?.code) code = result.code;
		}

		// Fallback to prompting the user for the code manually
		if (!code) {
			const input = await callbacks.onPrompt({
				message: "Paste the authorization code (or full redirect URL):",
			});
			const parsed = parseAuthorizationInput(input);
			if (parsed.state && parsed.state !== state) {
				throw new Error("State mismatch");
			}
			code = parsed.code;
		}

		if (!code) throw new Error("Missing authorization code");

		const tokenResult = await exchangeAuthorizationCode(code, verifier);
		const accountId = getAccountId(tokenResult.access);
		if (!accountId) {
			throw new Error("Failed to extract account ID from token — is this a valid ChatGPT account?");
		}

		return {
			access: tokenResult.access,
			refresh: tokenResult.refresh,
			expires: tokenResult.expires,
			accountId,
		};
	} finally {
		server.close();
	}
}

async function refreshOpenAICodexPersonal(
	refreshToken: string,
): Promise<OAuthCredentials & { accountId?: string }> {
	const result = await refreshAccessToken(refreshToken);
	const accountId = getAccountId(result.access);
	if (!accountId) {
		throw new Error("Failed to extract account ID from refreshed token");
	}
	return {
		access: result.access,
		refresh: result.refresh,
		expires: result.expires,
		accountId,
	};
}

// =============================================================================
// Extension entry point
// =============================================================================

export default function (pi: ExtensionAPI): void {
	pi.registerProvider("openai-codex-personal", {
		name: "ChatGPT (Personal)",
		baseUrl: "https://chatgpt.com/backend-api",
		api: "openai-codex-responses",
		models: MODELS,
		oauth: {
			name: "ChatGPT (Personal)",
			login: loginOpenAICodexPersonal,
			refreshToken: async (credentials: OAuthCredentials) =>
				refreshOpenAICodexPersonal(credentials.refresh),
			getApiKey: (credentials: OAuthCredentials) => credentials.access,
		},
	});
}
