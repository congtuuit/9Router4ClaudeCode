import { disableAll } from './services/overlayManager';

try { disableAll(); } catch { /* never block uninstall */ }
