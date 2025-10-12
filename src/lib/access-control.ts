/**
 * Role-Based Access Control for Data Filtering
 * 
 * This module provides utilities to enforce data access restrictions based on user roles:
 * - ADMIN: Can access all data
 * - PANCHAYAT_SECRETARY: Can only access data from their assigned mandal
 * - FIELD_OFFICER: Can only access data from their assigned secretariats
 */

import type { Role } from "./roles"

export interface UserSession {
  id: string
  role: Role
  mandalName?: string | null
  assignedSecretariats?: string | null
}

export interface SecretariatAssignment {
  mandalName: string
  secName: string
}

/**
 * Parse assigned secretariats from JSON string
 * @param assignedSecretariats - JSON string of secretariat assignments
 * @returns Array of secretariat assignments
 */
export function parseAssignedSecretariats(
  assignedSecretariats: string | null | undefined
): SecretariatAssignment[] {
  if (!assignedSecretariats) return []
  
  try {
    const parsed = JSON.parse(assignedSecretariats)
    if (!Array.isArray(parsed)) return []
    
    return parsed.filter(
      (item): item is SecretariatAssignment =>
        typeof item === "object" &&
        item !== null &&
        typeof item.mandalName === "string" &&
        typeof item.secName === "string"
    )
  } catch {
    return []
  }
}

/**
 * Build Prisma where clause for resident data based on user role
 * @param user - User session object
 * @returns Prisma where clause object
 */
export function buildResidentAccessFilter(user: UserSession): {
  OR?: Array<{ mandalName: string; secName: string }>
  mandalName?: string
} {
  // ADMIN: No restrictions
  if (user.role === "ADMIN") {
    return {}
  }

  // PANCHAYAT_SECRETARY: Filter by assigned mandal
  if (user.role === "PANCHAYAT_SECRETARY") {
    if (!user.mandalName) {
      throw new Error("Panchayat Secretary must have an assigned mandal")
    }
    return { mandalName: user.mandalName }
  }

  // FIELD_OFFICER: Filter by assigned secretariats
  if (user.role === "FIELD_OFFICER") {
    const secretariats = parseAssignedSecretariats(user.assignedSecretariats)
    
    if (secretariats.length === 0) {
      throw new Error("Field Officer must have assigned secretariats")
    }

    // Build OR clause for each secretariat (mandalName + secName combination)
    return {
      OR: secretariats.map((sec) => ({
        mandalName: sec.mandalName,
        secName: sec.secName,
      })),
    }
  }

  // Unknown role: No access
  return { mandalName: "__NO_ACCESS__" }
}

/**
 * Check if a user can access a specific resident
 * @param user - User session object
 * @param resident - Resident object with mandalName and secName
 * @returns true if user can access the resident
 */
export function canAccessResident(
  user: UserSession,
  resident: { mandalName: string | null; secName: string | null }
): boolean {
  // ADMIN: Can access all residents
  if (user.role === "ADMIN") {
    return true
  }

  // PANCHAYAT_SECRETARY: Can access residents in their mandal
  if (user.role === "PANCHAYAT_SECRETARY") {
    return resident.mandalName === user.mandalName
  }

  // FIELD_OFFICER: Can access residents in their assigned secretariats
  if (user.role === "FIELD_OFFICER") {
    const secretariats = parseAssignedSecretariats(user.assignedSecretariats)
    
    return secretariats.some(
      (sec) =>
        sec.mandalName === resident.mandalName &&
        sec.secName === resident.secName
    )
  }

  return false
}

/**
 * Get accessible mandals for a user
 * @param user - User session object
 * @returns Array of accessible mandal names (empty array means all mandals for ADMIN)
 */
export function getAccessibleMandals(user: UserSession): string[] {
  // ADMIN: Can access all mandals (return empty array to indicate no restriction)
  if (user.role === "ADMIN") {
    return []
  }

  // PANCHAYAT_SECRETARY: Can access only their assigned mandal
  if (user.role === "PANCHAYAT_SECRETARY") {
    return user.mandalName ? [user.mandalName] : []
  }

  // FIELD_OFFICER: Can access mandals from their assigned secretariats
  if (user.role === "FIELD_OFFICER") {
    const secretariats = parseAssignedSecretariats(user.assignedSecretariats)
    const uniqueMandals = [...new Set(secretariats.map((sec) => sec.mandalName))]
    return uniqueMandals
  }

  return []
}

/**
 * Get accessible secretariats for a user in a specific mandal
 * @param user - User session object
 * @param mandalName - Mandal name to filter by
 * @returns Array of accessible secretariat names (empty array means all secretariats for ADMIN/PANCHAYAT_SECRETARY)
 */
export function getAccessibleSecretariats(
  user: UserSession,
  mandalName?: string
): string[] {
  // ADMIN: Can access all secretariats
  if (user.role === "ADMIN") {
    return []
  }

  // PANCHAYAT_SECRETARY: Can access all secretariats in their mandal
  if (user.role === "PANCHAYAT_SECRETARY") {
    if (mandalName && mandalName !== user.mandalName) {
      return [] // No access to secretariats in other mandals
    }
    return [] // Empty array means all secretariats in their mandal
  }

  // FIELD_OFFICER: Can access only their assigned secretariats
  if (user.role === "FIELD_OFFICER") {
    const secretariats = parseAssignedSecretariats(user.assignedSecretariats)
    
    if (mandalName) {
      // Filter by mandal
      return secretariats
        .filter((sec) => sec.mandalName === mandalName)
        .map((sec) => sec.secName)
    }
    
    // Return all assigned secretariats
    return secretariats.map((sec) => sec.secName)
  }

  return []
}

/**
 * Validate if a user can perform a search with given filters
 * @param user - User session object
 * @param filters - Search filters
 * @returns Object with isValid and error message
 */
export function validateSearchFilters(
  user: UserSession,
  filters: {
    mandal?: string
    secretariat?: string
    phc?: string
  }
): { isValid: boolean; error?: string } {
  // ADMIN: Can search with any filters
  if (user.role === "ADMIN") {
    return { isValid: true }
  }

  // PANCHAYAT_SECRETARY: Can only search within their mandal
  if (user.role === "PANCHAYAT_SECRETARY") {
    if (filters.mandal && filters.mandal !== user.mandalName) {
      return {
        isValid: false,
        error: `You can only search within your assigned mandal: ${user.mandalName}`,
      }
    }
    return { isValid: true }
  }

  // FIELD_OFFICER: Can only search within their assigned secretariats
  if (user.role === "FIELD_OFFICER") {
    const secretariats = parseAssignedSecretariats(user.assignedSecretariats)
    
    if (secretariats.length === 0) {
      return {
        isValid: false,
        error: "You do not have any assigned secretariats",
      }
    }

    // If mandal filter is provided, check if it's in their assigned secretariats
    if (filters.mandal) {
      const hasAccessToMandal = secretariats.some(
        (sec) => sec.mandalName === filters.mandal
      )
      
      if (!hasAccessToMandal) {
        return {
          isValid: false,
          error: `You do not have access to mandal: ${filters.mandal}`,
        }
      }
    }

    // If secretariat filter is provided, check if it's in their assigned secretariats
    if (filters.secretariat) {
      const hasAccessToSecretariat = secretariats.some(
        (sec) =>
          sec.secName === filters.secretariat &&
          (!filters.mandal || sec.mandalName === filters.mandal)
      )
      
      if (!hasAccessToSecretariat) {
        return {
          isValid: false,
          error: `You do not have access to secretariat: ${filters.secretariat}`,
        }
      }
    }

    return { isValid: true }
  }

  return { isValid: false, error: "Invalid user role" }
}

