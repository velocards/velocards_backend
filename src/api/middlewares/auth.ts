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

// Express authentication function for tsoa
export async function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[]
): Promise<any> {
  if (securityName === 'Bearer') {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No authorization header');
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new AuthenticationError('Invalid authorization header format');
    }
    
    const token = parts[1];
    
    try {
      const payload = await TokenService.verifyAccessToken(token);
      return {
        id: payload.sub,
        email: payload.email,
        sessionId: payload.sessionId,
        sub: payload.sub,
        ...(payload.role && { role: payload.role }),
        ...(payload.permissions && { permissions: payload.permissions })
      };
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }
  }
  
  throw new AuthenticationError('Unknown security name');
}