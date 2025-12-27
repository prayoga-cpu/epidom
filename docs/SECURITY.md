# Security

## Overview

EPIDOM implements multiple security layers to protect user data and prevent unauthorized access.

---

## Authentication Security

### Session Management

- Sessions stored in database (not JWT)
- Signed cookie tokens
- Configurable session expiry
- Automatic session cleanup

### Cookie Security

```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}
```

### Password Security

- Passwords hashed with bcrypt (via Better Auth)
- Minimum 8 characters enforced at validation

---

## Authorization

### Store Ownership Verification

Every store-scoped API route verifies ownership:

```typescript
async function verifyStoreOwnership(userId: string, storeId: string) {
  const store = await storeRepository.findById(storeId);
  if (!store) throw new NotFoundError("Store");

  const business = await businessRepository.findByUserId(userId);
  if (store.businessId !== business?.id) {
    throw new ForbiddenError("Access denied to this store");
  }

  return true;
}
```

### API Route Protection

```typescript
export const GET = withApiHandler(
  async (request, { userId, storeId }) => {
    // storeId is verified to belong to userId
  },
  { requireStoreAuth: true }
);
```

---

## Input Validation

### Zod Schema Validation

All API inputs are validated with Zod:

```typescript
const createMaterialSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  unitCost: z.number().positive(),
});

// Usage
const data = createMaterialSchema.parse(await request.json());
```

### SQL Injection Prevention

- Prisma ORM with parameterized queries
- No raw SQL with user input
- Type-safe database operations

---

## Rate Limiting

### Per-Endpoint Limits

| Category           | Limit        |
| ------------------ | ------------ |
| Authentication     | 5-10 req/min |
| CRUD operations    | 100 req/min  |
| Export/Import      | 10 req/min   |
| Payment operations | 5 req/min    |

### Implementation

```typescript
const result = await checkRateLimit(userId, "/api/stores/[id]/materials");
if (!result.success) {
  throw new RateLimitExceededError(result.reset);
}
```

---

## Stripe Security

### Webhook Verification

```typescript
const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
```

### Sensitive Data

- No card numbers stored
- Stripe handles PCI compliance
- Only Stripe customer IDs stored

---

## Headers

### Security Headers (via Next.js)

```typescript
// next.config.ts
headers: [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];
```

---

## Environment Variables

### Secret Management

- Never commit `.env` files
- Use Vercel environment variables in production
- Different secrets per environment

### Required Secrets

| Variable                | Description          |
| ----------------------- | -------------------- |
| `BETTER_AUTH_SECRET`    | Min 32 chars, random |
| `NEXTAUTH_SECRET`       | Session encryption   |
| `STRIPE_SECRET_KEY`     | API access           |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |

---

## Best Practices

1. **Never trust client input** - Always validate on server
2. **Use HTTPS only** - Enforced in production
3. **Minimal permissions** - Store-scoped access
4. **Audit logging** - Stock movements tracked
5. **Error sanitization** - Internal errors not exposed
