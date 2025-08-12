# Production Migration Safety Checklist

## 🚨 CRITICAL: DO NOT DEPLOY DIRECTLY TO PRODUCTION

### Issues That Will Break Production:

1. **Test Files in Build**
   - Remove `jest.setup.js` from production deployment
   - Exclude `src/__mocks__/` directory from build
   
2. **Missing Database Columns**
   ```sql
   -- Required migrations before deployment:
   ALTER TABLE security_keys ADD COLUMN IF NOT EXISTS key_hash VARCHAR(255);
   
   CREATE TABLE IF NOT EXISTS crypto_prices (
     id VARCHAR(255) PRIMARY KEY,
     currency VARCHAR(10) NOT NULL,
     price DECIMAL(20, 8) NOT NULL,
     cached_at TIMESTAMP NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Environment Variables**
   - Ensure all production env vars are set
   - Do NOT use jest.setup.js values

### Safe Deployment Strategy:

#### Phase 1: Testing (Current)
- [x] Run in development environment
- [ ] Run integration tests against staging database
- [ ] Load test the new repositories

#### Phase 2: Database Preparation
- [ ] Run database migrations in staging
- [ ] Backup production database
- [ ] Run database migrations in production (off-peak hours)

#### Phase 3: Canary Deployment
- [ ] Deploy to 10% of production servers
- [ ] Monitor error rates for 24 hours
- [ ] Check audit logs for anomalies

#### Phase 4: Full Rollout
- [ ] Deploy to remaining servers
- [ ] Keep old repository files for quick rollback

### Rollback Plan:
1. Keep `.old.ts` files for quick reversion
2. Database changes are backward compatible (adding columns, not removing)
3. Can switch back to static methods by renaming files

### Pre-Deployment Checklist:
- [ ] Remove jest.setup.js from deployment
- [ ] Update .gitignore to exclude test files
- [ ] Run production build locally: `NODE_ENV=production npm run build`
- [ ] Test with production-like environment variables
- [ ] Verify database migrations are ready
- [ ] Create feature flag for repository switching

### Monitoring After Deployment:
- Watch for TypeErrors related to logger
- Monitor database connection pool usage
- Check audit_logs table for unusual patterns
- Monitor API response times