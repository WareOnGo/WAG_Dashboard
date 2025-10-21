# WAG Dashboard - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (Browser, Postman, curl, test-api.sh, etc.)               │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP Requests
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Server                         │
│                     (src/server.js)                          │
│                                                              │
│  Middleware:                                                 │
│  • CORS                                                      │
│  • JSON Parser                                               │
│  • URL Encoded Parser                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                              │
│                  (src/routes/itemRoutes.js)                  │
│                                                              │
│  Endpoints:                                                  │
│  • POST   /api/items          → Create                      │
│  • GET    /api/items          → Read All                    │
│  • GET    /api/items/:id      → Read One                    │
│  • PUT    /api/items/:id      → Update                      │
│  • DELETE /api/items/:id      → Delete                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     Controllers                              │
│             (src/controllers/itemController.js)              │
│                                                              │
│  Business Logic:                                             │
│  • createItem()    - Validates & creates new item          │
│  • getAllItems()   - Fetches all items                      │
│  • getItemById()   - Fetches single item                    │
│  • updateItem()    - Updates existing item                  │
│  • deleteItem()    - Removes item                           │
│  • Error handling & validation                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prisma Client                             │
│                    (src/prisma.js)                           │
│                                                              │
│  ORM Layer:                                                  │
│  • Database abstraction                                      │
│  • Type-safe queries                                         │
│  • Auto-generated client                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ SQL Queries
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│                                                              │
│  Tables:                                                     │
│  • Item                                                      │
│    - id (Primary Key)                                        │
│    - name                                                    │
│    - description                                             │
│    - quantity                                                │
│    - createdAt                                               │
│    - updatedAt                                               │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow Example

### Creating a New Item

1. **Client** sends POST request to `/api/items` with JSON body
2. **Express Server** receives request, parses JSON
3. **Routes** match the request to `createItem` controller
4. **Controller** validates data, calls Prisma
5. **Prisma** generates SQL INSERT query
6. **PostgreSQL** executes query, returns new record
7. **Response** flows back through layers to client

## Data Flow

```
Request → Middleware → Routes → Controller → Prisma → Database
                                                         ↓
Response ← JSON ← Format ← Business Logic ← ORM ← SQL Result
```

## Key Components

### 1. Express Server (`src/server.js`)
- Entry point of the application
- Configures middleware (CORS, JSON parsing)
- Defines health check endpoint
- Error handling

### 2. Routes (`src/routes/itemRoutes.js`)
- Maps HTTP methods to controller functions
- RESTful endpoint definitions
- Route parameter extraction

### 3. Controllers (`src/controllers/itemController.js`)
- Business logic implementation
- Input validation
- Error handling
- Prisma client interaction

### 4. Prisma Client (`src/prisma.js`)
- Singleton pattern
- Database connection management
- Type-safe database operations

### 5. Schema (`prisma/schema.prisma`)
- Database model definitions
- Relationships and constraints
- Migration source of truth

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js | JavaScript execution environment |
| Framework | Express.js | Web application framework |
| ORM | Prisma | Database toolkit and ORM |
| Database | PostgreSQL | Relational database system |
| Middleware | CORS, body-parser | Request processing |
| Environment | dotenv | Configuration management |

## Security Features

- Environment variables for sensitive data
- Parameterized queries (SQL injection protection)
- Input validation
- Error handling without sensitive data exposure
- CORS configuration for API access control

## Development Tools

- **nodemon**: Auto-restart on file changes
- **Prisma Studio**: Visual database editor
- **test-api.sh**: Automated endpoint testing
- **Postman Collection**: Interactive API testing

## Scalability Considerations

The architecture supports:
- Horizontal scaling (multiple server instances)
- Connection pooling (via Prisma)
- Caching layers (can be added)
- Load balancing (external)
- Microservices migration (modular structure)
