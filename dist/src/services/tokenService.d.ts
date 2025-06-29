import { UserRole, Permission } from '../config/roles';
interface TokenPayload {
    sub: string;
    email: string;
    sessionId: string;
    type: 'access' | 'refresh';
}
interface AccessTokenPayload extends TokenPayload {
    type: 'access';
    role?: UserRole;
    permissions?: Permission[];
}
interface RefreshTokenPayload extends TokenPayload {
    type: 'refresh';
}
export declare class TokenService {
    private static REFRESH_TOKEN_PREFIX;
    private static SESSION_PREFIX;
    static generateTokenPair(userId: string, email: string, role?: UserRole): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    static verifyAccessToken(token: string): Promise<AccessTokenPayload>;
    static verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
    static refreshTokens(refreshToken: string, userRole?: UserRole): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    static revokeSession(sessionId: string): Promise<void>;
    static revokeAllUserSessions(userId: string): Promise<void>;
}
export {};
//# sourceMappingURL=tokenService.d.ts.map