/**
 * Development (`ng serve`): requests go to `/v3/...` on the dev server and are
 * forwarded to https://api.core.ac.uk by `proxy.conf.json`. This avoids CORS
 * issues while developing locally.
 */
export const environment = {
  apiBase: '/v3',
};
