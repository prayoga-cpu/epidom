# Authentication

## Overview

EPIDOM uses **Better Auth** for authentication with support for:

- Email/Password authentication
- Google OAuth
- Session-based authentication with secure cookies

---

## Session Management

### Cookie-based Sessions

Sessions are stored in the database and identified via signed cookies:

```
Cookie: better-auth.session_token=<token>.<signature>
```

### Session Retrieval

**Server-side (Server Components):**

```typescript
import { getSession } from "@/lib/auth";

const session = await getSession();
if (!session?.user) {
  redirect("/login");
}
```

**Client-side:**

```typescript
import { useSession } from "@/lib/auth-client";

const { data: session, isPending } = useSession();
```

---

## API Route Protection

### Using `withApiHandler`

All protected API routes use the `withApiHandler` wrapper:

```typescript
export const GET = withApiHandler(
  async (request, { userId, session }) => {
    // userId is guaranteed to exist here
    return NextResponse.json(createSuccessResponse({ userId }));
  },
  {
    rateLimitEndpoint: "/api/my-route",
    // Optional: requireStoreAuth for store-scoped routes
  }
);
```

### Store-scoped Authorization

For routes that require store ownership:

```typescript
export const GET = withApiHandler(
  async (request, { userId, storeId }) => {
    // storeId is verified to belong to userId
    const data = await service.getData(storeId!);
    return NextResponse.json(createSuccessResponse(data));
  },
  {
    requireStoreAuth: true, // Verifies store ownership
  }
);
```

---

## Login Flow

```
User → /login → Submit credentials
                     ↓
              POST /api/auth/signin
                     ↓
              Verify credentials
                     ↓
              Create session in DB
                     ↓
              Set signed cookie
                     ↓
              Redirect to /store/[id]/dashboard
```

---

## Registration Flow

```
User → /register → Submit form
                      ↓
               POST /api/auth/signup
                      ↓
               Create User in DB
                      ↓
               Create Session
                      ↓
               Redirect to /onboarding
```

---

## OAuth Flow (Google)

1. User clicks "Sign in with Google"
2. Redirect to Google OAuth consent
3. Google redirects back with code
4. Better Auth exchanges code for tokens
5. Create/link user account
6. Create session and set cookie

---

## Protected Routes

Routes are protected via Next.js middleware and page-level checks:

**Protected Pages:**

```typescript
// src/app/(app)/store/[storeId]/page.tsx
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <Dashboard />;
}
```

**Public Pages:**

```typescript
// src/app/(marketing)/page.tsx
// No session check - fully public
```

---

## Security Considerations

1. **Cookie Signing**: Session tokens are signed with `BETTER_AUTH_SECRET`
2. **Secure Cookies**: HttpOnly, Secure (production), SameSite=Lax
3. **Session Expiry**: Configurable TTL with automatic cleanup
4. **Rate Limiting**: Auth endpoints are strictly rate-limited (5-10 req/min)
