import { createClient } from '@/lib/supabase/server'
import {
  Permission,
  hasPermission,
  canManageCampaigns,
  isInternalUser as checkIsInternal,
} from '@/lib/permissions'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * User record from database with fields needed for auth context
 */
export interface UserRecord {
  id: string
  organization_id: string | null
  role: string
  is_internal: boolean | null
}

/**
 * Context passed to authenticated handlers
 */
export interface AuthContext {
  userId: string
  userEmail: string | null
  userRecord: UserRecord
  supabase: SupabaseClient
  isInternal: boolean
  organizationId: string | null
}

/**
 * Options for withAuth wrapper
 */
export interface WithAuthOptions {
  /** Permission to check (e.g., 'org:update', 'team:invite') */
  permission?: Permission
  /** Custom permission check function */
  check?: (ctx: AuthContext) => boolean
  /** Custom error message for permission denial */
  permissionError?: string
  /** Require user to have an organization */
  requireOrganization?: boolean
}

/**
 * Result type that can be either a success response or an error
 */
export type AuthResult<T> = T | { error: string }

/**
 * Type guard to check if a result is an auth error
 */
export function isAuthError<T>(result: AuthResult<T>): result is { error: string } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as { error: unknown }).error === 'string'
  )
}

/**
 * Wraps a server action handler with authentication and authorization checks
 *
 * @example
 * ```ts
 * export async function deleteCampaign(campaignId: string) {
 *   return withAuth(async (ctx) => {
 *     await ctx.supabase.from('campaigns').delete()
 *       .eq('id', campaignId)
 *       .eq('organization_id', ctx.organizationId!)
 *     revalidatePath('/dashboard/campaigns')
 *     return { success: true }
 *   }, { permission: 'campaigns:delete' })
 * }
 * ```
 */
export async function withAuth<T>(
  handler: (ctx: AuthContext) => Promise<T>,
  options?: WithAuthOptions
): Promise<AuthResult<T>> {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Fetch user record
  const { data: userRecord } = await supabase
    .from('users')
    .select('id, organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { error: 'User not found' }
  }

  const isInternal = checkIsInternal(userRecord)

  // Build context
  const ctx: AuthContext = {
    userId: user.id,
    userEmail: user.email ?? null,
    userRecord: userRecord as UserRecord,
    supabase,
    isInternal,
    organizationId: userRecord.organization_id,
  }

  // Check organization requirement
  if (options?.requireOrganization && !ctx.organizationId) {
    return { error: options.permissionError ?? 'Organization required' }
  }

  // Check permission
  if (options?.permission && !hasPermission(userRecord.role, options.permission)) {
    return {
      error: options.permissionError ?? `You don't have permission to perform this action`,
    }
  }

  // Check custom permission
  if (options?.check && !options.check(ctx)) {
    return {
      error: options.permissionError ?? `You don't have permission to perform this action`,
    }
  }

  // Execute handler
  return handler(ctx)
}

// ============================================================
// Convenience wrappers for common permission patterns
// ============================================================

/**
 * Requires 'org:update' permission (admins and developers)
 */
export async function withAdminAuth<T>(
  handler: (ctx: AuthContext) => Promise<T>
): Promise<AuthResult<T>> {
  return withAuth(handler, {
    permission: 'org:update',
    permissionError: "You don't have permission to manage organization settings",
  })
}

/**
 * Requires 'team:invite' permission (admins only)
 */
export async function withTeamAuth<T>(
  handler: (ctx: AuthContext) => Promise<T>
): Promise<AuthResult<T>> {
  return withAuth(handler, {
    permission: 'team:invite',
    permissionError: "You don't have permission to manage team members",
  })
}

/**
 * Requires campaign management permissions (admins and team members)
 */
export async function withCampaignAuth<T>(
  handler: (ctx: AuthContext) => Promise<T>
): Promise<AuthResult<T>> {
  return withAuth(handler, {
    check: (ctx) => canManageCampaigns(ctx.userRecord.role),
    permissionError: "You don't have permission to manage campaigns",
    requireOrganization: true,
  })
}

/**
 * Requires internal user status (Selo employees)
 */
export async function withInternalAuth<T>(
  handler: (ctx: AuthContext) => Promise<T>
): Promise<AuthResult<T>> {
  return withAuth(handler, {
    check: (ctx) => ctx.isInternal,
    permissionError: 'Only internal users can perform this action',
  })
}

/**
 * Requires 'integrations:manage' permission (admins only)
 */
export async function withIntegrationsAuth<T>(
  handler: (ctx: AuthContext) => Promise<T>
): Promise<AuthResult<T>> {
  return withAuth(handler, {
    permission: 'integrations:manage',
    permissionError: "You don't have permission to manage integrations",
    requireOrganization: true,
  })
}
