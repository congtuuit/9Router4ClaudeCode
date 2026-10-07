import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type Json = Record<string, any>;
interface State { existed: boolean; enabled: boolean; lastOutput?: Json }

const LIVE = 'settings.json';
const SNAP = 'settings.claude.json';      // user's original settings
const OVERLAY = 'settings.9router.json';  // this extension's settings
const STATE = 'settings.9router.state.json';
const MERGED_KEYS = ['env', 'permissions'];

const registryFile = () => path.join(os.homedir(), '.claude', 'settings.9router.registry.json');

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function readJson(file: string): Json | undefined {
  if (!fs.existsSync(file)) { return undefined; }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) { return {}; }
  return JSON.parse(text); // throws on invalid JSON: never overwrite what we can't parse
}

function writeAtomic(file: string, obj: Json) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function merge(base: Json, over: Json): Json {
  const out: Json = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = MERGED_KEYS.includes(k) && isObj(base[k]) && isObj(over[k]) ? { ...base[k], ...over[k] } : over[k];
  }
  return out;
}

/** Fold edits the user made to the live file (while active) back into the snapshot. */
function foldEdits(current: Json, last: Json, overlay: Json, snapshot: Json): Json {
  const snap: Json = { ...snapshot };
  for (const k of Object.keys(current)) {
    if (eq(current[k], last[k])) { continue; }
    if (MERGED_KEYS.includes(k) && isObj(current[k])) {
      const sub: Json = isObj(snap[k]) ? { ...snap[k] } : {};
      const prev: Json = isObj(last[k]) ? last[k] : {};
      const ov: Json = isObj(overlay[k]) ? overlay[k] : {};
      for (const s of Object.keys(current[k])) {
        if (s in ov) { continue; }
        if (!eq(current[k][s], prev[s])) { sub[s] = current[k][s]; }
      }
      snap[k] = sub;
    } else if (!(k in overlay)) {
      snap[k] = current[k];
    }
  }
  return snap;
}

function register(dir: string) {
  const f = registryFile();
  const list: string[] = (readJson(f) as any)?.dirs ?? [];
  if (!list.includes(dir)) { writeAtomic(f, { dirs: [...list, dir] }); }
}

function readState(dir: string): State {
  return (readJson(path.join(dir, STATE)) as State | undefined) ?? { existed: false, enabled: false };
}

export function readOverlay(dir: string): Json {
  return readJson(path.join(dir, OVERLAY)) ?? {};
}

export function isEnabled(dir: string): boolean {
  return readState(dir).enabled;
}

/** Snapshot the original settings (once) and write live = snapshot + overlay. */
export function enable(dir: string, overlay?: Json): void {
  const live = path.join(dir, LIVE);
  const snapFile = path.join(dir, SNAP);
  const state = readState(dir);
  const current = readJson(live);
  let snapshot = readJson(snapFile);

  if (!snapshot || !state.enabled) {
    // First enable, or re-enable after disable: capture what the user has right now.
    snapshot = current ?? {};
    state.existed = current !== undefined;
  } else if (current && state.lastOutput) {
    snapshot = foldEdits(current, state.lastOutput, readOverlay(dir), snapshot);
  }
  writeAtomic(snapFile, snapshot);

  if (overlay) { writeAtomic(path.join(dir, OVERLAY), overlay); }
  const merged = merge(snapshot, overlay ?? readOverlay(dir));
  writeAtomic(live, merged);

  state.enabled = true;
  state.lastOutput = merged;
  writeAtomic(path.join(dir, STATE), state as Json);
  register(dir);
}

/** Restore the original settings from the snapshot. Returns false if not enabled. */
export function disable(dir: string): boolean {
  const state = readState(dir);
  if (!state.enabled) { return false; }
  const live = path.join(dir, LIVE);
  const snapFile = path.join(dir, SNAP);
  let snapshot = readJson(snapFile) ?? {};
  const current = readJson(live);
  if (current && state.lastOutput) {
    snapshot = foldEdits(current, state.lastOutput, readOverlay(dir), snapshot);
  }
  if (!state.existed && Object.keys(snapshot).length === 0) {
    if (fs.existsSync(live)) { fs.rmSync(live); }
  } else {
    writeAtomic(live, snapshot);
  }
  writeAtomic(snapFile, snapshot);
  state.enabled = false;
  delete state.lastOutput;
  writeAtomic(path.join(dir, STATE), state as Json);
  return true;
}

export function disableAll(): void {
  const dirs: string[] = (readJson(registryFile()) as any)?.dirs ?? [];
  for (const d of dirs) {
    try { disable(d); } catch { /* keep going */ }
  }
}
