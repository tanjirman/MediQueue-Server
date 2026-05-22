import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "https://medi-queue-server-eight.vercel.app",
});