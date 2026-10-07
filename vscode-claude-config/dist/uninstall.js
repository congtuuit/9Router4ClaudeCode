"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
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
function foldEdits(current, last, overlay, snapshot) {
  const snap = { ...snapshot };
  for (const k of Object.keys(current)) {
    if (eq(current[k], last[k])) {
      continue;
    }
    if (MERGED_KEYS.includes(k) && isObj(current[k])) {
      const sub = isObj(snap[k]) ? { ...snap[k] } : {};
      const prev = isObj(last[k]) ? last[k] : {};
      const ov = isObj(overlay[k]) ? overlay[k] : {};
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
function readState(dir) {
  return readJson(path.join(dir, STATE)) ?? { existed: false, enabled: false };
}
function readOverlay(dir) {
  return readJson(path.join(dir, OVERLAY)) ?? {};
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

// src/uninstall.ts
try {
  disableAll();
} catch {
}
//# sourceMappingURL=uninstall.js.map
