import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../services/tokenService';
import { AuthenticationError } from '../../utils/errors';
import { UserRole, Permission } from '../../config/roles';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    sub: string; // JWT subject (same as id)
    email: string;
    sessionId: string;
    role?: UserRole;
    permissions?: Permission[];
  };
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('No authorization header');
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      throw new AuthenticationError('Invalid authorization header format');
    }

    const payload = await TokenService.verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      sub: payload.sub, // Keep both for compatibility
      ...(payload.role && { role: payload.role }),
      ...(payload.permissions && { permissions: payload.permissions })
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  authenticate(req, res, next);
}