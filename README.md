# WAG_Dashboard

GUI Dashboard for Data Manipulation and Staging - A Node.js CRUD application with Prisma and PostgreSQL.

## Features

- **CREATE**: Add new items to the database
- **READ**: Retrieve all items or a specific item by ID
- **UPDATE**: Modify existing items
- **DELETE**: Remove items from the database

## Tech Stack

- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **Prisma**: Modern database ORM
- **PostgreSQL**: Relational database
- **CORS**: Cross-Origin Resource Sharing support

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/rs0125/WAG_Dashboard.git
cd WAG_Dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Update the `.env` file with your PostgreSQL connection string:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
PORT=3000
```

5. Generate Prisma Client:
```bash
npm run prisma:generate
```

6. Run database migrations:
```bash
npm run prisma:migrate
```

## Running the Application

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## API Endpoints

### Base URL: `http://localhost:3000/api`

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| GET | `/items` | Get all items | - |
| GET | `/items/:id` | Get item by ID | - |
| POST | `/items` | Create new item | `{ "name": "string", "description": "string", "quantity": number }` |
| PUT | `/items/:id` | Update item | `{ "name": "string", "description": "string", "quantity": number }` |
| DELETE | `/items/:id` | Delete item | - |

### Example API Calls

#### Create a new item:
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Item",
    "description": "This is a sample item",
    "quantity": 10
  }'
```

#### Get all items:
```bash
curl http://localhost:3000/api/items
```

#### Get item by ID:
```bash
curl http://localhost:3000/api/items/1
```

#### Update an item:
```bash
curl -X PUT http://localhost:3000/api/items/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Item",
    "quantity": 20
  }'
```

#### Delete an item:
```bash
curl -X DELETE http://localhost:3000/api/items/1
```

## Database Schema

The application uses a simple `Item` model:

```prisma
model Item {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  quantity    Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Project Structure

```
WAG_Dashboard/
├── prisma/
│   └── schema.prisma        # Database schema definition
├── src/
│   ├── controllers/
│   │   └── itemController.js # CRUD operations logic
│   ├── routes/
│   │   └── itemRoutes.js     # API route definitions
│   ├── prisma.js             # Prisma client configuration
│   └── server.js             # Express server setup
├── .env                      # Environment variables (not in git)
├── .env.example              # Example environment variables
├── package.json              # Project dependencies and scripts
└── README.md                 # This file
```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Testing the API

### Using the Test Script

A bash script is provided to test all CRUD operations:

```bash
# Make sure the server is running first
npm run dev

# In another terminal, run the test script
./test-api.sh
```

### Using Postman

Import the `postman-collection.json` file into Postman to test all endpoints interactively.

## Development

### Prisma Studio

To view and edit your database with a GUI, run:
```bash
npm run prisma:studio
```

This will open Prisma Studio at `http://localhost:5555`.

### Adding New Models

1. Edit `prisma/schema.prisma` to add your model
2. Run `npm run prisma:migrate` to create a migration
3. Generate the Prisma Client with `npm run prisma:generate`
4. Create corresponding controllers and routes

## Error Handling

The API includes comprehensive error handling:
- **400**: Bad Request (missing required fields)
- **404**: Not Found (item doesn't exist)
- **500**: Internal Server Error

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

