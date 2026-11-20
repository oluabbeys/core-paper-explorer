/**
 * Production build: requests go to `/v3/...` on the same origin as the app.
 * CORE's API does not send CORS headers, so browsers block direct calls from
 * other sites. The host must forward `/v3/*` to https://api.core.ac.uk/v3/*
 * (ready-made rules are in vercel.json and netlify.toml).
 */
export const environment = {
  apiBase: '/v3',
};
