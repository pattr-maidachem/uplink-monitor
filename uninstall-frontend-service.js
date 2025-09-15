import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svc = new Service({
  name: 'UplinkMonitorFrontend',
  description: 'The Uplink Monitor Vite frontend service.',
  script: path.join(__dirname, 'server/frontend-server.js')
});

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully');
});

svc.uninstall();
