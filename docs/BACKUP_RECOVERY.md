# Backup and Disaster Recovery

## Overview

This document outlines the backup strategy and disaster recovery procedures for EPIDOM.

## Backup Strategy

### Database Backups

#### Automated Backups (Recommended for Production)

If using Vercel Postgres, Supabase, or similar managed services:

| Type                   | Frequency  | Retention |
| ---------------------- | ---------- | --------- |
| Point-in-time recovery | Continuous | 7-30 days |
| Daily snapshots        | Daily      | 30 days   |
| Weekly snapshots       | Weekly     | 90 days   |

#### Manual Backup Procedure

For self-hosted PostgreSQL:

```bash
# Create backup
pg_dump -Fc -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup
pg_restore --list backup_*.dump

# Store in secure location (e.g., S3, Google Cloud Storage)
aws s3 cp backup_*.dump s3://your-backup-bucket/epidom/
```

### Application Backups

| Component             | Backup Method                   | Frequency    |
| --------------------- | ------------------------------- | ------------ |
| Source code           | Git repository                  | Every commit |
| Environment variables | Secure vault (1Password, Vault) | On change    |
| Uploaded files        | Vercel Blob (managed)           | Automatic    |

## Disaster Recovery

### Recovery Time Objectives (RTO)

| Scenario                  | Target RTO |
| ------------------------- | ---------- |
| Database corruption       | 1 hour     |
| Application failure       | 15 minutes |
| Total infrastructure loss | 4 hours    |

### Recovery Point Objectives (RPO)

| Data Type        | Target RPO |
| ---------------- | ---------- |
| Transaction data | 5 minutes  |
| User preferences | 24 hours   |
| Analytics        | 7 days     |

## Recovery Procedures

### Scenario 1: Database Restoration

```bash
# 1. Stop application (if needed)
# Disable incoming traffic via Vercel/DNS

# 2. Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup.dump

# 3. Run pending migrations
npx prisma migrate deploy

# 4. Verify data integrity
npx prisma studio

# 5. Resume application
# Re-enable traffic
```

### Scenario 2: Environment Variable Loss

1. Access secure vault (1Password, HashiCorp Vault)
2. Retrieve latest environment variable backup
3. Update in hosting platform (Vercel Dashboard)
4. Redeploy application

### Scenario 3: Complete Redeployment

```bash
# 1. Clone repository
git clone https://github.com/your-org/epidom.git

# 2. Install dependencies
pnpm install

# 3. Restore environment variables
# Copy from secure backup

# 4. Restore database
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup.dump

# 5. Deploy
vercel --prod
```

## Testing Backups

### Monthly Backup Verification

1. Download most recent backup
2. Restore to staging database
3. Run basic smoke tests
4. Verify data integrity with sample queries
5. Document results

### Quarterly DR Drill

1. Simulate complete application failure
2. Execute recovery procedures
3. Measure actual RTO
4. Update procedures based on findings

## Monitoring

### Backup Health Checks

- Daily: Verify backup job completion
- Weekly: Check backup file sizes (detect anomalies)
- Monthly: Test restoration to staging

### Alerts

Configure alerts for:

- Backup job failure
- Backup size deviation (>20% change)
- Storage quota approaching limit

## Contact Information

In case of emergency requiring backup restoration:

1. Primary: [Project Maintainer]
2. Secondary: [DevOps/Platform Team]
3. Escalation: [Management]
