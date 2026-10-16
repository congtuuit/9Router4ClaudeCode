import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PermissionMode, Profile } from './types';

function readJsonSafe(file: string): any {
  try {
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      if (text.trim()) { return JSON.parse(text); }
    }
  } catch {
    // Ignore read or parse errors
  }
  return undefined;
}

/**
 * Dò tìm cấu hình Claude Code hiện tại trên máy (file snapshot gốc, settings.json, hoặc biến môi trường).
 * Nếu tìm thấy thông tin thì điền vào, nếu không thì để trống.
 */
export function detectLocalAnthropicProfile(): Profile {
  const home = os.homedir();
  const claudeDir = path.join(home, '.claude');
  const snapFile = path.join(claudeDir, 'settings.claude.json');
  const liveFile = path.join(claudeDir, 'settings.json');

  const settings = readJsonSafe(snapFile) ?? readJsonSafe(liveFile) ?? {};
  const env = settings.env ?? {};

  // Lấy baseUrl từ máy (nếu có và không phải proxy localhost/9router), fallback sang official endpoint
  let baseUrl = env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || '';
  if (!baseUrl || baseUrl.includes('localhost:20128') || baseUrl.includes('9router')) {
    baseUrl = 'https://api.anthropic.com';
  }

  // Dò API Key từ settings hoặc biến môi trường (bỏ qua nếu là key của 9router)
  let apiKey = env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
  if (apiKey === 'sk-9router') {
    apiKey = '';
  }

  // Dò Model từ settings hoặc biến môi trường, nếu không có thì để trống
  let model = settings.model || env.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || '';
  if (model === 'ag/gemini-3.7-flash-medium') {
    model = '';
  }

  const permissionMode: PermissionMode = settings.permissions?.defaultMode || 'default';

  return {
    id: 'anthropic',
    name: 'Anthropic Official',
    baseUrl,
    apiKey,
    model,
    permissionMode,
  };
}

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: '9router',
    name: '9Router',
    // Claude Code appends /v1/messages itself, so no /v1 suffix here.
    baseUrl: 'http://localhost:20128',
    apiKey: 'sk-9router',
    model: '',
    effortLevel: 'high',
    permissionMode: 'bypassPermissions',
    allow: ['*'],
    skipDangerousModePermissionPrompt: true,
  },
  detectLocalAnthropicProfile(),
];
