import { User } from '../repositories/userRepository';
import { RegisterInput, LoginInput } from '../api/validators/authValidators';
import { UserRole } from '../config/roles';
export interface BalanceHistoryParams {
    page: number;
    limit: number;
    from?: Date;
    to?: Date;
    type: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}
export interface BalanceHistoryResult {
    transactions: any[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface UserSettings {
    notifications?: {
        email?: {
            transactions?: boolean;
            security?: boolean;
            marketing?: boolean;
            updates?: boolean;
        };
        sms?: {
            transactions?: boolean;
            security?: boolean;
        };
        push?: {
            transactions?: boolean;
            security?: boolean;
            updates?: boolean;
        };
    };
    security?: {
        twoFactorEnabled?: boolean;
        loginAlerts?: boolean;
        transactionAlerts?: boolean;
        ipWhitelisting?: boolean;
        allowedIps?: string[];
    };
    preferences?: {
        language?: string;
        currency?: string;
        timezone?: string;
        dateFormat?: string;
        theme?: string;
    };
}
export interface UserPublicData {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null | undefined;
    emailVerified: boolean;
    kycStatus: string;
    accountStatus: string;
    virtualBalance: number;
    role: UserRole;
    createdAt: Date;
    tier?: {
        id: string;
        level: number;
        name: string;
        displayName: string;
        description?: string;
        features?: any;
    } | null;
    tierAssignedAt?: Date | null;
}
export declare class UserService {
    static register(data: RegisterInput): Promise<{
        user: UserPublicData;
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
    }>;
    static login(data: LoginInput): Promise<{
        user: UserPublicData;
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
    }>;
    static getProfile(userId: string): Promise<UserPublicData>;
    static updateProfile(userId: string, data: {
        firstName?: string;
        lastName?: string;
        phone?: string | null;
    }): Promise<UserPublicData>;
    static getBalance(userId: string): Promise<{
        balance: number;
        totalSpent: number;
    }>;
    static addBalance(userId: string, amount: number): Promise<void>;
    static deductBalance(userId: string, amount: number): Promise<void>;
    static verifyEmail(userId: string): Promise<void>;
    static getUserProfile(userId: string): Promise<UserPublicData>;
    static updateUserProfile(userId: string, data: any): Promise<UserPublicData>;
    static getUserBalance(userId: string): Promise<User>;
    static getUserAvailableBalance(userId: string): Promise<{
        accountBalance: number;
        activeCardsBalance: number;
        availableBalance: number;
        pendingDeposits: number;
        tierInfo: {
            level: number;
            name: string;
            cardCreationFee: number;
            depositFeePercentage: number;
        };
    }>;
    static getBalanceHistory(userId: string, params: BalanceHistoryParams): Promise<BalanceHistoryResult>;
    static updateUserSettings(userId: string, settings: UserSettings): Promise<UserSettings>;
    private static formatUserResponse;
}
//# sourceMappingURL=userService.d.ts.map