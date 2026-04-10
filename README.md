# Bulk User Management System

> Scalable backend API for bulk user operations — Node.js + Express + MongoDB

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Setup & Run](#setup--run)
5. [Environment Variables](#environment-variables)
6. [API Reference](#api-reference)
7. [Database Indexing Strategy](#database-indexing-strategy)
8. [Export Formats](#export-formats)
9. [Bulk Operations Guide](#bulk-operations-guide)
10. [Postman Collection](#postman-collection)

---

## Features

- ✅ Bulk create **5,000–10,000+ users** per request (batched, memory-safe)
- ✅ Bulk update via flexible `filter + update` pairs using `bulkWrite`
- ✅ Bulk soft-delete by filter
- ✅ Full schema validation with Joi (request) + Mongoose (database)
- ✅ Unique constraints on `email` and `username`
- ✅ 9 performance-optimised MongoDB indexes
- ✅ Export to **JSON** and **BSON** (streamed, handles millions of records)
- ✅ Paginated listing with full-text search and multi-field filtering
- ✅ Aggregation stats (by role, status, department)
- ✅ Soft delete (never hard-deletes data)
- ✅ Rate limiting per route group
- ✅ Global error handler with Mongoose-aware messages
- ✅ Postman collection with 20+ pre-built requests

---

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Runtime    | Node.js ≥ 18            |
| Framework  | Express 4               |
| Database   | MongoDB (via Mongoose 8)|
| Validation | Joi 17                  |
| Auth util  | bcryptjs                |
| Export     | BSON (official driver)  |
| Security   | Helmet, CORS, Rate Limit|

---

## Project Structure

```
bulk-user-management/
├── src/
│   ├── app.js                    # Express app + server bootstrap
│   ├── config/
│   │   └── db.js                 # MongoDB connection with pool settings
│   ├── controllers/
│   │   └── userController.js     # All business logic
│   ├── middleware/
│   │   ├── errorHandler.js       # Global error handler
│   │   └── requestMiddleware.js  # Rate limiter, JSON check, timer
│   ├── models/
│   │   └── User.js               # Mongoose schema + static bulk methods
│   ├── routes/
│   │   └── userRoutes.js         # Express router
│   └── validators/
│       └── userValidator.js      # Joi validation schemas
├── scripts/
│   └── seedUsers.js              # Generate & insert 5,000+ test users
├── postman/
│   └── BulkUserManagement.postman_collection.json
├── .env.example
├── package.json
└── README.md
```

---

## Setup & Run

### 1. Prerequisites

- Node.js ≥ 18
- MongoDB running locally on port `27017` (or provide a MongoDB Atlas URI)

### 2. Install dependencies

```bash
cd bulk-user-management
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set MONGO_URI
```

### 4. Start the server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

### 5. Seed 5,000 test users

```bash
node scripts/seedUsers.js           # 5,000 users (default)
node scripts/seedUsers.js 10000     # 10,000 users
node scripts/seedUsers.js 5000 --clear  # Clear old seed data first
```

---

## Environment Variables

| Variable               | Default                                          | Description                          |
|------------------------|--------------------------------------------------|--------------------------------------|
| `NODE_ENV`             | `development`                                    | Environment                          |
| `PORT`                 | `5000`                                           | HTTP server port                     |
| `MONGO_URI`            | `mongodb://localhost:27017/bulk_user_management` | MongoDB connection string            |
| `MAX_BULK_INSERT`      | `10000`                                          | Max users per bulk create request    |
| `BULK_INSERT_BATCH_SIZE`| `500`                                           | Records per DB batch                 |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min)                                | Rate limit window                    |
| `RATE_LIMIT_MAX`       | `100`                                            | Max requests per window              |

---

## API Reference

### Base URL: `http://localhost:5000`

---

### Health

| Method | Path      | Description         |
|--------|-----------|---------------------|
| GET    | `/health` | Server + DB status  |
| GET    | `/`       | API info & endpoint list |

---

### Users

| Method | Path                    | Description                           |
|--------|-------------------------|---------------------------------------|
| POST   | `/api/users`            | Create single user                    |
| GET    | `/api/users`            | List users (paginated, filterable)    |
| GET    | `/api/users/:id`        | Get user by MongoDB `_id`             |
| PATCH  | `/api/users/:id`        | Update single user                    |
| DELETE | `/api/users/:id`        | Soft-delete single user               |
| POST   | `/api/users/bulk`       | **Bulk create** (5,000–10,000+)       |
| PATCH  | `/api/users/bulk`       | **Bulk update** (filter+update pairs) |
| DELETE | `/api/users/bulk`       | **Bulk soft-delete** by filter        |
| GET    | `/api/users/stats`      | Aggregation stats                     |
| GET    | `/api/users/export`     | Export JSON or BSON (streamed)        |
| GET    | `/api/users/export/stats` | Export preview (count + size estimate)|

---

### Query Parameters — GET /api/users

| Param        | Type    | Example          | Description                   |
|--------------|---------|------------------|-------------------------------|
| `page`       | integer | `1`              | Page number                   |
| `limit`      | integer | `50`             | Records per page (max 500)    |
| `sort`       | string  | `-createdAt`     | Sort field (`-` for descending)|
| `status`     | string  | `active`         | Filter by status              |
| `role`       | string  | `manager`        | Filter by role                |
| `department` | string  | `Engineering`    | Filter by department          |
| `search`     | string  | `venkatesh`      | Full-text search              |

---

### Bulk Create Request Body

```json
{
  "batchSize": 500,
  "users": [
    {
      "firstName": "Arjun",
      "lastName":  "Sharma",
      "email":     "arjun.sharma@example.com",
      "username":  "arjun_sharma",
      "password":  "Secure@123",
      "role":      "user",
      "status":    "active",
      "department": "Engineering",
      "jobTitle":  "Software Engineer",
      "age":       25,
      "gender":    "male"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk insert completed: 5000 inserted, 0 duplicates",
  "data": {
    "requested":     5000,
    "inserted":      5000,
    "duplicates":    0,
    "errors":        [],
    "batches":       10,
    "durationSeconds": 4.21,
    "insertRate":    "1187 users/sec"
  }
}
```

---

### Bulk Update Request Body

```json
{
  "operations": [
    {
      "filter": { "department": "Engineering" },
      "update": { "tags": ["backend", "verified"] }
    },
    {
      "filter": { "role": "viewer", "status": "pending" },
      "update": { "status": "active", "isVerified": true }
    }
  ]
}
```

---

## Database Indexing Strategy

| Index Name              | Fields                              | Type      | Purpose                            |
|-------------------------|-------------------------------------|-----------|------------------------------------|
| `idx_email_unique`      | `email`                             | Unique    | Enforce uniqueness, login lookups  |
| `idx_username_unique`   | `username`                          | Unique    | Enforce uniqueness, profile lookups|
| `idx_role`              | `role`                              | Single    | Filter by role                     |
| `idx_status`            | `status`                            | Single    | Filter by status                   |
| `idx_department`        | `department`                        | Single    | Filter by department               |
| `idx_isDeleted`         | `isDeleted`                         | Single    | Exclude soft-deleted docs          |
| `idx_status_role`       | `status, role`                      | Compound  | Combined role+status filters       |
| `idx_dept_status`       | `department, status`                | Compound  | Department dashboard queries       |
| `idx_active_users_sorted`| `isDeleted, status, createdAt`     | Compound  | Paginated active user lists        |
| `idx_text_search`       | `firstName, lastName, email, dept`  | Text      | Full-text search                   |

---

## Export Formats

### JSON Export
```
GET /api/users/export?format=json
```
- Streamed as a JSON array
- Compatible with any JSON tool or `mongoimport`
- Can filter by `status`, `role`, `department`

### BSON Export
```
GET /api/users/export?format=bson
```
- Streamed as raw BSON bytes
- Compatible with `mongorestore`
- Smaller file size than JSON (~20% smaller)

**Restore BSON with mongorestore:**
```bash
mongorestore --db bulk_user_management --collection users users_export_2025-01-01.bson
```

---

## Bulk Operations Guide

### Performance Notes

- Default `batchSize` is **500**. For very large inserts (10,000+), you can increase to `1000`.
- `ordered: false` is used so MongoDB continues inserting other documents if one fails (e.g. duplicate).
- Password hashing uses **bcrypt cost 10** during bulk ops (vs 12 for single users) for speed.
- Use the **seed script** to test with 5,000 or 10,000 records before going live.

### Expected Throughput

| Operation       | ~Throughput         |
|-----------------|---------------------|
| Bulk Insert     | 800–2,000 users/sec |
| Bulk Update     | 3,000–8,000 ops/sec |
| Export JSON     | Streamed (no timeout)|
| Export BSON     | Streamed (no timeout)|

---

## Postman Collection

Import the file at `postman/BulkUserManagement.postman_collection.json` into Postman.

The collection includes:
- Health check & API info
- Full CRUD for single users
- Bulk create (5-user sample + instructions for 5,000)
- Bulk update by department and by email list
- Bulk delete
- List with all filter combinations
- Export JSON & BSON
- Error case tests (validation, 404, bad format)