import * as path from 'path';
import * as vscode from 'vscode';
import { composeOverlay, modelPatch, mergeSettings, Overrides } from './services/configManager';
import { disable, disableAll, enable, isEnabled } from './services/overlayManager';
import { backup, restoreLatest } from './services/backupService';
import { testConnection } from './services/healthChecker';
import { OVERRIDE_KEY_ID, ProfileStorage } from './services/profileStorage';
import { Profile, Scope } from './types';
import { settingsPath } from './utils/pathHelper';

export async function activate(ctx: vscode.ExtensionContext) {
  const store = new ProfileStorage(ctx);
  await store.init();
  const out = vscode.window.createOutputChannel('Claude Config');
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  bar.command = 'claudeConfig.switchProfile';
  const refresh = () => {
    const file = settingsPath(vscode.workspace.getConfiguration('claudeConfig').get<Scope>('scope', 'global'));
    const on = !!file && isEnabled(path.dirname(file));
    bar.text = on ? `$(plug) Claude: ${store.active()?.name ?? 'custom'}` : '$(circle-slash) Claude: default';
    bar.show();
  };
  refresh();

  const scope = (): Scope => vscode.workspace.getConfiguration('claudeConfig').get<Scope>('scope', 'global');
  const target = () => {
    const f = settingsPath(scope());
    if (!f) { vscode.window.showErrorMessage('No workspace folder open for workspace scope.'); }
    return f;
  };

  const pickProfile = async (placeHolder: string) => {
    const pick = await vscode.window.showQuickPick(
      store.list().map(p => ({ label: p.name, description: `${p.baseUrl} · ${p.model}`, p })),
      { placeHolder });
    return pick?.p;
  };

  /** Values typed into the editor Settings screen (claudeConfig.override.*). */
  const readOverrides = (): Overrides => {
    const c = vscode.workspace.getConfiguration('claudeConfig.override');
    const str = (k: string) => c.get<string>(k, '').trim() || undefined;
    const flag = c.get<string>('skipDangerousModePermissionPrompt', 'unset');
    return {
      baseUrl: str('baseUrl'),
      apiKey: store.key(OVERRIDE_KEY_ID) || undefined,
      model: str('model'),
      effortLevel: str('effortLevel'),
      permissionMode: str('permissionMode') as Overrides['permissionMode'],
      allow: c.get<string[]>('allow', []),
      additionalDirectories: c.get<string[]>('additionalDirectories', []),
      skipDangerousModePermissionPrompt: flag === 'unset' ? undefined : flag === 'true',
      theme: str('theme'),
      autoUpdatesChannel: str('autoUpdatesChannel'),
      extraEnv: c.get<Record<string, string>>('extraEnv', {}),
      extraSettings: c.get<Record<string, any>>('extraSettings', {}),
    };
  };

  /** profile < model-picker patch < Settings overrides -> 9router overlay -> settings.json */
  const rebuild = (file: string, p: Profile) => {
    backup(file);
    enable(path.dirname(file), composeOverlay(p, store.patch(), readOverrides()));
    refresh();
  };

  // ---- Model list: fetched from the endpoint, cached, refreshed automatically ----
  type ModelCache = Record<string, { models: string[]; at: number }>;
  const cacheKey = 'claudeConfig.models';
  const cachedModels = (id: string): string[] =>
    (ctx.globalState.get<ModelCache>(cacheKey) ?? {})[id]?.models ?? [];
  /** Profile with Settings-screen endpoint/key overrides applied. */
  const effective = (p: Profile): Profile => {
    const o = readOverrides();
    return { ...p, baseUrl: o.baseUrl ?? p.baseUrl, apiKey: o.apiKey ?? p.apiKey };
  };
  const refreshModels = async (p: Profile) => {
    const r = await testConnection(effective(p));
    if (r.ok) {
      const all = ctx.globalState.get<ModelCache>(cacheKey) ?? {};
      await ctx.globalState.update(cacheKey, { ...all, [p.id]: { models: r.models, at: Date.now() } });
      out.appendLine(`[${new Date().toLocaleTimeString()}] fetched ${r.models.length} models from ${effective(p).baseUrl}`);
    }
    return r;
  };
  const autoRefresh = () => { const p = store.active(); if (p) { void refreshModels(p); } };
  autoRefresh();
  const mins = Math.max(1, vscode.workspace.getConfiguration('claudeConfig').get<number>('refreshMinutes', 10));
  const timer = setInterval(autoRefresh, mins * 60000);
  ctx.subscriptions.push({ dispose: () => clearInterval(timer) });

  const pickModel = (p: Profile) => new Promise<string | undefined>(resolve => {
    const custom: vscode.QuickPickItem = { label: '$(edit) Enter custom model ID...' };
    const current = store.patch().model ?? readOverrides().model ?? p.model;
    const build = (models: string[]): vscode.QuickPickItem[] => [
      ...models.map(m => ({ label: m, description: m === current ? 'current' : undefined })), custom];
    const qp = vscode.window.createQuickPick();
    qp.title = `Models from ${effective(p).baseUrl}`;
    qp.placeholder = 'Select a model (list refreshes automatically)';
    qp.items = build(cachedModels(p.id));
    qp.busy = true;
    let done = false;
    let typing = false;
    const finish = (v?: string) => { if (!done) { done = true; qp.dispose(); resolve(v); } };
    qp.onDidAccept(async () => {
      const s = qp.selectedItems[0];
      if (!s) { return; }
      if (s !== custom) { finish(s.label); return; }
      typing = true;
      qp.hide();
      finish(await vscode.window.showInputBox({ prompt: 'Model ID' }));
    });
    qp.onDidHide(() => { if (!typing) { finish(undefined); } });
    qp.show();
    refreshModels(p).then(r => {
      if (done) { return; }
      qp.busy = false;
      if (r.ok) { qp.items = build(r.models); }
      else { vscode.window.showWarningMessage(`Could not refresh models: ${r.message}`); }
    });
  });

  ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('claudeConfig.override.baseUrl')) { autoRefresh(); }
    if (!e.affectsConfiguration('claudeConfig.override')) { return; }
    if (!vscode.workspace.getConfiguration('claudeConfig').get<boolean>('autoApply', true)) { return; }
    const file = settingsPath(scope());
    const p = store.active();
    if (!file || !p || !isEnabled(path.dirname(file))) { return; }
    try {
      rebuild(file, p);
      vscode.window.setStatusBarMessage('Claude Config: settings applied to settings.json', 4000);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to apply settings: ${err.message}`);
    }
  }));

  ctx.subscriptions.push(
    bar, out,
    vscode.commands.registerCommand('claudeConfig.switchProfile', async () => {
      const p = await pickProfile('Switch Claude Code profile');
      const file = p && target();
      if (!p || !file) { return; }
      try {
        await store.setActive(p.id);
        await store.setPatch({});
        rebuild(file, p);
        void refreshModels(p);
        vscode.window.showInformationMessage(`Claude Code now uses "${p.name}" (${scope()}). Restart Claude Code sessions to apply.`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to apply profile: ${e.message}`);
      }
    }),
    vscode.commands.registerCommand('claudeConfig.disable', async () => {
      const file = target();
      if (!file) { return; }
      const ok = await vscode.window.showWarningMessage(
        'Restore your original Claude Code settings and stop using the custom endpoint?', { modal: true }, 'Restore');
      if (ok !== 'Restore') { return; }
      try {
        const done = disable(path.dirname(file));
        refresh();
        vscode.window.showInformationMessage(done
          ? 'Original Claude Code settings restored. Restart Claude Code sessions. If ANTHROPIC_BASE_URL is set in your OS environment it will still apply.'
          : 'Extension config was not active; nothing to restore.');
      } catch (e: any) {
        vscode.window.showErrorMessage(`Restore failed: ${e.message}`);
      }
    }),
    vscode.commands.registerCommand('claudeConfig.enable', async () => {
      const file = target();
      const p = store.active();
      if (!file) { return; }
      if (!p) { vscode.commands.executeCommand('claudeConfig.switchProfile'); return; }
      try {
        rebuild(file, p);
        vscode.window.showInformationMessage(`Custom config "${p.name}" enabled.`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Enable failed: ${e.message}`);
      }
    }),
    vscode.commands.registerCommand('claudeConfig.setApiKey', async () => {
      const active = store.active();
      const choice = await vscode.window.showQuickPick([
        { label: `Active profile${active ? ` (${active.name})` : ''}`, id: 'profile' },
        { label: 'Override key (wins over every profile)', id: 'override' },
        { label: 'Clear override key', id: 'clear' },
      ], { placeHolder: 'Which API key do you want to set? Keys are stored in your OS keychain.' });
      if (!choice) { return; }
      if (choice.id === 'clear') {
        await store.deleteKey(OVERRIDE_KEY_ID);
      } else {
        if (choice.id === 'profile' && !active) { vscode.window.showWarningMessage('No active profile. Switch to one first.'); return; }
        const key = await vscode.window.showInputBox({ prompt: 'API key', password: true, ignoreFocusOut: true });
        if (key === undefined) { return; }
        await store.setKey(choice.id === 'profile' ? active!.id : OVERRIDE_KEY_ID, key.trim());
      }
      const file = settingsPath(scope());
      const p = store.active();
      if (file && p && isEnabled(path.dirname(file))) { rebuild(file, p); }
      autoRefresh();
      vscode.window.showInformationMessage('API key updated.');
    }),
    vscode.commands.registerCommand('claudeConfig.addProfile', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Profile name' });
      if (!name) { return; }
      const baseUrl = await vscode.window.showInputBox({ prompt: 'Base URL (no /v1)', value: 'http://localhost:20128' });
      if (!baseUrl) { return; }
      const apiKey = await vscode.window.showInputBox({ prompt: 'API key', password: true }) ?? '';
      const model = await vscode.window.showInputBox({ prompt: 'Model (leave blank to select later)' });
      if (model === undefined) { return; }
      const profile: Profile = { id: `${Date.now()}`, name, baseUrl, apiKey: '', model, permissionMode: 'default' };
      await store.setKey(profile.id, apiKey);
      await store.save([...store.list(), profile]);
    }),
    vscode.commands.registerCommand('claudeConfig.deleteProfile', async () => {
      const p = await pickProfile('Delete profile');
      if (p) { await store.save(store.list().filter(x => x.id !== p.id)); await store.deleteKey(p.id); refresh(); }
    }),
    vscode.commands.registerCommand('claudeConfig.testConnection', async () => {
      const p = store.active() ?? await pickProfile('Test which profile?');
      if (!p) { return; }
      const r = await refreshModels(p);
      out.appendLine(r.message);
      if (r.models.length) { out.appendLine(r.models.join('\n')); }
      out.show(true);
      (r.ok ? vscode.window.showInformationMessage : vscode.window.showErrorMessage)(r.message);
    }),
    vscode.commands.registerCommand('claudeConfig.selectModel', async () => {
      const p = store.active() ?? await pickProfile('Fetch models from which profile?');
      const file = p && target();
      if (!p || !file) { return; }
      const model = await pickModel(p);
      if (!model) { return; }
      const slots = await vscode.window.showQuickPick(
        [
          { label: 'Main model', id: 'main' as const, picked: true },
          { label: 'Sonnet slot', id: 'sonnet' as const },
          { label: 'Opus slot', id: 'opus' as const },
          { label: 'Haiku / small-fast slot', id: 'haiku' as const },
        ],
        { canPickMany: true, placeHolder: 'Apply model to...' });
      if (!slots?.length) { return; }
      try {
        await store.setPatch(mergeSettings(store.patch(), modelPatch(model, slots.map(s => s.id))));
        if (slots.some(s => s.id === 'main')) {
          // The Settings-screen override would otherwise win over the picked model.
          await vscode.workspace.getConfiguration('claudeConfig.override')
            .update('model', model, vscode.ConfigurationTarget.Global);
        }
        rebuild(file, p);
        vscode.window.showInformationMessage(`Model "${model}" applied. Restart Claude Code sessions.`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to set model: ${e.message}`);
      }
    }),
    vscode.commands.registerCommand('claudeConfig.openConfig', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'claudeConfig')),
    vscode.commands.registerCommand('claudeConfig.openSettings', async () => {
      const file = target();
      if (file) { await vscode.window.showTextDocument(vscode.Uri.file(file)); }
    }),
    vscode.commands.registerCommand('claudeConfig.restoreBackup', () => {
      const file = target();
      if (!file) { return; }
      const r = restoreLatest(file);
      vscode.window.showInformationMessage(r ? `Restored ${r}` : 'No backup found.');
    }),
  );
}

export function deactivate() {
  // Reload and window close also call deactivate, so this is opt-in only.
  if (vscode.workspace.getConfiguration('claudeConfig').get<boolean>('restoreOnDeactivate', false)) {
    try { disableAll(); } catch { /* ignore */ }
  }
}
