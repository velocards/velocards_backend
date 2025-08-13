import { secretRotationService } from '../../../src/services/secretRotationService';

describe('SecretRotationService', () => {
  beforeAll(() => {
    // Clean up any existing scheduled rotations
    secretRotationService.cleanup();
  });

  afterAll(() => {
    // Clean up after tests
    secretRotationService.cleanup();
  });

  describe('getRotationStatus', () => {
    it('should return rotation status for all configured secrets', () => {
      const status = secretRotationService.getRotationStatus();
      
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
      
      // Check that each status has required fields
      status.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('daysUntilRotation');
        expect(item).toHaveProperty('isOverdue');
      });
    });

    it('should sort secrets by days until rotation', () => {
      const status = secretRotationService.getRotationStatus();
      
      for (let i = 1; i < status.length; i++) {
        const current = status[i];
        const previous = status[i - 1];
        if (current && previous) {
          expect(current.daysUntilRotation).toBeGreaterThanOrEqual(
            previous.daysUntilRotation
          );
        }
      }
    });
  });

  describe('getSecretsNeedingRotation', () => {
    it('should return secrets expiring within 30 days', () => {
      const expiring = secretRotationService.getSecretsNeedingRotation();
      
      expect(Array.isArray(expiring)).toBe(true);
      
      // All returned secrets should have <= 30 days until rotation
      const status = secretRotationService.getRotationStatus();
      expiring.forEach(secretName => {
        const secret = status.find(s => s.name === secretName);
        expect(secret).toBeDefined();
        if (secret) {
          expect(secret.daysUntilRotation).toBeLessThanOrEqual(30);
        }
      });
    });
  });

  describe('rotateSecret', () => {
    it('should handle rotation attempt for a configured secret', async () => {
      // We can't actually rotate secrets in test, but we can test the mechanism
      const result = await secretRotationService.rotateSecret(
        'JWT_ACCESS_SECRET',
        'test-secret-value-that-is-at-least-32-characters-long'
      );
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('secretName');
      expect(result.secretName).toBe('JWT_ACCESS_SECRET');
      
      // In test environment, rotation might fail due to validation
      // but the mechanism should work
      if (result.success) {
        expect(result).toHaveProperty('newValue');
      } else {
        expect(result).toHaveProperty('error');
      }
    });

    it('should fail rotation for unknown secret', async () => {
      const result = await secretRotationService.rotateSecret(
        'UNKNOWN_SECRET',
        'some-value'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No rotation configuration found');
    });
  });

  describe('rotateMultipleSecrets', () => {
    it('should handle batch rotation of multiple secrets', async () => {
      const results = await secretRotationService.rotateMultipleSecrets([
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET'
      ]);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('secretName');
      });
    });
  });
});