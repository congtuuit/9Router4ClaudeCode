import * as fs from 'fs';
import * as path from 'path';

export function backup(file: string): string | undefined {
  if (!fs.existsSync(file)) { return undefined; }
  const dest = `${file}.bak.${Date.now()}`;
  fs.copyFileSync(file, dest);
  return dest;
}

export function restoreLatest(file: string): string | undefined {
  const dir = path.dirname(file);
  const base = path.basename(file) + '.bak.';
  if (!fs.existsSync(dir)) { return undefined; }
  const baks = fs.readdirSync(dir).filter(f => f.startsWith(base)).sort();
  const latest = baks[baks.length - 1];
  if (!latest) { return undefined; }
  fs.copyFileSync(path.join(dir, latest), file);
  return latest;
}
