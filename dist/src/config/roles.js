"use strict";
/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines all roles and their associated permissions in the system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.UserRole = exports.PERMISSIONS = void 0;
exports.roleHasPermission = roleHasPermission;
exports.roleHasAllPermissions = roleHasAllPermissions;
exports.roleHasAnyPermission = roleHasAnyPermission;
exports.getRolePermissions = getRolePermissions;
exports.isValidRole = isValidRole;
exports.getDefaultRole = getDefaultRole;
// Define all available permissions in the system
exports.PERMISSIONS = {
    // Profile permissions
    PROFILE_READ: 'profile:read',
    PROFILE_UPDATE: 'profile:update',
    // Balance permissions
    BALANCE_READ: 'balance:read',
    BALANCE_HISTORY: 'balance:history',
    // Settings permissions
    SETTINGS_UPDATE: 'settings:update',
    // Card permissions
    CARDS_CREATE: 'cards:create',
    CARDS_READ: 'cards:read',
    CARDS_UPDATE: 'cards:update',
    CARDS_DELETE: 'cards:delete',
    CARDS_FREEZE: 'cards:freeze',
    CARDS_UNFREEZE: 'cards:unfreeze',
    // Transaction permissions
    TRANSACTIONS_READ: 'transactions:read',
    TRANSACTIONS_EXPORT: 'transactions:export',
    TRANSACTIONS_DISPUTE: 'transactions:dispute',
    TRANSACTIONS_CREATE: 'transactions:create',
    // Crypto permissions
    CRYPTO_DEPOSIT: 'crypto:deposit',
    CRYPTO_WITHDRAW: 'crypto:withdraw',
    CRYPTO_RATES: 'crypto:rates',
    // Invoice permissions
    INVOICES_READ: 'invoices:read',
    INVOICES_UPDATE: 'invoices:update',
    INVOICES_SEND: 'invoices:send',
    INVOICES_CREATE: 'invoices:create',
    // Admin permissions
    USERS_LIST: 'users:list',
    USERS_MANAGE: 'users:manage',
    USERS_DELETE: 'users:delete',
    CARDS_ADMIN: 'cards:admin',
    TRANSACTIONS_ADMIN: 'transactions:admin',
    SYSTEM_ADMIN: 'system:admin',
    MASTER_ACCOUNT: 'master:account',
    REPORTS_VIEW: 'reports:view',
    REPORTS_GENERATE: 'reports:generate'
};
// Define available roles
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["SUPPORT"] = "support";
})(UserRole || (exports.UserRole = UserRole = {}));
// Role configuration with their permissions
exports.ROLE_PERMISSIONS = {
    [UserRole.USER]: {
        name: 'User',
        description: 'Regular platform user with standard permissions',
        permissions: [
            // Profile management
            exports.PERMISSIONS.PROFILE_READ,
            exports.PERMISSIONS.PROFILE_UPDATE,
            exports.PERMISSIONS.SETTINGS_UPDATE,
            // Balance access
            exports.PERMISSIONS.BALANCE_READ,
            exports.PERMISSIONS.BALANCE_HISTORY,
            // Card operations
            exports.PERMISSIONS.CARDS_CREATE,
            exports.PERMISSIONS.CARDS_READ,
            exports.PERMISSIONS.CARDS_UPDATE,
            exports.PERMISSIONS.CARDS_DELETE,
            exports.PERMISSIONS.CARDS_FREEZE,
            exports.PERMISSIONS.CARDS_UNFREEZE,
            // Transaction access
            exports.PERMISSIONS.TRANSACTIONS_READ,
            exports.PERMISSIONS.TRANSACTIONS_EXPORT,
            exports.PERMISSIONS.TRANSACTIONS_DISPUTE,
            exports.PERMISSIONS.TRANSACTIONS_CREATE,
            // Crypto operations
            exports.PERMISSIONS.CRYPTO_DEPOSIT,
            exports.PERMISSIONS.CRYPTO_WITHDRAW,
            exports.PERMISSIONS.CRYPTO_RATES,
            // Invoice access
            exports.PERMISSIONS.INVOICES_READ,
            exports.PERMISSIONS.INVOICES_UPDATE,
            exports.PERMISSIONS.INVOICES_SEND
        ]
    },
    [UserRole.ADMIN]: {
        name: 'Administrator',
        description: 'Full system access with administrative privileges',
        permissions: [
            // All user permissions
            exports.PERMISSIONS.PROFILE_READ,
            exports.PERMISSIONS.PROFILE_UPDATE,
            exports.PERMISSIONS.SETTINGS_UPDATE,
            exports.PERMISSIONS.BALANCE_READ,
            exports.PERMISSIONS.BALANCE_HISTORY,
            exports.PERMISSIONS.CARDS_CREATE,
            exports.PERMISSIONS.CARDS_READ,
            exports.PERMISSIONS.CARDS_UPDATE,
            exports.PERMISSIONS.CARDS_DELETE,
            exports.PERMISSIONS.CARDS_FREEZE,
            exports.PERMISSIONS.CARDS_UNFREEZE,
            exports.PERMISSIONS.TRANSACTIONS_READ,
            exports.PERMISSIONS.TRANSACTIONS_EXPORT,
            exports.PERMISSIONS.TRANSACTIONS_DISPUTE,
            exports.PERMISSIONS.TRANSACTIONS_CREATE,
            exports.PERMISSIONS.CRYPTO_DEPOSIT,
            exports.PERMISSIONS.CRYPTO_WITHDRAW,
            exports.PERMISSIONS.CRYPTO_RATES,
            exports.PERMISSIONS.INVOICES_READ,
            exports.PERMISSIONS.INVOICES_UPDATE,
            exports.PERMISSIONS.INVOICES_SEND,
            exports.PERMISSIONS.INVOICES_CREATE,
            // Admin-specific permissions
            exports.PERMISSIONS.USERS_LIST,
            exports.PERMISSIONS.USERS_MANAGE,
            exports.PERMISSIONS.USERS_DELETE,
            exports.PERMISSIONS.CARDS_ADMIN,
            exports.PERMISSIONS.TRANSACTIONS_ADMIN,
            exports.PERMISSIONS.SYSTEM_ADMIN,
            exports.PERMISSIONS.MASTER_ACCOUNT,
            exports.PERMISSIONS.REPORTS_VIEW,
            exports.PERMISSIONS.REPORTS_GENERATE
        ]
    },
    [UserRole.SUPPORT]: {
        name: 'Support',
        description: 'Customer support with limited administrative access',
        permissions: [
            // View-only permissions
            exports.PERMISSIONS.PROFILE_READ,
            exports.PERMISSIONS.BALANCE_READ,
            exports.PERMISSIONS.BALANCE_HISTORY,
            exports.PERMISSIONS.CARDS_READ,
            exports.PERMISSIONS.TRANSACTIONS_READ,
            // Support-specific permissions
            exports.PERMISSIONS.USERS_LIST,
            exports.PERMISSIONS.TRANSACTIONS_DISPUTE,
            exports.PERMISSIONS.REPORTS_VIEW
        ]
    }
};
/**
 * Check if a role has a specific permission
 */
function roleHasPermission(role, permission) {
    const roleConfig = exports.ROLE_PERMISSIONS[role];
    return roleConfig ? roleConfig.permissions.includes(permission) : false;
}
/**
 * Check if a role has all specified permissions
 */
function roleHasAllPermissions(role, permissions) {
    return permissions.every(permission => roleHasPermission(role, permission));
}
/**
 * Check if a role has any of the specified permissions
 */
function roleHasAnyPermission(role, permissions) {
    return permissions.some(permission => roleHasPermission(role, permission));
}
/**
 * Get all permissions for a role
 */
function getRolePermissions(role) {
    return exports.ROLE_PERMISSIONS[role]?.permissions || [];
}
/**
 * Validate if a string is a valid role
 */
function isValidRole(role) {
    return Object.values(UserRole).includes(role);
}
/**
 * Get default role for new users
 */
function getDefaultRole() {
    return UserRole.USER;
}
//# sourceMappingURL=roles.js.map