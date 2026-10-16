import * as vscode from 'vscode';
import { DEFAULT_PROFILES, detectLocalAnthropicProfile } from '../constants';
import { ClaudeSettings, Profile } from '../types';

const KEY = 'claudeConfig.profiles';
const ACTIVE = 'claudeConfig.active';
const secretName = (id: string) => `claudeConfig.apiKey.${id}`;
/** Pseudo profile id for the key that overrides every profile. */
export const OVERRIDE_KEY_ID = 'override';

/**
 * Profiles are persisted WITHOUT apiKey. Keys live in VS Code SecretStorage
 * (OS keychain) and are mirrored in memory so the rest of the code stays synchronous.
 */
export class ProfileStorage {
  private keys: Record<string, string> = {};

  constructor(private ctx: vscode.ExtensionContext) {}

  /** Load keys from SecretStorage and migrate any plain-text keys left in global state. */
  async init(): Promise<void> {
    const raw = this.ctx.globalState.get<Profile[]>(KEY) ?? DEFAULT_PROFILES;
    const detectedAnthropic = detectLocalAnthropicProfile();
    for (const p of raw) {
      if (p.id === 'anthropic' && p.model === 'claude-sonnet-4-5') {
        p.model = detectedAnthropic.model;
      }
      if (p.apiKey) { await this.setKey(p.id, p.apiKey); }
    }
    for (const id of [...raw.map(p => p.id), OVERRIDE_KEY_ID]) {
      if (this.keys[id] === undefined) {
        const s = await this.ctx.secrets.get(secretName(id));
        if (s) { this.keys[id] = s; }
      }
    }
    await this.save(raw); // rewrites state without apiKey
  }

  key(id: string): string { return this.keys[id] ?? ''; }

  async setKey(id: string, key: string) {
    if (key) {
      this.keys[id] = key;
      await this.ctx.secrets.store(secretName(id), key);
    } else {
      await this.deleteKey(id);
    }
  }

  async deleteKey(id: string) {
    delete this.keys[id];
    await this.ctx.secrets.delete(secretName(id));
  }

  list(): Profile[] {
    const raw = this.ctx.globalState.get<Profile[]>(KEY) ?? DEFAULT_PROFILES;
    return raw.map(p => ({ ...p, apiKey: this.keys[p.id] ?? '' }));
  }
  async save(profiles: Profile[]) {
    await this.ctx.globalState.update(KEY, profiles.map(p => ({ ...p, apiKey: '' })));
  }
  activeId(): string | undefined { return this.ctx.globalState.get<string>(ACTIVE); }
  async setActive(id: string) { await this.ctx.globalState.update(ACTIVE, id); }
  active(): Profile | undefined { return this.list().find(p => p.id === this.activeId()); }
  patch(): ClaudeSettings { return this.ctx.globalState.get<ClaudeSettings>('claudeConfig.patch') ?? {}; }
  async setPatch(p: ClaudeSettings) { await this.ctx.globalState.update('claudeConfig.patch', p); }
}
