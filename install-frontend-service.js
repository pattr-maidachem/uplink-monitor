import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a new service object
const svc = new Service({
  name: 'UplinkMonitorFrontend',
  description: 'The Uplink Monitor Vite frontend service.',
  script: path.join(__dirname, 'server/frontend-server.js'),
  nodeOptions: [],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    // Add your environment variables here
    {
      name: "VITE_API_BASE_URL",
      value: process.env.VITE_API_BASE_URL || "http://localhost:3001"
    },
    {
      name: "VITE_WS_URL",
      value: process.env.VITE_WS_URL || "ws://localhost:3001"
    }
  ]
});

// Listen for service events
svc.on('install', () => {
  console.log('Service installed successfully');
  svc.start();
});

svc.on('start', () => {
  console.log('Service started successfully');
});

svc.on('error', (err) => {
  console.error('Service error:', err);
});

// Install the service
if (import.meta.url === `file://${process.argv[1]}`) {
  svc.install();
}
