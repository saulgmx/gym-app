// Global stylesheets, in cascade order (plan §6.10).
import '@/shared/ui/tokens.css';
import '@/shared/ui/fonts.css';
import '@/shared/ui/base.css';
import { bootstrap } from './bootstrap';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

bootstrap(root, { storage: navigator.storage });
