import { api, clearToken, getToken, setToken } from '../src/lib/api.js';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async ({ type, payload }) => {
    if (type === 'auth:login') {
      const result = await api.login(payload.username, payload.password);
      await setToken(result.token);
      return { user: result.user };
    }
    if (type === 'auth:logout') { await api.logout().catch(() => undefined); await clearToken(); return null; }
    if (type === 'auth:me') { if (!await getToken()) return null; return api.me().catch(async () => { await clearToken(); return null; }); }
    if (!await getToken()) throw new Error('AUTH_REQUIRED');
    if (type === 'track:search') return api.search(payload);
    if (type === 'job:create') return api.createJob(payload.searchId, payload.resultIndex);
    if (type === 'job:get') return api.getJob(payload.jobId);
    if (type === 'job:cancel') return api.cancelJob(payload.jobId);
    if (type === 'job:finalize') {
      const form = new FormData();
      for (const [key, value] of Object.entries(payload.fields)) if (value !== undefined && value !== null) form.append(key, value);
      if (payload.cover) form.append('cover', new Blob([Uint8Array.from(atob(payload.cover.base64), (char) => char.charCodeAt(0))], { type: payload.cover.type }), payload.cover.name);
      return api.finalizeJob(payload.jobId, form);
    }
    throw new Error('Unknown extension message');
  });
});
