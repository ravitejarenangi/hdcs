/**
 * Role Hierarchy and Permission Management
 * 
 * Hierarchy: ADMIN → PANCHAYAT_SECRETARY → FIELD_OFFICER
 * 
 * - ADMIN: Highest level, can manage all users including other admins, panchayat secretaries, and field officers
 * - PANCHAYAT_SECRETARY: Mid level, can only manage field officers within their assigned mandal
 * - FIELD_OFFICER: Lowest level, cannot manage any users
 */

export type Role = "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER"

/**
 * Role hierarchy levels (higher number = higher authority)
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 3,
  PANCHAYAT_SECRETARY: 2,
  FIELD_OFFICER: 1,
}

/**
 * Check if a role has higher or equal authority than another role
 * @param role1 - The role to check
 * @param role2 - The role to compare against
 * @returns true if role1 has higher or equal authority than role2
 */
export function hasHigherOrEqualAuthority(role1: Role, role2: Role): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2]
}

/**
 * Check if a role has higher authority than another role
 * @param role1 - The role to check
 * @param role2 - The role to compare against
 * @returns true if role1 has higher authority than role2
 */
export function hasHigherAuthority(role1: Role, role2: Role): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2]
}

/**
 * Get roles that a user can manage based on their role
 * @param userRole - The user's role
 * @returns Array of roles that the user can manage
 */
export function getManageableRoles(userRole: Role): Role[] {
  switch (userRole) {
    case "ADMIN":
      // Admin can manage all roles including other admins
      return ["ADMIN", "PANCHAYAT_SECRETARY", "FIELD_OFFICER"]
    case "PANCHAYAT_SECRETARY":
      // Panchayat Secretary can only manage field officers
      return ["FIELD_OFFICER"]
    case "FIELD_OFFICER":
      // Field Officer cannot manage any users
      return []
    default:
      return []
  }
}

/**
 * Check if a user can manage a specific role
 * @param userRole - The user's role
 * @param targetRole - The role to manage
 * @returns true if the user can manage the target role
 */
export function canManageRole(userRole: Role, targetRole: Role): boolean {
  const manageableRoles = getManageableRoles(userRole)
  return manageableRoles.includes(targetRole)
}

/**
 * Check if a user can view/access a specific role's data
 * @param userRole - The user's role
 * @param targetRole - The role to view
 * @returns true if the user can view the target role's data
 */
export function canViewRole(userRole: Role, targetRole: Role): boolean {
  // Admin can view all roles
  if (userRole === "ADMIN") {
    return true
  }
  
  // Panchayat Secretary can view field officers
  if (userRole === "PANCHAYAT_SECRETARY" && targetRole === "FIELD_OFFICER") {
    return true
  }
  
  // Users can view their own role
  if (userRole === targetRole) {
    return true
  }
  
  return false
}

/**
 * Get the role display name
 * @param role - The role
 * @returns The display name of the role
 */
export function getRoleDisplayName(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "Admin"
    case "PANCHAYAT_SECRETARY":
      return "Panchayat Secretary"
    case "FIELD_OFFICER":
      return "Field Officer"
    default:
      return role
  }
}

/**
 * Get the role description
 * @param role - The role
 * @returns The description of the role
 */
export function getRoleDescription(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "System administrator with full access to all features and user management"
    case "PANCHAYAT_SECRETARY":
      return "Manages field officers within assigned mandal and views mandal-level analytics"
    case "FIELD_OFFICER":
      return "Updates resident data within assigned secretariats"
    default:
      return ""
  }
}

/**
 * Validate if a role is valid
 * @param role - The role to validate
 * @returns true if the role is valid
 */
export function isValidRole(role: string): role is Role {
  return ["ADMIN", "PANCHAYAT_SECRETARY", "FIELD_OFFICER"].includes(role)
}

/**
 * Get all available roles
 * @returns Array of all roles
 */
export function getAllRoles(): Role[] {
  return ["ADMIN", "PANCHAYAT_SECRETARY", "FIELD_OFFICER"]
}

/**
 * Get role hierarchy level
 * @param role - The role
 * @returns The hierarchy level (higher number = higher authority)
 */
export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY[role]
}

/**
 * Check if a user can create a new user with a specific role
 * @param userRole - The user's role
 * @param newUserRole - The role of the new user to create
 * @returns true if the user can create a new user with the specified role
 */
export function canCreateUserWithRole(userRole: Role, newUserRole: Role): boolean {
  return canManageRole(userRole, newUserRole)
}

/**
 * Check if a user can update another user
 * @param userRole - The user's role
 * @param targetUserRole - The target user's role
 * @returns true if the user can update the target user
 */
export function canUpdateUser(userRole: Role, targetUserRole: Role): boolean {
  return canManageRole(userRole, targetUserRole)
}

/**
 * Check if a user can delete/deactivate another user
 * @param userRole - The user's role
 * @param targetUserRole - The target user's role
 * @returns true if the user can delete/deactivate the target user
 */
export function canDeleteUser(userRole: Role, targetUserRole: Role): boolean {
  return canManageRole(userRole, targetUserRole)
}

/**
 * Check if a user can reset another user's password
 * @param userRole - The user's role
 * @param targetUserRole - The target user's role
 * @returns true if the user can reset the target user's password
 */
export function canResetPassword(userRole: Role, targetUserRole: Role): boolean {
  return canManageRole(userRole, targetUserRole)
}

