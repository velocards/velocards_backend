/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines all roles and their associated permissions in the system
 */

// Define all available permissions in the system
export const PERMISSIONS = {
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
} as const;

// Type for permission values
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Define available roles
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPPORT = 'support'
}

// Role configuration with their permissions
export const ROLE_PERMISSIONS: Record<UserRole, {
  name: string;
  description: string;
  permissions: Permission[];
}> = {
  [UserRole.USER]: {
    name: 'User',
    description: 'Regular platform user with standard permissions',
    permissions: [
      // Profile management
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.PROFILE_UPDATE,
      PERMISSIONS.SETTINGS_UPDATE,
      
      // Balance access
      PERMISSIONS.BALANCE_READ,
      PERMISSIONS.BALANCE_HISTORY,
      
      // Card operations
      PERMISSIONS.CARDS_CREATE,
      PERMISSIONS.CARDS_READ,
      PERMISSIONS.CARDS_UPDATE,
      PERMISSIONS.CARDS_DELETE,
      PERMISSIONS.CARDS_FREEZE,
      PERMISSIONS.CARDS_UNFREEZE,
      
      // Transaction access
      PERMISSIONS.TRANSACTIONS_READ,
      PERMISSIONS.TRANSACTIONS_EXPORT,
      PERMISSIONS.TRANSACTIONS_DISPUTE,
      PERMISSIONS.TRANSACTIONS_CREATE,
      
      // Crypto operations
      PERMISSIONS.CRYPTO_DEPOSIT,
      PERMISSIONS.CRYPTO_WITHDRAW,
      PERMISSIONS.CRYPTO_RATES,
      
      // Invoice access
      PERMISSIONS.INVOICES_READ,
      PERMISSIONS.INVOICES_UPDATE,
      PERMISSIONS.INVOICES_SEND
    ]
  },
  
  [UserRole.ADMIN]: {
    name: 'Administrator',
    description: 'Full system access with administrative privileges',
    permissions: [
      // All user permissions
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.PROFILE_UPDATE,
      PERMISSIONS.SETTINGS_UPDATE,
      PERMISSIONS.BALANCE_READ,
      PERMISSIONS.BALANCE_HISTORY,
      PERMISSIONS.CARDS_CREATE,
      PERMISSIONS.CARDS_READ,
      PERMISSIONS.CARDS_UPDATE,
      PERMISSIONS.CARDS_DELETE,
      PERMISSIONS.CARDS_FREEZE,
      PERMISSIONS.CARDS_UNFREEZE,
      PERMISSIONS.TRANSACTIONS_READ,
      PERMISSIONS.TRANSACTIONS_EXPORT,
      PERMISSIONS.TRANSACTIONS_DISPUTE,
      PERMISSIONS.TRANSACTIONS_CREATE,
      PERMISSIONS.CRYPTO_DEPOSIT,
      PERMISSIONS.CRYPTO_WITHDRAW,
      PERMISSIONS.CRYPTO_RATES,
      PERMISSIONS.INVOICES_READ,
      PERMISSIONS.INVOICES_UPDATE,
      PERMISSIONS.INVOICES_SEND,
      PERMISSIONS.INVOICES_CREATE,
      
      // Admin-specific permissions
      PERMISSIONS.USERS_LIST,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.CARDS_ADMIN,
      PERMISSIONS.TRANSACTIONS_ADMIN,
      PERMISSIONS.SYSTEM_ADMIN,
      PERMISSIONS.MASTER_ACCOUNT,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_GENERATE
    ]
  },
  
  [UserRole.SUPPORT]: {
    name: 'Support',
    description: 'Customer support with limited administrative access',
    permissions: [
      // View-only permissions
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.BALANCE_READ,
      PERMISSIONS.BALANCE_HISTORY,
      PERMISSIONS.CARDS_READ,
      PERMISSIONS.TRANSACTIONS_READ,
      
      // Support-specific permissions
      PERMISSIONS.USERS_LIST,
      PERMISSIONS.TRANSACTIONS_DISPUTE,
      PERMISSIONS.REPORTS_VIEW
    ]
  }
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const roleConfig = ROLE_PERMISSIONS[role];
  return roleConfig ? roleConfig.permissions.includes(permission) : false;
}

/**
 * Check if a role has all specified permissions
 */
export function roleHasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => roleHasPermission(role, permission));
}

/**
 * Check if a role has any of the specified permissions
 */
export function roleHasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => roleHasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role]?.permissions || [];
}

/**
 * Validate if a string is a valid role
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Get default role for new users
 */
export function getDefaultRole(): UserRole {
  return UserRole.USER;
}