const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const connectDatabase = require('./src/config/database');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const AppError = require('./src/utils/AppError');
const authRoutes = require('./src/routes/auth');
const invitationRoutes = require('./src/routes/invitations');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const validateEnvironment = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const log = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    };

    if (res.statusCode >= 500) {
      console.error('[request]', log);
    } else if (res.statusCode >= 400) {
      console.warn('[request]', log);
    } else {
      console.info('[request]', log);
    }
  });

  next();
};

const parseAllowedOrigins = () =>
  String(process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable('x-powered-by');

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const allowedOrigins = parseAllowedOrigins();

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new AppError('Not allowed by CORS', 403));
    }
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TeamFlow API is running',
    uptime: process.uptime()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDatabase();

    const server = app.listen(port, () => {
      console.info('[server] Listening', { port, environment: process.env.NODE_ENV || 'development' });
    });

    const shutdown = async (signal) => {
      console.info('[server] Shutdown signal received', { signal });
      server.close(async () => {
        await mongoose.connection.close();
        console.info('[server] Shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[server] Failed to start', { message: error.message });
    process.exit(1);
  }
};

startServer();

module.exports = app;
