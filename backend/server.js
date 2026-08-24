const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const connectDatabase = require('./src/config/database');
const { isFirebaseConfigured } = require('./src/config/firebaseAdmin');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const AppError = require('./src/utils/AppError');
const { assertSecretStrength } = require('./src/utils/jwt');
const authRoutes = require('./src/routes/auth');
const invitationRoutes = require('./src/routes/invitations');
const notificationRoutes = require('./src/routes/notifications');
const projectRoutes = require('./src/routes/projects');
const taskRoutes = require('./src/routes/tasks');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const requiredEnv = ['MONGO_URI', 'JWT_SECRET'];

const validateEnvironment = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Refuses to boot in production on a weak or placeholder signing secret.
  assertSecretStrength('JWT_SECRET', process.env.JWT_SECRET);

  if (!isFirebaseConfigured()) {
    console.warn(
      '[server] FIREBASE_SERVICE_ACCOUNT is not set — POST /api/auth/google will return 503'
    );
  }
};

/**
 * Minimal cookie parser. Only the refresh cookie is read server-side, so pulling in
 * cookie-parser for one header is not worth the dependency.
 */
const cookieParser = (req, res, next) => {
  const header = req.headers.cookie;
  req.cookies = {};

  if (header) {
    header.split(';').forEach((part) => {
      const index = part.indexOf('=');

      if (index > 0) {
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();

        try {
          req.cookies[key] = decodeURIComponent(value);
        } catch (_error) {
          req.cookies[key] = value;
        }
      }
    });
  }

  next();
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
  String(process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const isAllowedVercelPreview = (origin = '') => {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && /^teamflow(?:-[a-z0-9-]+)?\.vercel\.app$/.test(hostname);
  } catch (_error) {
    return false;
  }
};

app.disable('x-powered-by');

// Render terminates TLS at its edge, so without this req.ip is the proxy address and
// every client would share a single rate-limit bucket. `1` trusts exactly one hop —
// trusting all hops would let a client spoof X-Forwarded-For and bypass the limiter.
app.set('trust proxy', 1);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const allowedOrigins = parseAllowedOrigins();

      if (!origin || allowedOrigins.includes(origin) || isAllowedVercelPreview(origin)) {
        return callback(null, true);
      }

      return callback(new AppError('Not allowed by CORS', 403));
    }
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser);
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
app.use('/api/notifications', notificationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

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
