import { ClaudeSettings, PermissionMode, Profile } from '../types';

export type ModelSlot = 'main' | 'sonnet' | 'opus' | 'haiku';

/** Values from the editor Settings screen (claudeConfig.override.*). Empty = no override. */
export interface Overrides {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  effortLevel?: string;
  permissionMode?: PermissionMode;
  allow?: string[];
  additionalDirectories?: string[];
  skipDangerousModePermissionPrompt?: boolean;
  theme?: string;
  autoUpdatesChannel?: string;
  extraEnv?: Record<string, string>;
  extraSettings?: Record<string, any>;
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Merge `over` on top of `base`; env and permissions are merged one level deep. */
export function mergeSettings(base: ClaudeSettings, over: ClaudeSettings): ClaudeSettings {
  const out: ClaudeSettings = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = (k === 'env' || k === 'permissions') && isObj(base[k]) && isObj(over[k])
      ? { ...base[k], ...over[k] } : over[k];
  }
  return out;
}

export function profileOverlay(p: Profile): ClaudeSettings {
  const env: Record<string, string> = { ANTHROPIC_BASE_URL: p.baseUrl };
  if (p.apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = p.apiKey;
    env.ANTHROPIC_API_KEY = p.apiKey;
  }
  if (p.model) { env.ANTHROPIC_MODEL = p.model; }

  const o: ClaudeSettings = { env };
  if (p.model) { o.model = p.model; }
  if (p.effortLevel) { o.effortLevel = p.effortLevel; }
  if (p.skipDangerousModePermissionPrompt !== undefined) {
    o.skipDangerousModePermissionPrompt = p.skipDangerousModePermissionPrompt;
  }
  if (p.permissionMode || p.allow) {
    o.permissions = {};
    if (p.permissionMode) { o.permissions.defaultMode = p.permissionMode; }
    if (p.allow) { o.permissions.allow = p.allow; }
  }
  return o;
}

/** Pure patch for picking a model into Claude Code's model slots. */
export function modelPatch(model: string, slots: ModelSlot[]): ClaudeSettings {
  const env: Record<string, string> = {};
  const o: ClaudeSettings = { env };
  if (slots.includes('main')) { o.model = model; env.ANTHROPIC_MODEL = model; }
  if (slots.includes('sonnet')) { env.ANTHROPIC_DEFAULT_SONNET_MODEL = model; }
  if (slots.includes('opus')) { env.ANTHROPIC_DEFAULT_OPUS_MODEL = model; }
  if (slots.includes('haiku')) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
    env.ANTHROPIC_SMALL_FAST_MODEL = model;
  }
  return o;
}

export function overridesToSettings(ov: Overrides): ClaudeSettings {
  const env: Record<string, string> = {};
  const o: ClaudeSettings = { env };
  if (ov.baseUrl) { env.ANTHROPIC_BASE_URL = ov.baseUrl; }
  if (ov.apiKey) { env.ANTHROPIC_AUTH_TOKEN = ov.apiKey; env.ANTHROPIC_API_KEY = ov.apiKey; }
  if (ov.model) { o.model = ov.model; env.ANTHROPIC_MODEL = ov.model; }
  if (ov.effortLevel) { o.effortLevel = ov.effortLevel; }
  if (ov.theme) { o.theme = ov.theme; }
  if (ov.autoUpdatesChannel) { o.autoUpdatesChannel = ov.autoUpdatesChannel; }
  if (ov.skipDangerousModePermissionPrompt !== undefined) {
    o.skipDangerousModePermissionPrompt = ov.skipDangerousModePermissionPrompt;
  }
  const perms: NonNullable<ClaudeSettings['permissions']> = {};
  if (ov.permissionMode) { perms.defaultMode = ov.permissionMode; }
  if (ov.allow?.length) { perms.allow = ov.allow; }
  if (ov.additionalDirectories?.length) { perms.additionalDirectories = ov.additionalDirectories; }
  if (Object.keys(perms).length) { o.permissions = perms; }
  if (ov.extraEnv) { Object.assign(env, ov.extraEnv); }
  return ov.extraSettings && isObj(ov.extraSettings) ? mergeSettings(o, ov.extraSettings) : o;
}

/** profile < model-picker patch < Settings screen overrides */
export function composeOverlay(p: Profile, patch: ClaudeSettings, ov: Overrides): ClaudeSettings {
  return mergeSettings(mergeSettings(profileOverlay(p), patch), overridesToSettings(ov));
}
