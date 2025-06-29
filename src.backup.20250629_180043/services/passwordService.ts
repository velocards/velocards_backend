import bcrypt from 'bcryptjs';
import { security } from '../config/env';
import { ValidationError } from '../utils/errors';

export class PasswordService {
  static async hash(password: string): Promise<string> {
    this.validatePassword(password);
    return bcrypt.hash(password, security.bcryptRounds);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validatePassword(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw new ValidationError('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new ValidationError('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new ValidationError('Password must contain at least one number');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      throw new ValidationError('Password must contain at least one special character (!@#$%^&*)');
    }
  }
}