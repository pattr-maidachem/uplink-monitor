import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svc = new Service({
  name: 'UplinkMonitorServer',
  description: 'The Uplink Monitor Express server service.',
  script: path.join(__dirname, 'dist/server/server.js')
});

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully');
});

svc.uninstall();
