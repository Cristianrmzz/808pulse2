# 808 PULSE Backend API

Backend API for the 808 PULSE electronic music events platform.

## Features

- RESTful API for events management
- Order processing and tracking
- MySQL database with Sequelize ORM
- WhatsApp integration support
- CORS enabled for frontend integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure MySQL database:
   - Create a MySQL database named `808pulse`
   - Update `.env` file with your MySQL credentials

3. Configure environment variables:
   - Update `DB_USER`, `DB_PASSWORD`, `DB_HOST` in `.env`
   - Update `JWT_SECRET` for production

4. Seed the database with initial events:
```bash
npm run seed
```

5. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Events
- `GET /api/events` - Get all active events
- `GET /api/events/:id` - Get single event
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Deactivate event

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get all orders
- `GET /api/orders/:orderId` - Get single order
- `PUT /api/orders/:orderId/status` - Update order status
- `POST /api/orders/whatsapp` - Process WhatsApp order

## Database Models

### Event (MySQL Table: `events`)
- id (Primary Key), name, date, location, price
- image, description, capacity, ticketsSold
- isActive, createdAt, updatedAt

### Order (MySQL Table: `orders`)
- id (Primary Key), orderId (UUID), total, status
- customerName, customerPhone, customerEmail
- paymentMethod, createdAt, updatedAt

### OrderItem (MySQL Table: `order_items`)
- id (Primary Key), orderId (Foreign Key), eventId
- eventName, quantity, price, subtotal
- createdAt, updatedAt

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DB_NAME` - MySQL database name (default: 808pulse)
- `DB_USER` - MySQL username (default: root)
- `DB_PASSWORD` - MySQL password
- `DB_HOST` - MySQL host (default: localhost)
- `DB_PORT` - MySQL port (default: 3306)
- `JWT_SECRET` - JWT secret key
- `NODE_ENV` - Environment (development/production)
