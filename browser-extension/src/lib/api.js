export const API_BASE_URL = 'https://music-backend.dvaranir.com/api/v1';
const TOKEN_KEY = 'velesAuthToken';

export async function getToken() { return (await browser.storage.local.get(TOKEN_KEY))[TOKEN_KEY] || null; }
export async function setToken(token) { await browser.storage.local.set({ [TOKEN_KEY]: token }); }
export async function clearToken() { await browser.storage.local.remove(TOKEN_KEY); }

async function request(path, { method = 'GET', body, token, formData = false } = {}) {
  const activeToken = token === undefined ? await getToken() : token;
  const headers = activeToken ? { authorization: `Bearer ${activeToken}` } : {};
  if (body && !formData) headers['content-type'] = 'application/json';
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body && (formData ? body : JSON.stringify(body)) });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Backend request failed');
  return data;
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password }, token: null }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  search: (track) => request('/searches', { method: 'POST', body: track }),
  createJob: (searchId, resultIndex) => request(`/searches/${searchId}/jobs`, { method: 'POST', body: { resultIndex } }),
  getJob: (jobId) => request(`/jobs/${jobId}`),
  cancelJob: (jobId) => request(`/jobs/${jobId}`, { method: 'DELETE' }),
  finalizeJob: (jobId, form) => request(`/jobs/${jobId}/finalize`, { method: 'POST', body: form, formData: true }),
};
