const prisma = require('../prisma');

// Create a new item
const createItem = async (req, res) => {
  try {
    const { name, description, quantity } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const item = await prisma.item.create({
      data: {
        name,
        description,
        quantity: quantity || 0,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
};

// Get all items
const getAllItems = async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

// Get a single item by ID
const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.status(200).json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
};

// Update an item
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, quantity } = req.body;

    const item = await prisma.item.update({
      where: {
        id: parseInt(id),
      },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(quantity !== undefined && { quantity }),
      },
    });

    res.status(200).json(item);
  } catch (error) {
    console.error('Error updating item:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
};

// Delete an item
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.item.delete({
      where: {
        id: parseInt(id),
      },
    });

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(500).json({ error: 'Failed to delete item' });
  }
};

module.exports = {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
};
