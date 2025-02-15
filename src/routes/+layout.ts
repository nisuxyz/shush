import { injectAnalytics } from "@vercel/analytics/sveltekit";
import { dev } from "$app/environment";

export const ssr = false;

export const config = {
  isr: {
    expiration: 60,
  },
};

injectAnalytics({ mode: dev ? "development" : "production" });
