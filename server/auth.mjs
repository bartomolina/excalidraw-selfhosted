import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

import { ensureRequiredAuthEnv, env } from "./env.mjs";

const allowedEmails = new Set(env.allowedEmails);
const resend = new Resend(env.resendApiKey);

const ensureAllowedEmail = (email) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!allowedEmails.has(normalizedEmail)) {
    throw new APIError("UNAUTHORIZED", {
      message: "This email address is not allowed to access this Excalidraw instance.",
    });
  }

  return normalizedEmail;
};

await mkdir(path.dirname(env.authDbPath), { recursive: true });
ensureRequiredAuthEnv();

const database = new DatabaseSync(env.authDbPath);

export const auth = betterAuth({
  appName: "Excalidraw",
  secret: env.betterAuthSecret,
  baseURL: env.betterAuthUrl,
  database,
  trustedOrigins: [env.betterAuthUrl],
  emailAndPassword: {
    enabled: false,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          ensureAllowedEmail(user.email);
          return;
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        const normalizedEmail = ensureAllowedEmail(email);
        await resend.emails.send({
          from: env.authFromEmail,
          to: normalizedEmail,
          subject: "Sign in to Excalidraw",
          html: `
            <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111827;">
              <p>Use the link below to sign in to your Excalidraw instance.</p>
              <p><a href="${url}">Sign in to Excalidraw</a></p>
              <p>This link expires in 15 minutes.</p>
            </div>
          `,
        });
      },
    }),
  ],
});

export const authHandler = toNodeHandler(auth);

export const ensureAuthReady = async () => {
  return;
};

export const getSession = async (req) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  return session;
};

export const requireSession = async (req) => {
  const session = await getSession(req);

  if (!session) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  return session;
};
