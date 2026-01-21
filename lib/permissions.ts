/**
 * Centralized permissions service for role-based access control.
 *
 * This module provides a single source of truth for permission checks
 * across the application, replacing scattered inline role checks.
 *
 * Note: RLS policies are the security boundary; these checks are for UX.
 */

// Role types matching the database enum
export type UserRole = 'admin' | 'developer' | 'team_member' | 'client_viewer'

// Permission types for all protected operations
export type Permission =
  | 'org:update'
  | 'org:view'
  | 'team:invite'
  | 'team:view'
  | 'integrations:manage'
  | 'campaigns:create'
  | 'campaigns:update'
  | 'campaigns:delete'
  | 'feedback:manage'

// Role-permission mapping - single source of truth
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'org:update',
    'org:view',
    'team:invite',
    'team:view',
    'integrations:manage',
    'campaigns:create',
    'campaigns:update',
    'campaigns:delete',
  ],
  developer: ['org:update', 'org:view', 'team:view', 'feedback:manage'],
  team_member: [
    'org:view',
    'team:view',
    'campaigns:create',
    'campaigns:update',
    'campaigns:delete',
  ],
  client_viewer: ['org:view', 'team:view'],
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false
  const permissions = ROLE_PERMISSIONS[role as UserRole]
  if (!permissions) return false
  return permissions.includes(permission)
}

/**
 * Require a permission or throw an error.
 */
export function requirePermission(role: string | undefined, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`)
  }
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: string | undefined): Permission[] {
  if (!role) return []
  return ROLE_PERMISSIONS[role as UserRole] || []
}

// Convenience helpers for common permission checks

/**
 * Check if user can manage organization settings.
 */
export function canManageOrg(role: string | undefined): boolean {
  return hasPermission(role, 'org:update')
}

/**
 * Check if user can manage team (send invites, manage members).
 */
export function canManageTeam(role: string | undefined): boolean {
  return hasPermission(role, 'team:invite')
}

/**
 * Check if user can manage integrations (connect/disconnect platforms).
 */
export function canManageIntegrations(role: string | undefined): boolean {
  return hasPermission(role, 'integrations:manage')
}

/**
 * Check if user can manage campaigns (create, update, delete).
 */
export function canManageCampaigns(role: string | undefined): boolean {
  return (
    hasPermission(role, 'campaigns:create') &&
    hasPermission(role, 'campaigns:update') &&
    hasPermission(role, 'campaigns:delete')
  )
}

/**
 * Check if user can manage feedback/support features.
 */
export function canManageFeedback(role: string | undefined): boolean {
  return hasPermission(role, 'feedback:manage')
}
