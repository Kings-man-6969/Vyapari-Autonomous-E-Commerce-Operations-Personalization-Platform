require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { errorHandler, notFoundHandler } = require('./middleware/error');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const sellerRoutes = require('./routes/seller');
const approvalRoutes = require('./routes/approvals');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/users');
const wishlistRoutes = require('./routes/wishlist');
const notificationRoutes = require('./routes/notifications');
const storeRoutes = require('./routes/stores');
const adminRoutes = require('./routes/admin');
const reviewsRoutes = require('./routes/reviews');

const app = express();
const PORT = process.env.PORT || 8000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Global Middlewares
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Route Mounts
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewsRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Vyapari Core Backend API running on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/health`);
    console.log(` API Base:     http://localhost:${PORT}/api`);
    console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
