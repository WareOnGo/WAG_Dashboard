const express = require('express');
const router = express.Router();
const {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
} = require('../controllers/itemController');

// CREATE - Create a new item
router.post('/items', createItem);

// READ - Get all items
router.get('/items', getAllItems);

// READ - Get a single item by ID
router.get('/items/:id', getItemById);

// UPDATE - Update an item
router.put('/items/:id', updateItem);

// DELETE - Delete an item
router.delete('/items/:id', deleteItem);

module.exports = router;
