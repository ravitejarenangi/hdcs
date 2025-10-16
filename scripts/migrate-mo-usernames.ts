/**
 * Migration Script: Update Mandal Officer Usernames from ps_* to mo_*
 * 
 * This script updates all Mandal Officer (formerly Panchayat Secretary) usernames
 * from the old format (ps_<mandalcode>) to the new format (mo_<mandalcode>).
 * 
 * Example: ps_chittoor → mo_chittoor
 * 
 * Usage: npx tsx scripts/migrate-mo-usernames.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Mandal Officer Username Migration')
  console.log('=' .repeat(80))
  console.log('This script will update all Mandal Officer usernames from ps_* to mo_*')
  console.log('=' .repeat(80))

  try {
    // Step 1: Find all Mandal Officers with ps_ prefix
    console.log('\n📋 Step 1: Finding Mandal Officers with ps_ prefix...')
    console.log('-'.repeat(80))

    const mandalOfficers = await prisma.user.findMany({
      where: {
        role: 'PANCHAYAT_SECRETARY',
        username: {
          startsWith: 'ps_'
        }
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        mandalName: true,
        isActive: true,
      }
    })

    if (mandalOfficers.length === 0) {
      console.log('✅ No Mandal Officers found with ps_ prefix')
      console.log('   All usernames are already up to date!')
      return
    }

    console.log(`✅ Found ${mandalOfficers.length} Mandal Officer(s) to update:`)
    mandalOfficers.forEach((officer, index) => {
      const newUsername = officer.username.replace(/^ps_/, 'mo_')
      console.log(`   ${index + 1}. ${officer.username} → ${newUsername}`)
      console.log(`      Name: ${officer.fullName}`)
      console.log(`      Mandal: ${officer.mandalName || 'N/A'}`)
      console.log(`      Active: ${officer.isActive ? 'Yes' : 'No'}`)
    })

    // Step 2: Check for conflicts
    console.log('\n📋 Step 2: Checking for username conflicts...')
    console.log('-'.repeat(80))

    const conflicts: string[] = []
    for (const officer of mandalOfficers) {
      const newUsername = officer.username.replace(/^ps_/, 'mo_')
      const existingUser = await prisma.user.findUnique({
        where: { username: newUsername }
      })
      
      if (existingUser && existingUser.id !== officer.id) {
        conflicts.push(`${officer.username} → ${newUsername} (already exists)`)
      }
    }

    if (conflicts.length > 0) {
      console.log('❌ CONFLICTS DETECTED:')
      conflicts.forEach(conflict => console.log(`   - ${conflict}`))
      console.log('\n⚠️  Migration aborted to prevent data loss.')
      console.log('   Please resolve conflicts manually before running this script.')
      return
    }

    console.log('✅ No conflicts detected')

    // Step 3: Perform the migration
    console.log('\n📋 Step 3: Updating usernames...')
    console.log('-'.repeat(80))

    const results: Array<{
      oldUsername: string
      newUsername: string
      status: 'success' | 'failed'
      error?: string
    }> = []

    for (const officer of mandalOfficers) {
      const oldUsername = officer.username
      const newUsername = oldUsername.replace(/^ps_/, 'mo_')

      try {
        await prisma.user.update({
          where: { id: officer.id },
          data: { username: newUsername }
        })

        results.push({
          oldUsername,
          newUsername,
          status: 'success'
        })

        console.log(`   ✅ ${oldUsername} → ${newUsername}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          oldUsername,
          newUsername,
          status: 'failed',
          error: errorMessage
        })

        console.log(`   ❌ ${oldUsername} → ${newUsername} (FAILED)`)
        console.log(`      Error: ${errorMessage}`)
      }
    }

    // Step 4: Summary
    console.log('\n📊 Migration Summary')
    console.log('=' .repeat(80))

    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length

    console.log(`Total Mandal Officers: ${mandalOfficers.length}`)
    console.log(`✅ Successfully updated: ${successCount}`)
    console.log(`❌ Failed: ${failedCount}`)

    if (failedCount > 0) {
      console.log('\n❌ Failed Updates:')
      results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`   - ${r.oldUsername} → ${r.newUsername}`)
          console.log(`     Error: ${r.error}`)
        })
    }

    if (successCount > 0) {
      console.log('\n✅ Successfully Updated:')
      results
        .filter(r => r.status === 'success')
        .forEach(r => {
          console.log(`   - ${r.oldUsername} → ${r.newUsername}`)
        })
    }

    console.log('\n🎉 Migration completed!')
    console.log('\n📝 Next Steps:')
    console.log('   1. Update seed.ts to use mo_ prefix for new installations')
    console.log('   2. Update create-panchayat-secretaries.ts to use mo_ prefix')
    console.log('   3. Update test scripts to use mo_ prefix')
    console.log('   4. Inform users about the username change')
    console.log('   5. Update any documentation that references ps_ usernames')

  } catch (error) {
    console.error('\n❌ Migration failed with error:')
    console.error(error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

