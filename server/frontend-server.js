import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.FRONTEND_PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// For any other route, serve index.html (for client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running on port ${port}`);
});
