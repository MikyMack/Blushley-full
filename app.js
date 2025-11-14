// app.js - Express application
require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');

const app = express();

// Basic env checks
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set in .env');
  process.exit(1);
}

connectDB(process.env.MONGO_URI).catch(err => {
  console.error('DB connect failed', err);
  process.exit(1);
});

// Middlewares
app.use(helmet());
if (NODE_ENV === 'development') app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static folder
app.use(express.static(path.join(__dirname, 'public')));

// View engine - EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Sessions (stored in MongoDB)
app.use(session({
  name: 'blushley.sid',
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 // 1 day
  }),
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Rate limiting (simple)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100
});
app.use(limiter);

// Simple middleware to expose session user to views
app.use((req, res, next) => {
  res.locals.currentUser = req.session && req.session.user ? req.session.user : null;
  next();
});
const userRoutes = require('./routes/userRoutes');

app.use('/', userRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404);
  if (req.accepts('html')) return res.render('404', { url: req.originalUrl });
  if (req.accepts('json')) return res.json({ error: 'Not found' });
  return res.type('txt').send('Not found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500);
  if (req.accepts('json')) return res.json({ error: err.message || 'Server error' });
  return res.render('error', { error: err });
});

module.exports = app;
