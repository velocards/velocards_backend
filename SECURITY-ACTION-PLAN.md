# Security Action Plan for VeloCards Backend

## 🔴 Critical Issues (Fix Immediately)

### 1. Remove Hardcoded Whitelisted IP
**File**: `src/api/middlewares/rateLimiter.ts`
**Issue**: IP address `106.219.163.143` is hardcoded, bypassing all rate limits
**Action**:
```typescript
// Replace with environment variable
const WHITELISTED_IPS = env.RATE_LIMIT_WHITELIST_IPS?.split(',') || [];
```

### 2. Fix Insecure Random Password Generation
**File**: `src/services/passwordService.ts`
**Issue**: Uses Math.random() which is not cryptographically secure
**Action**:
```typescript
import crypto from 'crypto';

static generatePassword(length = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}
```

### 3. Update Vulnerable Dependencies
**Issue**: NPM audit shows 3 low severity vulnerabilities
**Action**:
```bash
npm audit fix
npm update compression morgan
```

## 🟡 High Priority Issues (Fix This Week)

### 4. Enhance Session Security
**File**: `src/services/tokenService.ts`
**Issue**: Falls back to allowing tokens if Redis is unavailable
**Action**: Implement fail-closed behavior when Redis is down

### 5. Add Request Signing
**Action**: Implement HMAC request signing for critical endpoints
- Add signature validation middleware
- Include timestamp to prevent replay attacks
- Document signing process for API clients

### 6. Implement Field-Level Encryption
**Action**: Encrypt sensitive fields at rest
- Card numbers (already masked, but add encryption)
- User PII data
- API keys and secrets

## 🟢 Medium Priority (Next Sprint)

### 7. Security Headers Enhancement
- Add Expect-CT header
- Implement Feature-Policy/Permissions-Policy
- Add Clear-Site-Data for logout

### 8. API Versioning Security
- Add API version headers
- Implement deprecation warnings
- Create version-specific rate limits

### 9. Enhanced Monitoring
- Set up security event alerts
- Implement anomaly detection
- Add failed login attempt tracking

## 🔵 Long-term Improvements

### 10. Security Testing Integration
- Add OWASP ZAP to CI/CD pipeline
- Implement dependency scanning with Snyk
- Regular penetration testing schedule

### 11. Compliance Enhancements
- Document PCI compliance measures
- Implement GDPR data retention policies
- Create security incident response plan

### 12. Infrastructure Security
- Implement WAF rules
- Set up DDoS protection
- Configure intrusion detection

## Implementation Timeline

| Week | Tasks |
|------|-------|
| 1 | Fix critical issues (1-3) |
| 2 | Implement session security & request signing (4-5) |
| 3 | Add field-level encryption (6) |
| 4 | Enhance security headers & API versioning (7-8) |
| 5+ | Long-term improvements |

## Verification Steps

After each fix:
1. Run security tests
2. Check with OWASP ZAP scanner
3. Verify in staging environment
4. Document changes

## Security Contacts

- Security Team: security@velocards.com
- Incident Response: incident@velocards.com
- Bug Bounty: security@velocards.com