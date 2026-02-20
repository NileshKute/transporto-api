const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/shotgrid', require('./routes/shotgrid'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Redchillies VFX Feedback System' });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    await sequelize.sync({ alter: true });
    console.log('✅ Models synced');

    app.listen(PORT, () => {
      console.log(`🚀 Redchillies VFX Feedback Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
  }
};

startServer();