import { Profile } from '../types';

export async function testConnection(p: Profile): Promise<{ ok: boolean; message: string; models: string[] }> {
  const base = (p.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '').replace(/\/v1$/, '');
  const url = `${base}/v1/models`;
  try {
    const res = await fetch(url, {
      headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}`, 'x-api-key': p.apiKey } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) { return { ok: false, message: `${url} -> HTTP ${res.status}`, models: [] }; }
    const json: any = await res.json().catch(() => ({}));
    const models: string[] = Array.isArray(json.data) ? json.data.map((m: any) => String(m.id)) : [];
    return { ok: true, message: `${url} OK (${models.length} models)`, models };
  } catch (e: any) {
    return { ok: false, message: `${url} unreachable: ${e?.message ?? e}`, models: [] };
  }
}
