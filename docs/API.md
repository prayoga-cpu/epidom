# API Reference

## Overview

All API endpoints follow RESTful conventions and return standardized responses.

### Base URL

```
/api
```

### Response Format

**Success Response:**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [{ "field": "email", "message": "Invalid email" }]
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Authentication

All protected endpoints require a valid session cookie (`better-auth.session_token`).

### Session

| Endpoint             | Method | Description          |
| -------------------- | ------ | -------------------- |
| `/api/session`       | GET    | Get current session  |
| `/api/auth/[...all]` | \*     | Better Auth handlers |

---

## Stores

| Endpoint           | Method | Description        |
| ------------------ | ------ | ------------------ |
| `/api/stores`      | GET    | List user's stores |
| `/api/stores`      | POST   | Create new store   |
| `/api/stores/[id]` | GET    | Get store by ID    |
| `/api/stores/[id]` | PATCH  | Update store       |
| `/api/stores/[id]` | DELETE | Delete store       |

---

## Materials (Ingredients)

Base: `/api/stores/[storeId]/materials`

| Endpoint            | Method | Description                 |
| ------------------- | ------ | --------------------------- |
| `/materials`        | GET    | List materials with filters |
| `/materials`        | POST   | Create material             |
| `/materials/[id]`   | GET    | Get material by ID          |
| `/materials/[id]`   | PATCH  | Update material             |
| `/materials/[id]`   | DELETE | Delete material             |
| `/materials/bulk`   | DELETE | Bulk delete                 |
| `/materials/export` | GET    | Export to CSV               |

**Query Parameters (GET `/materials`):**

| Param         | Type   | Description                                            |
| ------------- | ------ | ------------------------------------------------------ |
| `search`      | string | Search by name, SKU                                    |
| `category`    | string | Filter by category                                     |
| `stockStatus` | enum   | `in_stock`, `low_stock`, `out_of_stock`, `overstocked` |
| `sortBy`      | string | `name`, `sku`, `currentStock`, `createdAt`             |
| `sortOrder`   | string | `asc`, `desc`                                          |
| `skip`        | number | Pagination offset                                      |
| `take`        | number | Items per page (max 100)                               |

---

## Products

Base: `/api/stores/[storeId]/products`

| Endpoint           | Method | Description    |
| ------------------ | ------ | -------------- |
| `/products`        | GET    | List products  |
| `/products`        | POST   | Create product |
| `/products/[id]`   | GET    | Get product    |
| `/products/[id]`   | PATCH  | Update product |
| `/products/[id]`   | DELETE | Delete product |
| `/products/bulk`   | DELETE | Bulk delete    |
| `/products/export` | GET    | Export to CSV  |

---

## Recipes

Base: `/api/stores/[storeId]/recipes`

| Endpoint                  | Method | Description                 |
| ------------------------- | ------ | --------------------------- |
| `/recipes`                | GET    | List recipes                |
| `/recipes`                | POST   | Create recipe               |
| `/recipes/[id]`           | GET    | Get recipe with ingredients |
| `/recipes/[id]`           | PATCH  | Update recipe               |
| `/recipes/[id]`           | DELETE | Delete recipe               |
| `/recipes/[id]/duplicate` | POST   | Duplicate recipe            |
| `/recipes/export`         | GET    | Export to CSV               |

---

## Suppliers

Base: `/api/stores/[storeId]/suppliers`

| Endpoint          | Method | Description     |
| ----------------- | ------ | --------------- |
| `/suppliers`      | GET    | List suppliers  |
| `/suppliers`      | POST   | Create supplier |
| `/suppliers/[id]` | GET    | Get supplier    |
| `/suppliers/[id]` | PATCH  | Update supplier |
| `/suppliers/[id]` | DELETE | Delete supplier |

---

## Supplier Orders

Base: `/api/stores/[storeId]/supplier-orders`

| Endpoint                | Method | Description         |
| ----------------------- | ------ | ------------------- |
| `/supplier-orders`      | GET    | List orders         |
| `/supplier-orders`      | POST   | Create order        |
| `/supplier-orders/[id]` | GET    | Get order details   |
| `/supplier-orders/[id]` | PATCH  | Update order status |

---

## Production Batches

Base: `/api/stores/[storeId]/production-batches`

| Endpoint                            | Method | Description       |
| ----------------------------------- | ------ | ----------------- |
| `/production-batches`               | GET    | List batches      |
| `/production-batches`               | POST   | Start production  |
| `/production-batches/[id]`          | GET    | Get batch details |
| `/production-batches/[id]/complete` | POST   | Complete batch    |
| `/production-batches/[id]/cancel`   | POST   | Cancel batch      |

---

## Stock Operations

| Endpoint                           | Method | Description             |
| ---------------------------------- | ------ | ----------------------- |
| `/api/stores/[id]/stock/adjust`    | POST   | Manual stock adjustment |
| `/api/stores/[id]/stock/import`    | POST   | CSV import              |
| `/api/stores/[id]/stock-movements` | GET    | Stock movement history  |

---

## Subscriptions

| Endpoint                      | Method | Description                    |
| ----------------------------- | ------ | ------------------------------ |
| `/api/subscriptions/status`   | GET    | Current subscription           |
| `/api/subscriptions/checkout` | POST   | Create checkout session        |
| `/api/subscriptions/setup`    | POST   | Setup intent (card validation) |
| `/api/subscriptions/portal`   | POST   | Customer portal link           |
| `/api/subscriptions/cancel`   | POST   | Cancel subscription            |

---

## Webhooks

| Endpoint               | Method | Description            |
| ---------------------- | ------ | ---------------------- |
| `/api/webhooks/stripe` | POST   | Stripe webhook handler |

---

## Error Codes

| Code                          | HTTP Status | Description        |
| ----------------------------- | ----------- | ------------------ |
| `UNAUTHORIZED`                | 401         | Not authenticated  |
| `FORBIDDEN`                   | 403         | Not authorized     |
| `NOT_FOUND`                   | 404         | Resource not found |
| `VALIDATION_ERROR`            | 400         | Invalid input      |
| `RATE_LIMIT_EXCEEDED`         | 429         | Too many requests  |
| `INTERNAL_ERROR`              | 500         | Server error       |
| `INSUFFICIENT_STOCK`          | 400         | Not enough stock   |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | 403         | Plan limit reached |

---

## Rate Limits

| Endpoint Category | Limit        |
| ----------------- | ------------ |
| Authentication    | 5-10 req/min |
| CRUD Operations   | 100 req/min  |
| Export/Bulk       | 10 req/min   |
| Checkout          | 5 req/min    |
