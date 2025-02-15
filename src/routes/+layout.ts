import { injectAnalytics } from "@vercel/analytics/sveltekit";
import { dev } from "$app/environment";
import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";

export const ssr = false;

export const config = {
  isr: {
    expiration: 60,
  },
};

injectAnalytics({ mode: dev ? "development" : "production" });
injectSpeedInsights();
