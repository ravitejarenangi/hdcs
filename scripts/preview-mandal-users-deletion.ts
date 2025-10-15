/**
 * DRY RUN Script - Preview users that would be deleted
 * 
 * This script will ONLY show which users would be deleted.
 * It will NOT actually delete anything.
 * 
 * Usage:
 *   npx tsx scripts/preview-mandal-users-deletion.ts
 */

import { PrismaClient } from "@prisma/client"

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
  email: string | null
  mandalName: string | null
  assignedSecretariats: string | null
  isActive: boolean
  createdAt: Date
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

async function main() {
  console.log('🔍 DRY RUN - Preview Mode (No deletions will occur)\n')
  console.log('Target Mandals:', MANDALS_TO_DELETE.join(', '))
  console.log('═'.repeat(80))

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
        email: true,
        mandalName: true,
        assignedSecretariats: true,
        isActive: true,
        createdAt: true,
      },
    }) as UserToDelete[]

    console.log(`\n📊 Database Statistics:`)
    console.log(`   Total users (excluding ADMIN): ${allUsers.length}`)
    console.log(`   Panchayat Secretaries: ${allUsers.filter(u => u.role === 'PANCHAYAT_SECRETARY').length}`)
    console.log(`   Field Officers: ${allUsers.filter(u => u.role === 'FIELD_OFFICER').length}`)

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

    const usersToKeep = allUsers.filter(user => !usersToDelete.includes(user))

    console.log('\n' + '═'.repeat(80))
    console.log('\n📈 IMPACT ANALYSIS:')
    console.log(`   🗑️  Users to be DELETED: ${usersToDelete.length}`)
    console.log(`   ✅ Users to be KEPT: ${usersToKeep.length}`)
    console.log(`   📊 Deletion Rate: ${((usersToDelete.length / allUsers.length) * 100).toFixed(1)}%`)
    console.log('\n' + '═'.repeat(80))

    if (usersToDelete.length === 0) {
      console.log('\n✨ No users found matching the deletion criteria.')
      console.log('All users are safe!')
      return
    }

    // Display detailed preview of users to delete
    console.log('\n📋 DETAILED PREVIEW OF USERS TO BE DELETED:\n')
    
    // Group by mandal and role
    const byMandal: Record<string, UserToDelete[]> = {}
    
    usersToDelete.forEach(user => {
      if (user.role === 'PANCHAYAT_SECRETARY' && user.mandalName) {
        if (!byMandal[user.mandalName]) byMandal[user.mandalName] = []
        byMandal[user.mandalName].push(user)
      } else if (user.role === 'FIELD_OFFICER') {
        const secretariats = parseAssignedSecretariats(user.assignedSecretariats)
        secretariats.forEach(sec => {
          if (MANDALS_TO_DELETE.some(m => m.toLowerCase() === sec.mandalName.toLowerCase())) {
            if (!byMandal[sec.mandalName]) byMandal[sec.mandalName] = []
            if (!byMandal[sec.mandalName].includes(user)) {
              byMandal[sec.mandalName].push(user)
            }
          }
        })
      }
    })

    // Display by mandal
    MANDALS_TO_DELETE.forEach(mandal => {
      const users = byMandal[mandal] || []
      if (users.length === 0) return

      console.log(`\n📍 ${mandal.toUpperCase()} (${users.length} user${users.length > 1 ? 's' : ''})`)
      console.log('─'.repeat(80))

      const panchayatSecs = users.filter(u => u.role === 'PANCHAYAT_SECRETARY')
      const fieldOffs = users.filter(u => u.role === 'FIELD_OFFICER')

      if (panchayatSecs.length > 0) {
        console.log(`\n  👤 Panchayat Secretaries (${panchayatSecs.length}):`)
        panchayatSecs.forEach((user, idx) => {
          console.log(`     ${idx + 1}. ${user.fullName}`)
          console.log(`        Username: @${user.username}`)
          console.log(`        Email: ${user.email || 'N/A'}`)
          console.log(`        Status: ${user.isActive ? '🟢 Active' : '🔴 Inactive'}`)
          console.log(`        Created: ${user.createdAt.toLocaleDateString()}`)
          console.log()
        })
      }

      if (fieldOffs.length > 0) {
        console.log(`\n  👥 Field Officers (${fieldOffs.length}):`)
        fieldOffs.forEach((user, idx) => {
          console.log(`     ${idx + 1}. ${user.fullName}`)
          console.log(`        Username: @${user.username}`)
          console.log(`        Email: ${user.email || 'N/A'}`)
          console.log(`        ${getLocationDescription(user)}`)
          console.log(`        Status: ${user.isActive ? '🟢 Active' : '🔴 Inactive'}`)
          console.log(`        Created: ${user.createdAt.toLocaleDateString()}`)
          console.log()
        })
      }
    })

    console.log('═'.repeat(80))
    console.log('\n📊 SUMMARY BY ROLE:')
    const panchayatCount = usersToDelete.filter(u => u.role === 'PANCHAYAT_SECRETARY').length
    const fieldOfficerCount = usersToDelete.filter(u => u.role === 'FIELD_OFFICER').length
    console.log(`   👤 Panchayat Secretaries: ${panchayatCount}`)
    console.log(`   👥 Field Officers: ${fieldOfficerCount}`)
    console.log(`   📝 Total: ${usersToDelete.length}`)

    console.log('\n═'.repeat(80))
    console.log('\n💡 NEXT STEPS:')
    console.log('   1. Review the list above carefully')
    console.log('   2. If everything looks correct, run the actual deletion script:')
    console.log('      npx tsx scripts/delete-mandal-users.ts')
    console.log('   3. The deletion script will ask for confirmation before proceeding')
    console.log('\n⚠️  Remember: This is a DRY RUN - no data has been deleted!')

  } catch (error) {
    console.error('\n❌ Error during preview:')
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

