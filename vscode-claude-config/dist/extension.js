"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var path5 = __toESM(require("path"));
var vscode2 = __toESM(require("vscode"));

// src/services/configManager.ts
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function mergeSettings(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = (k === "env" || k === "permissions") && isObj(base[k]) && isObj(over[k]) ? { ...base[k], ...over[k] } : over[k];
  }
  return out;
}
function profileOverlay(p) {
  const env = p.baseUrl ? { ANTHROPIC_BASE_URL: p.baseUrl } : {};
  if (p.apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = p.apiKey;
    env.ANTHROPIC_API_KEY = p.apiKey;
  }
  if (p.model) {
    env.ANTHROPIC_MODEL = p.model;
  }
  const o = { env };
  if (p.model) {
    o.model = p.model;
  }
  if (p.effortLevel) {
    o.effortLevel = p.effortLevel;
  }
  if (p.skipDangerousModePermissionPrompt !== void 0) {
    o.skipDangerousModePermissionPrompt = p.skipDangerousModePermissionPrompt;
  }
  if (p.permissionMode || p.allow) {
    o.permissions = {};
    if (p.permissionMode) {
      o.permissions.defaultMode = p.permissionMode;
    }
    if (p.allow) {
      o.permissions.allow = p.allow;
    }
  }
  return o;
}
function modelPatch(model, slots) {
  const env = {};
  const o = { env };
  if (slots.includes("main")) {
    o.model = model;
    env.ANTHROPIC_MODEL = model;
  }
  if (slots.includes("sonnet")) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
  }
  if (slots.includes("opus")) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
  }
  if (slots.includes("haiku")) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
    env.ANTHROPIC_SMALL_FAST_MODEL = model;
  }
  return o;
}
function overridesToSettings(ov) {
  const env = {};
  const o = { env };
  if (ov.baseUrl) {
    env.ANTHROPIC_BASE_URL = ov.baseUrl;
  }
  if (ov.apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = ov.apiKey;
    env.ANTHROPIC_API_KEY = ov.apiKey;
  }
  if (ov.model) {
    o.model = ov.model;
    env.ANTHROPIC_MODEL = ov.model;
  }
  if (ov.effortLevel) {
    o.effortLevel = ov.effortLevel;
  }
  if (ov.theme) {
    o.theme = ov.theme;
  }
  if (ov.autoUpdatesChannel) {
    o.autoUpdatesChannel = ov.autoUpdatesChannel;
  }
  if (ov.skipDangerousModePermissionPrompt !== void 0) {
    o.skipDangerousModePermissionPrompt = ov.skipDangerousModePermissionPrompt;
  }
  const perms = {};
  if (ov.permissionMode) {
    perms.defaultMode = ov.permissionMode;
  }
  if (ov.allow?.length) {
    perms.allow = ov.allow;
  }
  if (ov.additionalDirectories?.length) {
    perms.additionalDirectories = ov.additionalDirectories;
  }
  if (Object.keys(perms).length) {
    o.permissions = perms;
  }
  if (ov.extraEnv) {
    Object.assign(env, ov.extraEnv);
  }
  return ov.extraSettings && isObj(ov.extraSettings) ? mergeSettings(o, ov.extraSettings) : o;
}
function composeOverlay(p, patch, ov) {
  return mergeSettings(mergeSettings(profileOverlay(p), patch), overridesToSettings(ov));
}

// src/services/overlayManager.ts
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var LIVE = "settings.json";
var SNAP = "settings.claude.json";
var OVERLAY = "settings.9router.json";
var STATE = "settings.9router.state.json";
var MERGED_KEYS = ["env", "permissions"];
var registryFile = () => path.join(os.homedir(), ".claude", "settings.9router.registry.json");
var isObj2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function readJson(file) {
  if (!fs.existsSync(file)) {
    return void 0;
  }
  const text = fs.readFileSync(file, "utf8");
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}
function writeAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", { encoding: "utf8", mode: 384 });
  fs.renameSync(tmp, file);
}
function merge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = MERGED_KEYS.includes(k) && isObj2(base[k]) && isObj2(over[k]) ? { ...base[k], ...over[k] } : over[k];
  }
  return out;
}
function foldEdits(current, last, overlay, snapshot) {
  const snap = { ...snapshot };
  for (const k of Object.keys(current)) {
    if (eq(current[k], last[k])) {
      continue;
    }
    if (MERGED_KEYS.includes(k) && isObj2(current[k])) {
      const sub = isObj2(snap[k]) ? { ...snap[k] } : {};
      const prev = isObj2(last[k]) ? last[k] : {};
      const ov = isObj2(overlay[k]) ? overlay[k] : {};
      for (const s of Object.keys(current[k])) {
        if (s in ov) {
          continue;
        }
        if (!eq(current[k][s], prev[s])) {
          sub[s] = current[k][s];
        }
      }
      snap[k] = sub;
    } else if (!(k in overlay)) {
      snap[k] = current[k];
    }
  }
  return snap;
}
function register(dir) {
  const f = registryFile();
  const list = readJson(f)?.dirs ?? [];
  if (!list.includes(dir)) {
    writeAtomic(f, { dirs: [...list, dir] });
  }
}
function readState(dir) {
  return readJson(path.join(dir, STATE)) ?? { existed: false, enabled: false };
}
function readOverlay(dir) {
  return readJson(path.join(dir, OVERLAY)) ?? {};
}
function isEnabled(dir) {
  return readState(dir).enabled;
}
function enable(dir, overlay) {
  const live = path.join(dir, LIVE);
  const snapFile = path.join(dir, SNAP);
  const state = readState(dir);
  const current = readJson(live);
  let snapshot = readJson(snapFile);
  if (!snapshot || !state.enabled) {
    snapshot = current ?? {};
    state.existed = current !== void 0;
  } else if (current && state.lastOutput) {
    snapshot = foldEdits(current, state.lastOutput, readOverlay(dir), snapshot);
  }
  writeAtomic(snapFile, snapshot);
  if (overlay) {
    writeAtomic(path.join(dir, OVERLAY), overlay);
  }
  const merged = merge(snapshot, overlay ?? readOverlay(dir));
  writeAtomic(live, merged);
  state.enabled = true;
  state.lastOutput = merged;
  writeAtomic(path.join(dir, STATE), state);
  register(dir);
}
function disable(dir) {
  const state = readState(dir);
  if (!state.enabled) {
    return false;
  }
  const live = path.join(dir, LIVE);
  const snapFile = path.join(dir, SNAP);
  let snapshot = readJson(snapFile) ?? {};
  const current = readJson(live);
  if (current && state.lastOutput) {
    snapshot = foldEdits(current, state.lastOutput, readOverlay(dir), snapshot);
  }
  if (!state.existed && Object.keys(snapshot).length === 0) {
    if (fs.existsSync(live)) {
      fs.rmSync(live);
    }
  } else {
    writeAtomic(live, snapshot);
  }
  writeAtomic(snapFile, snapshot);
  state.enabled = false;
  delete state.lastOutput;
  writeAtomic(path.join(dir, STATE), state);
  return true;
}
function disableAll() {
  const dirs = readJson(registryFile())?.dirs ?? [];
  for (const d of dirs) {
    try {
      disable(d);
    } catch {
    }
  }
}

// src/services/backupService.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
function backup(file) {
  if (!fs2.existsSync(file)) {
    return void 0;
  }
  const dest = `${file}.bak.${Date.now()}`;
  fs2.copyFileSync(file, dest);
  return dest;
}
function restoreLatest(file) {
  const dir = path2.dirname(file);
  const base = path2.basename(file) + ".bak.";
  if (!fs2.existsSync(dir)) {
    return void 0;
  }
  const baks = fs2.readdirSync(dir).filter((f) => f.startsWith(base)).sort();
  const latest = baks[baks.length - 1];
  if (!latest) {
    return void 0;
  }
  fs2.copyFileSync(path2.join(dir, latest), file);
  return latest;
}

// src/services/healthChecker.ts
async function testConnection(p) {
  const base = (p.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "").replace(/\/v1$/, "");
  const url = `${base}/v1/models`;
  try {
    const res = await fetch(url, {
      headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}`, "x-api-key": p.apiKey } : {},
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) {
      return { ok: false, message: `${url} -> HTTP ${res.status}`, models: [] };
    }
    const json = await res.json().catch(() => ({}));
    const models = Array.isArray(json.data) ? json.data.map((m) => String(m.id)) : [];
    return { ok: true, message: `${url} OK (${models.length} models)`, models };
  } catch (e) {
    return { ok: false, message: `${url} unreachable: ${e?.message ?? e}`, models: [] };
  }
}

// src/constants.ts
var fs3 = __toESM(require("fs"));
var os2 = __toESM(require("os"));
var path3 = __toESM(require("path"));
function readJsonSafe(file) {
  try {
    if (fs3.existsSync(file)) {
      const text = fs3.readFileSync(file, "utf8");
      if (text.trim()) {
        return JSON.parse(text);
      }
    }
  } catch {
  }
  return void 0;
}
function detectLocalAnthropicProfile() {
  const home = os2.homedir();
  const claudeDir = path3.join(home, ".claude");
  const snapFile = path3.join(claudeDir, "settings.claude.json");
  const liveFile = path3.join(claudeDir, "settings.json");
  const settings = readJsonSafe(snapFile) ?? readJsonSafe(liveFile) ?? {};
  const env = settings.env ?? {};
  let baseUrl = env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || "";
  if (!baseUrl || baseUrl.includes("localhost:20128") || baseUrl.includes("9router")) {
    baseUrl = "https://api.anthropic.com";
  }
  let apiKey = env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || "";
  if (apiKey === "sk-9router") {
    apiKey = "";
  }
  let model = settings.model || env.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || "";
  if (model === "ag/gemini-3.7-flash-medium") {
    model = "";
  }
  const permissionMode = settings.permissions?.defaultMode || "default";
  return {
    id: "anthropic",
    name: "Anthropic Official",
    baseUrl,
    apiKey,
    model,
    permissionMode
  };
}
var DEFAULT_PROFILES = [
  {
    id: "9router",
    name: "9Router",
    // Claude Code appends /v1/messages itself, so no /v1 suffix here.
    baseUrl: "http://localhost:20128",
    apiKey: "sk-9router",
    model: "",
    effortLevel: "high",
    permissionMode: "bypassPermissions",
    allow: ["*"],
    skipDangerousModePermissionPrompt: true
  },
  detectLocalAnthropicProfile()
];

// src/services/profileStorage.ts
var KEY = "claudeConfig.profiles";
var ACTIVE = "claudeConfig.active";
var secretName = (id) => `claudeConfig.apiKey.${id}`;
var OVERRIDE_KEY_ID = "override";
var ProfileStorage = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  keys = {};
  /** Load keys from SecretStorage and migrate any plain-text keys left in global state. */
  async init() {
    const raw = this.ctx.globalState.get(KEY) ?? DEFAULT_PROFILES;
    const detectedAnthropic = detectLocalAnthropicProfile();
    for (const p of raw) {
      if (p.id === "anthropic" && p.model === "claude-sonnet-4-5") {
        p.model = detectedAnthropic.model;
      }
      if (p.apiKey) {
        await this.setKey(p.id, p.apiKey);
      }
    }
    for (const id of [...raw.map((p) => p.id), OVERRIDE_KEY_ID]) {
      if (this.keys[id] === void 0) {
        const s = await this.ctx.secrets.get(secretName(id));
        if (s) {
          this.keys[id] = s;
        }
      }
    }
    await this.save(raw);
  }
  key(id) {
    return this.keys[id] ?? "";
  }
  async setKey(id, key) {
    if (key) {
      this.keys[id] = key;
      await this.ctx.secrets.store(secretName(id), key);
    } else {
      await this.deleteKey(id);
    }
  }
  async deleteKey(id) {
    delete this.keys[id];
    await this.ctx.secrets.delete(secretName(id));
  }
  list() {
    const raw = this.ctx.globalState.get(KEY) ?? DEFAULT_PROFILES;
    return raw.map((p) => ({ ...p, apiKey: this.keys[p.id] ?? "" }));
  }
  async save(profiles) {
    await this.ctx.globalState.update(KEY, profiles.map((p) => ({ ...p, apiKey: "" })));
  }
  activeId() {
    return this.ctx.globalState.get(ACTIVE);
  }
  async setActive(id) {
    await this.ctx.globalState.update(ACTIVE, id);
  }
  active() {
    return this.list().find((p) => p.id === this.activeId());
  }
  patch() {
    return this.ctx.globalState.get("claudeConfig.patch") ?? {};
  }
  async setPatch(p) {
    await this.ctx.globalState.update("claudeConfig.patch", p);
  }
};

// src/utils/pathHelper.ts
var os3 = __toESM(require("os"));
var path4 = __toESM(require("path"));
var vscode = __toESM(require("vscode"));
function settingsPath(scope) {
  if (scope === "global") {
    return path4.join(os3.homedir(), ".claude", "settings.json");
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? path4.join(folder.uri.fsPath, ".claude", "settings.json") : void 0;
}

// src/extension.ts
async function activate(ctx) {
  const store = new ProfileStorage(ctx);
  await store.init();
  const out = vscode2.window.createOutputChannel("Claude Config");
  const bar = vscode2.window.createStatusBarItem(vscode2.StatusBarAlignment.Left, 50);
  bar.command = "claudeConfig.switchProfile";
  const refresh = () => {
    const file = settingsPath(vscode2.workspace.getConfiguration("claudeConfig").get("scope", "global"));
    const on = !!file && isEnabled(path5.dirname(file));
    bar.text = on ? `$(plug) Claude: ${store.active()?.name ?? "custom"}` : "$(circle-slash) Claude: default";
    bar.show();
  };
  refresh();
  const scope = () => vscode2.workspace.getConfiguration("claudeConfig").get("scope", "global");
  const target = () => {
    const f = settingsPath(scope());
    if (!f) {
      vscode2.window.showErrorMessage("No workspace folder open for workspace scope.");
    }
    return f;
  };
  const pickProfile = async (placeHolder) => {
    const pick = await vscode2.window.showQuickPick(
      store.list().map((p) => ({ label: p.name, description: `${p.baseUrl} \xB7 ${p.model}`, p })),
      { placeHolder }
    );
    return pick?.p;
  };
  const readOverrides = () => {
    const c = vscode2.workspace.getConfiguration("claudeConfig.override");
    const str = (k) => c.get(k, "").trim() || void 0;
    const flag = c.get("skipDangerousModePermissionPrompt", "unset");
    return {
      baseUrl: str("baseUrl"),
      apiKey: store.key(OVERRIDE_KEY_ID) || void 0,
      model: str("model"),
      effortLevel: str("effortLevel"),
      permissionMode: str("permissionMode"),
      allow: c.get("allow", []),
      additionalDirectories: c.get("additionalDirectories", []),
      skipDangerousModePermissionPrompt: flag === "unset" ? void 0 : flag === "true",
      theme: str("theme"),
      autoUpdatesChannel: str("autoUpdatesChannel"),
      extraEnv: c.get("extraEnv", {}),
      extraSettings: c.get("extraSettings", {})
    };
  };
  const rebuild = (file, p) => {
    backup(file);
    enable(path5.dirname(file), composeOverlay(p, store.patch(), readOverrides()));
    refresh();
  };
  const cacheKey = "claudeConfig.models";
  const cachedModels = (id) => (ctx.globalState.get(cacheKey) ?? {})[id]?.models ?? [];
  const effective = (p) => {
    const o = readOverrides();
    return { ...p, baseUrl: o.baseUrl ?? p.baseUrl, apiKey: o.apiKey ?? p.apiKey };
  };
  const refreshModels = async (p) => {
    const r = await testConnection(effective(p));
    if (r.ok) {
      const all = ctx.globalState.get(cacheKey) ?? {};
      await ctx.globalState.update(cacheKey, { ...all, [p.id]: { models: r.models, at: Date.now() } });
      out.appendLine(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] fetched ${r.models.length} models from ${effective(p).baseUrl}`);
    }
    return r;
  };
  const autoRefresh = () => {
    const p = store.active();
    if (p) {
      void refreshModels(p);
    }
  };
  autoRefresh();
  const mins = Math.max(1, vscode2.workspace.getConfiguration("claudeConfig").get("refreshMinutes", 10));
  const timer = setInterval(autoRefresh, mins * 6e4);
  ctx.subscriptions.push({ dispose: () => clearInterval(timer) });
  const pickModel = (p) => new Promise((resolve) => {
    const custom = { label: "$(edit) Enter custom model ID..." };
    const current = store.patch().model ?? readOverrides().model ?? p.model;
    const build = (models) => [
      ...models.map((m) => ({ label: m, description: m === current ? "current" : void 0 })),
      custom
    ];
    const qp = vscode2.window.createQuickPick();
    qp.title = `Models from ${effective(p).baseUrl}`;
    qp.placeholder = "Select a model (list refreshes automatically)";
    qp.items = build(cachedModels(p.id));
    qp.busy = true;
    let done = false;
    let typing = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        qp.dispose();
        resolve(v);
      }
    };
    qp.onDidAccept(async () => {
      const s = qp.selectedItems[0];
      if (!s) {
        return;
      }
      if (s !== custom) {
        finish(s.label);
        return;
      }
      typing = true;
      qp.hide();
      finish(await vscode2.window.showInputBox({ prompt: "Model ID" }));
    });
    qp.onDidHide(() => {
      if (!typing) {
        finish(void 0);
      }
    });
    qp.show();
    refreshModels(p).then((r) => {
      if (done) {
        return;
      }
      qp.busy = false;
      if (r.ok) {
        qp.items = build(r.models);
      } else {
        vscode2.window.showWarningMessage(`Could not refresh models: ${r.message}`);
      }
    });
  });
  ctx.subscriptions.push(vscode2.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("claudeConfig.override.baseUrl")) {
      autoRefresh();
    }
    if (!e.affectsConfiguration("claudeConfig.override")) {
      return;
    }
    if (!vscode2.workspace.getConfiguration("claudeConfig").get("autoApply", true)) {
      return;
    }
    const file = settingsPath(scope());
    const p = store.active();
    if (!file || !p || !isEnabled(path5.dirname(file))) {
      return;
    }
    try {
      rebuild(file, p);
      vscode2.window.setStatusBarMessage("Claude Config: settings applied to settings.json", 4e3);
    } catch (err) {
      vscode2.window.showErrorMessage(`Failed to apply settings: ${err.message}`);
    }
  }));
  ctx.subscriptions.push(
    bar,
    out,
    vscode2.commands.registerCommand("claudeConfig.switchProfile", async () => {
      const p = await pickProfile("Switch Claude Code profile");
      const file = p && target();
      if (!p || !file) {
        return;
      }
      try {
        await store.setActive(p.id);
        await store.setPatch({});
        rebuild(file, p);
        void refreshModels(p);
        vscode2.window.showInformationMessage(`Claude Code now uses "${p.name}" (${scope()}). Restart Claude Code sessions to apply.`);
      } catch (e) {
        vscode2.window.showErrorMessage(`Failed to apply profile: ${e.message}`);
      }
    }),
    vscode2.commands.registerCommand("claudeConfig.disable", async () => {
      const file = target();
      if (!file) {
        return;
      }
      const ok = await vscode2.window.showWarningMessage(
        "Restore your original Claude Code settings and stop using the custom endpoint?",
        { modal: true },
        "Restore"
      );
      if (ok !== "Restore") {
        return;
      }
      try {
        const done = disable(path5.dirname(file));
        refresh();
        vscode2.window.showInformationMessage(done ? "Original Claude Code settings restored. Restart Claude Code sessions. If ANTHROPIC_BASE_URL is set in your OS environment it will still apply." : "Extension config was not active; nothing to restore.");
      } catch (e) {
        vscode2.window.showErrorMessage(`Restore failed: ${e.message}`);
      }
    }),
    vscode2.commands.registerCommand("claudeConfig.enable", async () => {
      const file = target();
      const p = store.active();
      if (!file) {
        return;
      }
      if (!p) {
        vscode2.commands.executeCommand("claudeConfig.switchProfile");
        return;
      }
      try {
        rebuild(file, p);
        vscode2.window.showInformationMessage(`Custom config "${p.name}" enabled.`);
      } catch (e) {
        vscode2.window.showErrorMessage(`Enable failed: ${e.message}`);
      }
    }),
    vscode2.commands.registerCommand("claudeConfig.setApiKey", async () => {
      const active = store.active();
      const choice = await vscode2.window.showQuickPick([
        { label: `Active profile${active ? ` (${active.name})` : ""}`, id: "profile" },
        { label: "Override key (wins over every profile)", id: "override" },
        { label: "Clear override key", id: "clear" }
      ], { placeHolder: "Which API key do you want to set? Keys are stored in your OS keychain." });
      if (!choice) {
        return;
      }
      if (choice.id === "clear") {
        await store.deleteKey(OVERRIDE_KEY_ID);
      } else {
        if (choice.id === "profile" && !active) {
          vscode2.window.showWarningMessage("No active profile. Switch to one first.");
          return;
        }
        const key = await vscode2.window.showInputBox({ prompt: "API key", password: true, ignoreFocusOut: true });
        if (key === void 0) {
          return;
        }
        await store.setKey(choice.id === "profile" ? active.id : OVERRIDE_KEY_ID, key.trim());
      }
      const file = settingsPath(scope());
      const p = store.active();
      if (file && p && isEnabled(path5.dirname(file))) {
        rebuild(file, p);
      }
      autoRefresh();
      vscode2.window.showInformationMessage("API key updated.");
    }),
    vscode2.commands.registerCommand("claudeConfig.addProfile", async () => {
      const name = await vscode2.window.showInputBox({ prompt: "Profile name" });
      if (!name) {
        return;
      }
      const baseUrl = await vscode2.window.showInputBox({ prompt: "Base URL (no /v1)", value: "http://localhost:20128" });
      if (!baseUrl) {
        return;
      }
      const apiKey = await vscode2.window.showInputBox({ prompt: "API key", password: true }) ?? "";
      const model = await vscode2.window.showInputBox({ prompt: "Model (leave blank to select later)" });
      if (model === void 0) {
        return;
      }
      const profile = { id: `${Date.now()}`, name, baseUrl, apiKey: "", model, permissionMode: "default" };
      await store.setKey(profile.id, apiKey);
      await store.save([...store.list(), profile]);
    }),
    vscode2.commands.registerCommand("claudeConfig.deleteProfile", async () => {
      const p = await pickProfile("Delete profile");
      if (p) {
        await store.save(store.list().filter((x) => x.id !== p.id));
        await store.deleteKey(p.id);
        refresh();
      }
    }),
    vscode2.commands.registerCommand("claudeConfig.testConnection", async () => {
      const p = store.active() ?? await pickProfile("Test which profile?");
      if (!p) {
        return;
      }
      const r = await refreshModels(p);
      out.appendLine(r.message);
      if (r.models.length) {
        out.appendLine(r.models.join("\n"));
      }
      out.show(true);
      (r.ok ? vscode2.window.showInformationMessage : vscode2.window.showErrorMessage)(r.message);
    }),
    vscode2.commands.registerCommand("claudeConfig.selectModel", async () => {
      const p = store.active() ?? await pickProfile("Fetch models from which profile?");
      const file = p && target();
      if (!p || !file) {
        return;
      }
      const model = await pickModel(p);
      if (!model) {
        return;
      }
      const slots = await vscode2.window.showQuickPick(
        [
          { label: "Main model", id: "main", picked: true },
          { label: "Sonnet slot", id: "sonnet" },
          { label: "Opus slot", id: "opus" },
          { label: "Haiku / small-fast slot", id: "haiku" }
        ],
        { canPickMany: true, placeHolder: "Apply model to..." }
      );
      if (!slots?.length) {
        return;
      }
      try {
        await store.setPatch(mergeSettings(store.patch(), modelPatch(model, slots.map((s) => s.id))));
        if (slots.some((s) => s.id === "main")) {
          await vscode2.workspace.getConfiguration("claudeConfig.override").update("model", model, vscode2.ConfigurationTarget.Global);
        }
        rebuild(file, p);
        vscode2.window.showInformationMessage(`Model "${model}" applied. Restart Claude Code sessions.`);
      } catch (e) {
        vscode2.window.showErrorMessage(`Failed to set model: ${e.message}`);
      }
    }),
    vscode2.commands.registerCommand("claudeConfig.openConfig", () => vscode2.commands.executeCommand("workbench.action.openSettings", "claudeConfig")),
    vscode2.commands.registerCommand("claudeConfig.openSettings", async () => {
      const file = target();
      if (file) {
        await vscode2.window.showTextDocument(vscode2.Uri.file(file));
      }
    }),
    vscode2.commands.registerCommand("claudeConfig.restoreBackup", () => {
      const file = target();
      if (!file) {
        return;
      }
      const r = restoreLatest(file);
      vscode2.window.showInformationMessage(r ? `Restored ${r}` : "No backup found.");
    })
  );
}
function deactivate() {
  if (vscode2.workspace.getConfiguration("claudeConfig").get("restoreOnDeactivate", false)) {
    try {
      disableAll();
    } catch {
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
