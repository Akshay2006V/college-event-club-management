// server/server.js -- application entry point
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connect, close } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve front-end files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/events', require('./routes/events'));

// Unknown API route -> JSON 404 instead of the SPA html
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

// Fallback to dashboard for any other path
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

async function start() {
  try {
    await connect();
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

start();
