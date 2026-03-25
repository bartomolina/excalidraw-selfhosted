import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? "/api/auth"
      : `${window.location.origin}/api/auth`,
  plugins: [magicLinkClient()],
});
