/**
 * Switch Pi's Vercel theme to match the current macOS appearance at startup.
 *
 * macOS returns "Dark" for dark mode and exits non-zero for light mode.
 */

import { execFileSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LIGHT_THEME = "vercel-light";
const DARK_THEME = "vercel-dark";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const themeName = isSystemDarkMode() ? DARK_THEME : LIGHT_THEME;
    const result = ctx.ui.setTheme(themeName);

    if (!result.success) {
      ctx.ui.notify(`Failed to apply ${themeName}: ${result.error}`, "warning");
    }
  });
}

function isSystemDarkMode(): boolean {
  if (process.platform !== "darwin") return false;

  try {
    return execFileSync("defaults", ["read", "-g", "AppleInterfaceStyle"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .toLowerCase() === "dark";
  } catch {
    return false;
  }
}
