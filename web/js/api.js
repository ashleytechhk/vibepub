// VibePub API Helper
const API_BASE = '/api';

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  return res.json();
}

async function apiPost(path, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers, body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw { status: res.status, ...json };
  return json;
}

async function apiGetAuth(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}
