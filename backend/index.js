const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger JSON payloads for Excel import

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Import routes
const ticketRoutes = require('./routes/tickets');
const technicalRoutes = require('./routes/technical');

// Mount routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/technical', technicalRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    error: true,
    message: err.message || 'Internal Server Error'
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Ticket Monitoring backend running on port ${PORT}`);
  });
}

module.exports = app;
