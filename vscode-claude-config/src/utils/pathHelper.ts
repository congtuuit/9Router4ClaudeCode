import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Scope } from '../types';

export function settingsPath(scope: Scope): string | undefined {
  if (scope === 'global') {
    return path.join(os.homedir(), '.claude', 'settings.json');
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? path.join(folder.uri.fsPath, '.claude', 'settings.json') : undefined;
}
