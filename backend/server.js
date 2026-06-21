require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const routes = require('./routes');
const { limiter } = require('./middlewares/rateLimiter');

const app = express();

// Connect Database
connectDB();

// Global Security and Request parsing Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false // Allows accessing documents/images directly in browser if needed
}));
app.use(cors({
  origin: '*', // Open for internal intranet deployment, customizable via configurations
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiter to all API calls
app.use('/api', limiter);

// API Endpoints
app.use('/api', routes);

// Home Root
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'MSME Container Trading ERP System API is running...' 
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'API Route Not Found' });
});

// Unhandled Promise/Error Catch-all
app.use((err, req, res, next) => {
  console.error('Express Error Handler caught:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`ERP System Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
});
