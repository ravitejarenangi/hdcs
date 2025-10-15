/**
 * Script to safely delete users from specific mandals
 * 
 * This script will:
 * 1. Preview users to be deleted
 * 2. Ask for confirmation
 * 3. Delete users and log the action
 * 
 * Usage:
 *   npx tsx scripts/delete-mandal-users.ts
 */

import { PrismaClient } from "@prisma/client"
import * as readline from "readline"

const prisma = new PrismaClient()

// Mandals to delete users from
const MANDALS_TO_DELETE = [
  "Kuppam",
  "Santhipuram",
  "Ramakuppam",
  "Gudipalle",
]

interface UserToDelete {
  id: string
  username: string
  fullName: string
  role: string
  mandalName: string | null
  assignedSecretariats: string | null
  isActive: boolean
}

// Helper function to parse assignedSecretariats JSON
function parseAssignedSecretariats(assignedSecretariats: string | null): Array<{ mandalName: string; secName: string }> {
  if (!assignedSecretariats) return []
  
  try {
    const parsed = JSON.parse(assignedSecretariats)
    if (!Array.isArray(parsed)) return []
    
    return parsed.map((item: any) => {
      if (typeof item === 'string') {
        // Old format: "MANDAL -> SECRETARIAT"
        const parts = item.split(' -> ')
        return {
          mandalName: parts[0]?.trim() || '',
          secName: parts[1]?.trim() || '',
        }
      } else if (typeof item === 'object' && item.mandalName && item.secName) {
        // New format: {mandalName: "...", secName: "..."}
        return {
          mandalName: item.mandalName,
          secName: item.secName,
        }
      }
      return { mandalName: '', secName: '' }
    }).filter(item => item.mandalName && item.secName)
  } catch (error) {
    console.error('Error parsing assignedSecretariats:', error)
    return []
  }
}

// Check if a Field Officer is assigned to any of the target mandals
function isFieldOfficerInTargetMandals(assignedSecretariats: string | null): boolean {
  const secretariats = parseAssignedSecretariats(assignedSecretariats)
  
  return secretariats.some(sec => 
    MANDALS_TO_DELETE.some(mandal => 
      sec.mandalName.toLowerCase() === mandal.toLowerCase()
    )
  )
}

// Get user-friendly location description
function getLocationDescription(user: UserToDelete): string {
  if (user.role === 'PANCHAYAT_SECRETARY') {
    return `Mandal: ${user.mandalName}`
  } else if (user.role === 'FIELD_OFFICER') {
    const secretariats = parseAssignedSecretariats(user.assignedSecretariats)
    const targetSecretariats = secretariats.filter(sec =>
      MANDALS_TO_DELETE.some(mandal => 
        sec.mandalName.toLowerCase() === mandal.toLowerCase()
      )
    )
    return `Secretariats: ${targetSecretariats.map(s => `${s.mandalName} -> ${s.secName}`).join(', ')}`
  }
  return 'N/A'
}

// Prompt user for confirmation
function askForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

async function main() {
  console.log('🔍 Scanning for users to delete...\n')
  console.log('Target Mandals:', MANDALS_TO_DELETE.join(', '))
  console.log('─'.repeat(80))

  try {
    // Fetch all users (excluding ADMIN)
    const allUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['PANCHAYAT_SECRETARY', 'FIELD_OFFICER'],
        },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        mandalName: true,
        assignedSecretariats: true,
        isActive: true,
      },
    }) as UserToDelete[]

    console.log(`\n📊 Total users in database (excluding ADMIN): ${allUsers.length}`)

    // Filter users to delete
    const usersToDelete = allUsers.filter(user => {
      if (user.role === 'PANCHAYAT_SECRETARY') {
        // Delete if mandalName matches any target mandal
        return user.mandalName && MANDALS_TO_DELETE.some(mandal => 
          user.mandalName?.toLowerCase() === mandal.toLowerCase()
        )
      } else if (user.role === 'FIELD_OFFICER') {
        // Delete if assigned to any secretariat in target mandals
        return isFieldOfficerInTargetMandals(user.assignedSecretariats)
      }
      return false
    })

    console.log(`\n🎯 Users to be DELETED: ${usersToDelete.length}`)
    console.log(`✅ Users to be KEPT: ${allUsers.length - usersToDelete.length}`)
    console.log('─'.repeat(80))

    if (usersToDelete.length === 0) {
      console.log('\n✨ No users found matching the deletion criteria.')
      console.log('All users are safe!')
      return
    }

    // Display preview of users to delete
    console.log('\n📋 PREVIEW OF USERS TO BE DELETED:\n')
    
    // Group by role
    const panchayatSecretaries = usersToDelete.filter(u => u.role === 'PANCHAYAT_SECRETARY')
    const fieldOfficers = usersToDelete.filter(u => u.role === 'FIELD_OFFICER')

    if (panchayatSecretaries.length > 0) {
      console.log(`\n👤 PANCHAYAT SECRETARIES (${panchayatSecretaries.length}):`)
      console.log('─'.repeat(80))
      panchayatSecretaries.forEach((user, index) => {
        console.log(`${index + 1}. ${user.fullName} (@${user.username})`)
        console.log(`   ${getLocationDescription(user)}`)
        console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`)
        console.log()
      })
    }

    if (fieldOfficers.length > 0) {
      console.log(`\n👥 FIELD OFFICERS (${fieldOfficers.length}):`)
      console.log('─'.repeat(80))
      fieldOfficers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.fullName} (@${user.username})`)
        console.log(`   ${getLocationDescription(user)}`)
        console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`)
        console.log()
      })
    }

    console.log('─'.repeat(80))
    console.log('\n⚠️  WARNING: This action cannot be undone!')
    console.log('⚠️  All data associated with these users will be permanently deleted.')
    console.log()

    // Ask for confirmation
    const confirmed = await askForConfirmation(
      `Are you sure you want to delete ${usersToDelete.length} user(s)? (yes/no): `
    )

    if (!confirmed) {
      console.log('\n❌ Deletion cancelled by user.')
      console.log('No changes were made to the database.')
      return
    }

    console.log('\n🗑️  Starting deletion process...\n')

    // Delete users one by one and log each deletion
    let successCount = 0
    let errorCount = 0

    for (const user of usersToDelete) {
      try {
        await prisma.user.delete({
          where: { id: user.id },
        })

        console.log(`✅ Deleted: ${user.fullName} (@${user.username}) - ${user.role}`)
        successCount++
      } catch (error) {
        console.error(`❌ Failed to delete: ${user.fullName} (@${user.username})`)
        console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        errorCount++
      }
    }

    console.log('\n' + '─'.repeat(80))
    console.log('\n📊 DELETION SUMMARY:')
    console.log(`   ✅ Successfully deleted: ${successCount} user(s)`)
    console.log(`   ❌ Failed to delete: ${errorCount} user(s)`)
    console.log(`   📝 Total processed: ${usersToDelete.length} user(s)`)
    console.log('\n✨ Deletion process completed!')

  } catch (error) {
    console.error('\n❌ Error during deletion process:')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

