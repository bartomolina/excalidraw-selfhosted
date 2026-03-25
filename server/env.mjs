import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");

for (const fileName of [".env.local", ".env"]) {
  dotenv.config({ path: path.join(repoRoot, fileName), override: false });
}

const normalizeEmailList = (value, fallback) => {
  const source = value || fallback;
  return source
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

export const env = {
  host: process.env.HOST || "0.0.0.0",
  port: Number.parseInt(process.env.PORT || "5001", 10),
  staticDir: path.resolve(
    process.env.EXCALIDRAW_STATIC_DIR ||
      path.join(repoRoot, "excalidraw-app", "build"),
  ),
  scenesDir: path.resolve(
    process.env.EXCALIDRAW_SCENES_DIR ||
      "/root/.openclaw/workspace/data/excalidraw/scenes",
  ),
  authDbPath: path.resolve(
    process.env.EXCALIDRAW_AUTH_DB_PATH ||
      "/root/.openclaw/workspace/data/excalidraw/auth.sqlite",
  ),
  betterAuthUrl:
    process.env.BETTER_AUTH_URL ||
    process.env.EXCALIDRAW_APP_URL ||
    `http://localhost:${process.env.PORT || "5001"}`,
  betterAuthSecret: process.env.BETTER_AUTH_SECRET || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  authFromEmail: process.env.AUTH_FROM_EMAIL || "",
  allowedEmails: normalizeEmailList(
    process.env.EXCALIDRAW_ALLOWED_EMAILS,
    "bartomolina@gmail.com",
  ),
};

export const ensureRequiredAuthEnv = () => {
  const missing = [];

  if (!env.betterAuthSecret) {
    missing.push("BETTER_AUTH_SECRET");
  }
  if (!env.resendApiKey) {
    missing.push("RESEND_API_KEY");
  }
  if (!env.authFromEmail) {
    missing.push("AUTH_FROM_EMAIL");
  }

  if (missing.length > 0) {
    const error = new Error(
      `Missing required auth environment variables: ${missing.join(", ")}`,
    );
    error.statusCode = 500;
    throw error;
  }
};
