export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export interface ClaudeSettings {
  env?: Record<string, string>;
  model?: string;
  effortLevel?: string;
  theme?: string;
  autoUpdatesChannel?: string;
  skipDangerousModePermissionPrompt?: boolean;
  permissions?: {
    defaultMode?: PermissionMode;
    allow?: string[];
    deny?: string[];
    additionalDirectories?: string[];
  };
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  effortLevel?: 'low' | 'medium' | 'high';
  permissionMode?: PermissionMode;
  allow?: string[];
  skipDangerousModePermissionPrompt?: boolean;
}

export type Scope = 'global' | 'workspace';
