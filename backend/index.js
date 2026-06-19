require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');

const usersRouter = require('./routes/users');
const moodRouter = require('./routes/mood');
const insightsRouter = require('./routes/insights');
const aiRouter = require('./routes/ai');
const graphRouter = require('./routes/graph');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MindGraph API', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/mood', moodRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/ai-insight', aiRouter);
app.use('/api/graph', graphRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MindGraph API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
