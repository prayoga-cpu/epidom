# Troubleshooting Guide

## Common Issues

### Database Connection

#### Error: "Can't reach database server"

**Cause:** Database URL is incorrect or database is unavailable.

**Solution:**

1. Verify `DATABASE_URL` format:
   ```
   postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
   ```
2. Check if database is running
3. Verify network access (IP whitelist for cloud DBs)

#### Error: "P2002: Unique constraint failed"

**Cause:** Trying to create a record that violates unique constraint (e.g., duplicate SKU).

**Solution:**

- Check if the SKU/email already exists
- Use the update endpoint instead of create

---

### Authentication

#### Error: "Unauthorized" on all API calls

**Cause:** Session cookie not being sent or expired.

**Solution:**

1. Clear cookies and log in again
2. Check `BETTER_AUTH_SECRET` matches between deployments
3. Ensure cookies are set for the correct domain

#### Error: "Invalid session token"

**Cause:** Cookie signature verification failed.

**Solution:**

1. Ensure `BETTER_AUTH_SECRET` is consistent
2. Clear browser cookies
3. Re-authenticate

---

### Stripe

#### Webhooks not working

**Cause:** Webhook secret mismatch or endpoint not accessible.

**Solution:**

1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Check endpoint URL is correct: `https://domain.com/api/webhooks/stripe`
3. Test with Stripe CLI locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

#### Error: "No such customer"

**Cause:** Stripe customer ID mismatch between environments.

**Solution:**

1. Use separate Stripe accounts for dev/prod
2. Clear local database if switching Stripe accounts

---

### Build Errors

#### Error: "Module not found"

**Cause:** Missing dependencies or incorrect imports.

**Solution:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules .next
pnpm install
```

#### Error: "Prisma client not generated"

**Cause:** Prisma client not generated after schema changes.

**Solution:**

```bash
pnpm db:generate
```

---

### Performance

#### Slow API responses

**Possible causes:**

1. Missing database indexes
2. N+1 query problems
3. Large dataset without pagination

**Solutions:**

1. Check Prisma logs for slow queries
2. Use pagination parameters (`skip`, `take`)
3. Verify indexes exist on frequently queried columns

#### High memory usage

**Cause:** Connection pool exhaustion or memory leaks.

**Solution:**

1. Use connection pooling for serverless:
   ```
   DATABASE_URL="...?pgbouncer=true"
   ```
2. Limit concurrent connections in Prisma

---

### Deployment

#### Vercel build fails

**Common causes:**

1. TypeScript errors
2. Missing environment variables
3. ESLint errors

**Solution:**

```bash
# Test locally first
pnpm build
```

#### Environment variables not working

**Cause:** Variables not set in Vercel project settings.

**Solution:**

1. Go to Vercel → Project → Settings → Environment Variables
2. Add all required variables
3. Redeploy

---

## Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/your-org/epidom/issues)
2. Search existing discussions
3. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (Node version, OS)
