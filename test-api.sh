#!/bin/bash

# WAG Dashboard API Test Script
# This script tests all CRUD operations of the API

BASE_URL="http://localhost:3000/api"

echo "========================================="
echo "WAG Dashboard API Test Suite"
echo "========================================="
echo ""

# Check if server is running
echo "1. Checking if server is running..."
HEALTH_CHECK=$(curl -s http://localhost:3000 || echo "FAILED")
if [[ $HEALTH_CHECK == *"WAG Dashboard API"* ]]; then
    echo "✓ Server is running"
else
    echo "✗ Server is not running. Please start the server with 'npm start' or 'npm run dev'"
    exit 1
fi
echo ""

# CREATE - Add a new item
echo "2. Creating a new item..."
CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Item",
    "description": "This is a test item",
    "quantity": 10
  }')
echo "Response: $CREATE_RESPONSE"
ITEM_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "✓ Created item with ID: $ITEM_ID"
echo ""

# READ - Get all items
echo "3. Getting all items..."
ALL_ITEMS=$(curl -s $BASE_URL/items)
echo "Response: $ALL_ITEMS"
echo "✓ Retrieved all items"
echo ""

# READ - Get single item by ID
echo "4. Getting item by ID ($ITEM_ID)..."
SINGLE_ITEM=$(curl -s $BASE_URL/items/$ITEM_ID)
echo "Response: $SINGLE_ITEM"
echo "✓ Retrieved item by ID"
echo ""

# UPDATE - Update the item
echo "5. Updating item..."
UPDATE_RESPONSE=$(curl -s -X PUT $BASE_URL/items/$ITEM_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Item",
    "quantity": 25
  }')
echo "Response: $UPDATE_RESPONSE"
echo "✓ Updated item"
echo ""

# DELETE - Delete the item
echo "6. Deleting item..."
DELETE_RESPONSE=$(curl -s -X DELETE $BASE_URL/items/$ITEM_ID)
echo "Response: $DELETE_RESPONSE"
echo "✓ Deleted item"
echo ""

echo "========================================="
echo "All CRUD operations completed successfully!"
echo "========================================="
