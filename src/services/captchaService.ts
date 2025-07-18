import { env } from '../config/env';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

export class CaptchaService {
  private static readonly VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  
  /**
   * Verify a Cloudflare Turnstile CAPTCHA token
   * @param token The CAPTCHA token from the frontend
   * @param remoteIp Optional remote IP address
   * @returns True if verification succeeds
   * @throws AppError if verification fails
   */
  static async verify(token: string, remoteIp?: string): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token
      });

      // Add remote IP if provided
      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await fetch(this.VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        logger.error('Turnstile API request failed', {
          status: response.status,
          statusText: response.statusText
        });
        throw new AppError('CAPTCHA_VERIFICATION_FAILED', 'Failed to verify CAPTCHA', 400);
      }

      const data = await response.json() as TurnstileVerifyResponse;

      if (!data.success) {
        logger.warn('Turnstile verification failed', {
          errorCodes: data['error-codes'],
          hostname: data.hostname
        });

        // Map specific error codes to user-friendly messages
        const errorCode = data['error-codes']?.[0];
        let errorMessage = 'CAPTCHA verification failed';

        switch (errorCode) {
          case 'missing-input-secret':
            logger.error('Turnstile secret key is missing');
            errorMessage = 'Server configuration error';
            break;
          case 'invalid-input-secret':
            logger.error('Turnstile secret key is invalid');
            errorMessage = 'Server configuration error';
            break;
          case 'missing-input-response':
            errorMessage = 'CAPTCHA token is required';
            break;
          case 'invalid-input-response':
            errorMessage = 'Invalid or expired CAPTCHA token';
            break;
          case 'bad-request':
            errorMessage = 'Invalid CAPTCHA request';
            break;
          case 'timeout-or-duplicate':
            errorMessage = 'CAPTCHA token has expired or already been used';
            break;
          case 'internal-error':
            errorMessage = 'CAPTCHA service temporarily unavailable';
            break;
        }

        throw new AppError('CAPTCHA_VERIFICATION_FAILED', errorMessage, 400);
      }

      logger.debug('Turnstile verification successful', {
        challengeTs: data.challenge_ts,
        hostname: data.hostname
      });

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Unexpected error during CAPTCHA verification', error);
      throw new AppError('CAPTCHA_VERIFICATION_ERROR', 'Failed to verify CAPTCHA', 500);
    }
  }

  /**
   * Check if CAPTCHA is enabled for a specific action
   * @param action The action to check (e.g., 'register', 'login')
   * @returns True if CAPTCHA is required for this action
   */
  static isRequired(action: string): boolean {
    // You can customize this based on your requirements
    // For now, we'll enable it for registration and login in production
    if (env.NODE_ENV !== 'production') {
      return false;
    }

    const requiredActions = ['register', 'login', 'forgot-password'];
    return requiredActions.includes(action);
  }
}