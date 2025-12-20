# Security Policy

## Overview

This document outlines the security policies and procedures for the EPIDOM application.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to the project maintainers
3. Include detailed steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Measures

### Authentication

- **Method**: Better Auth with JWT sessions
- **Password Hashing**: bcrypt with appropriate cost factor
- **Session Duration**: 30 days with rolling updates every 24 hours
- **Cookie Security**: HttpOnly, Secure, SameSite=Lax

### Authorization

- Store ownership verification on all protected API routes
- Subscription-based feature access control
- Rate limiting on sensitive endpoints

### Input Validation

- All inputs validated with Zod schemas
- SQL injection prevention via Prisma ORM (parameterized queries)
- XSS prevention through React's default escaping

### Rate Limiting

| Endpoint Type        | Limit                |
| -------------------- | -------------------- |
| Authentication       | 5-10 requests/minute |
| Subscription/Payment | 5 requests/minute    |
| Store CRUD           | 100 requests/minute  |
| Exports/Bulk         | 10 requests/minute   |

## Key Rotation Policy

### Session Secrets

1. **Frequency**: Rotate every 90 days
2. **Procedure**:
   - Generate new `BETTER_AUTH_SECRET`
   - Update environment variable in hosting platform
   - Deploy application - existing sessions will naturally expire

### API Keys (Stripe)

1. **Frequency**: Rotate annually or after suspected compromise
2. **Procedure**:
   - Generate new keys in Stripe Dashboard
   - Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
   - Verify webhook signature verification works
   - Delete old keys in Stripe Dashboard

### Database Credentials

1. **Frequency**: Rotate every 180 days
2. **Procedure**:
   - Create new database user with same permissions
   - Update `DATABASE_URL` environment variable
   - Deploy and verify connectivity
   - Remove old database user

## Incident Response

### Classification

| Severity | Description                                 | Response Time |
| -------- | ------------------------------------------- | ------------- |
| Critical | Data breach, system compromise              | Immediate     |
| High     | Authentication bypass, privilege escalation | 4 hours       |
| Medium   | Information disclosure, abuse potential     | 24 hours      |
| Low      | Minor security improvements                 | 1 week        |

### Response Steps

1. **Identify**: Confirm and assess the incident
2. **Contain**: Limit the impact (disable accounts, rotate keys)
3. **Investigate**: Determine root cause and scope
4. **Remediate**: Fix the vulnerability
5. **Recover**: Restore normal operations
6. **Review**: Document lessons learned

## Dependency Management

- Weekly automated dependency updates via Dependabot
- Security audit on every PR via GitHub Actions
- Manual review of major version updates

## Code Security

- TypeScript strict mode enabled
- ESLint security rules enforced
- No secrets committed to repository
- Environment variables for all sensitive configuration
