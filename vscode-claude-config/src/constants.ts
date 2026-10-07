import { Profile } from './types';

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: '9router-gemini',
    name: '9Router Gemini',
    // Claude Code appends /v1/messages itself, so no /v1 suffix here.
    baseUrl: 'http://localhost:20128',
    apiKey: 'sk-9router',
    model: 'ag/gemini-3.7-flash-medium',
    effortLevel: 'high',
    permissionMode: 'bypassPermissions',
    allow: ['*'],
    skipDangerousModePermissionPrompt: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Official',
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-sonnet-4-5',
    permissionMode: 'default',
  },
];
