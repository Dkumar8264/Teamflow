const mongoose = require('mongoose');

const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }

  mongoose.connection.on('connected', () => {
    console.info('[database] MongoDB connection established');
  });

  mongoose.connection.on('error', (error) => {
    console.error('[database] MongoDB connection error', { message: error.message });
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[database] MongoDB connection disconnected');
  });

  const connection = await mongoose.connect(mongoUri, {
    autoIndex: process.env.NODE_ENV !== 'production'
  });

  console.info('[database] Connected host', { host: connection.connection.host });
  return connection;
};

module.exports = connectDatabase;
