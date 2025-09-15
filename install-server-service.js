import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a new service object
const svc = new Service({
  name: 'UplinkMonitorServer',
  description: 'The Uplink Monitor Express server service.',
  script: path.join(__dirname, 'dist/server/server.js'),
  nodeOptions: [],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    // Add your environment variables here
    {
      name: "SERVER_PORT",
      value: process.env.SERVER_PORT || "3001"
    },
    {
      name: "DB_USER",
      value: process.env.DB_USER
    },
    {
      name: "DB_PASSWORD",
      value: process.env.DB_PASSWORD
    },
    {
      name: "DB_SERVER",
      value: process.env.DB_SERVER
    }
  ]
});

// Listen for service events
svc.on('install', () => {
  console.log('UplinkMonitorServer service installed successfully');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('UplinkMonitorServer service is already installed. Reinstalling...');
  svc.uninstall();
  svc.install();
});

svc.on('start', () => {
  console.log('UplinkMonitorServer service started successfully');
});

svc.on('error', (err) => {
  console.error('UplinkMonitorServer service error:', err);
});

svc.on('uninstall', () => {
  console.log('UplinkMonitorServer service uninstalled. Reinstalling...');
  svc.install();
});

// Install the service
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting UplinkMonitorServer service installation...');
  try {
    svc.install();
  } catch (err) {
    console.error('Failed to install UplinkMonitorServer service:', err);
    process.exit(1);
  }
}
