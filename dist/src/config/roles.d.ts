/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines all roles and their associated permissions in the system
 */
export declare const PERMISSIONS: {
    readonly PROFILE_READ: "profile:read";
    readonly PROFILE_UPDATE: "profile:update";
    readonly BALANCE_READ: "balance:read";
    readonly BALANCE_HISTORY: "balance:history";
    readonly SETTINGS_UPDATE: "settings:update";
    readonly CARDS_CREATE: "cards:create";
    readonly CARDS_READ: "cards:read";
    readonly CARDS_UPDATE: "cards:update";
    readonly CARDS_DELETE: "cards:delete";
    readonly CARDS_FREEZE: "cards:freeze";
    readonly CARDS_UNFREEZE: "cards:unfreeze";
    readonly TRANSACTIONS_READ: "transactions:read";
    readonly TRANSACTIONS_EXPORT: "transactions:export";
    readonly TRANSACTIONS_DISPUTE: "transactions:dispute";
    readonly TRANSACTIONS_CREATE: "transactions:create";
    readonly CRYPTO_DEPOSIT: "crypto:deposit";
    readonly CRYPTO_WITHDRAW: "crypto:withdraw";
    readonly CRYPTO_RATES: "crypto:rates";
    readonly INVOICES_READ: "invoices:read";
    readonly INVOICES_UPDATE: "invoices:update";
    readonly INVOICES_SEND: "invoices:send";
    readonly INVOICES_CREATE: "invoices:create";
    readonly USERS_LIST: "users:list";
    readonly USERS_MANAGE: "users:manage";
    readonly USERS_DELETE: "users:delete";
    readonly CARDS_ADMIN: "cards:admin";
    readonly TRANSACTIONS_ADMIN: "transactions:admin";
    readonly SYSTEM_ADMIN: "system:admin";
    readonly MASTER_ACCOUNT: "master:account";
    readonly REPORTS_VIEW: "reports:view";
    readonly REPORTS_GENERATE: "reports:generate";
    readonly ANNOUNCEMENTS_READ: "announcements:read";
    readonly ANNOUNCEMENTS_MANAGE: "announcements:manage";
};
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export declare enum UserRole {
    USER = "user",
    ADMIN = "admin",
    SUPPORT = "support"
}
export declare const ROLE_PERMISSIONS: Record<UserRole, {
    name: string;
    description: string;
    permissions: Permission[];
}>;
/**
 * Check if a role has a specific permission
 */
export declare function roleHasPermission(role: UserRole, permission: Permission): boolean;
/**
 * Check if a role has all specified permissions
 */
export declare function roleHasAllPermissions(role: UserRole, permissions: Permission[]): boolean;
/**
 * Check if a role has any of the specified permissions
 */
export declare function roleHasAnyPermission(role: UserRole, permissions: Permission[]): boolean;
/**
 * Get all permissions for a role
 */
export declare function getRolePermissions(role: UserRole): Permission[];
/**
 * Validate if a string is a valid role
 */
export declare function isValidRole(role: string): role is UserRole;
/**
 * Get default role for new users
 */
export declare function getDefaultRole(): UserRole;
//# sourceMappingURL=roles.d.ts.map