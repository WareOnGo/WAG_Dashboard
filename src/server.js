require('dotenv').config();
const express = require('express');
const cors = require('cors');
const itemRoutes = require('./routes/itemRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', itemRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'WAG Dashboard API',
    status: 'running',
    endpoints: {
      items: {
        'GET /api/items': 'Get all items',
        'GET /api/items/:id': 'Get item by ID',
        'POST /api/items': 'Create new item',
        'PUT /api/items/:id': 'Update item',
        'DELETE /api/items/:id': 'Delete item',
      },
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}`);
});

module.exports = app;
