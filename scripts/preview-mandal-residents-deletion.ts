/**
 * DRY RUN Script - Preview residents that would be deleted
 * 
 * This script will ONLY show which residents would be deleted.
 * It will NOT actually delete anything.
 * 
 * Usage:
 *   npm run preview:delete-residents
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Mandals to delete residents from
const MANDALS_TO_DELETE = [
  "Kuppam",
  "Santhipuram",
  "Ramakuppam",
  "Gudipalle",
]

interface ResidentToDelete {
  id: string
  residentId: string
  name: string
  mandalName: string | null
  secName: string | null
  mobileNumber: string | null
  healthId: string | null
  gender: string | null
  _count?: {
    updateLogs: number
  }
}

async function main() {
  console.log('🔍 DRY RUN - Preview Mode (No deletions will occur)\n')
  console.log('Target Mandals:', MANDALS_TO_DELETE.join(', '))
  console.log('═'.repeat(80))

  try {
    // Get total resident count
    const totalResidents = await prisma.resident.count()

    console.log(`\n📊 Database Statistics:`)
    console.log(`   Total residents in database: ${totalResidents.toLocaleString()}`)

    // Fetch residents to delete with update log counts
    // Note: MySQL doesn't support mode: 'insensitive', so we use OR conditions
    const residentsToDelete = await prisma.resident.findMany({
      where: {
        OR: MANDALS_TO_DELETE.map(mandal => ({
          mandalName: mandal,
        })),
      },
      select: {
        id: true,
        residentId: true,
        name: true,
        mandalName: true,
        secName: true,
        mobileNumber: true,
        healthId: true,
        gender: true,
        _count: {
          select: {
            updateLogs: true,
          },
        },
      },
    }) as ResidentToDelete[]

    const residentsToKeep = totalResidents - residentsToDelete.length
    const deletionRate = totalResidents > 0 ? (residentsToDelete.length / totalResidents) * 100 : 0

    console.log('\n' + '═'.repeat(80))
    console.log('\n📈 IMPACT ANALYSIS:')
    console.log(`   🗑️  Residents to be DELETED: ${residentsToDelete.length.toLocaleString()}`)
    console.log(`   ✅ Residents to be KEPT: ${residentsToKeep.toLocaleString()}`)
    console.log(`   📊 Deletion Rate: ${deletionRate.toFixed(1)}%`)

    // Count residents with update logs
    const residentsWithLogs = residentsToDelete.filter(r => r._count && r._count.updateLogs > 0).length
    const totalUpdateLogs = residentsToDelete.reduce((sum, r) => sum + (r._count?.updateLogs || 0), 0)

    console.log(`\n⚠️  Foreign Key Constraint Analysis:`)
    console.log(`   Residents with UpdateLog records: ${residentsWithLogs.toLocaleString()}`)
    console.log(`   Total UpdateLog records to handle: ${totalUpdateLogs.toLocaleString()}`)
    if (residentsWithLogs > 0) {
      console.log(`   ⚠️  These residents have update history and may require special handling`)
    }

    console.log('\n' + '═'.repeat(80))

    if (residentsToDelete.length === 0) {
      console.log('\n✨ No residents found matching the deletion criteria.')
      console.log('All residents are safe!')
      return
    }

    // Group by mandal
    const byMandal: Record<string, ResidentToDelete[]> = {}
    residentsToDelete.forEach(resident => {
      const mandal = resident.mandalName || 'Unknown'
      if (!byMandal[mandal]) byMandal[mandal] = []
      byMandal[mandal].push(resident)
    })

    console.log('\n📋 DETAILED PREVIEW BY MANDAL:\n')

    // Display by mandal
    MANDALS_TO_DELETE.forEach(targetMandal => {
      // Find the actual mandal key (case-insensitive)
      const actualMandalKey = Object.keys(byMandal).find(
        key => key.toLowerCase() === targetMandal.toLowerCase()
      )

      const residents = actualMandalKey ? byMandal[actualMandalKey] : []
      if (residents.length === 0) {
        console.log(`\n📍 ${targetMandal.toUpperCase()}: 0 residents`)
        return
      }

      console.log(`\n📍 ${targetMandal.toUpperCase()} (${residents.length.toLocaleString()} residents)`)
      console.log('─'.repeat(80))

      // Group by secretariat
      const bySecretariat: Record<string, ResidentToDelete[]> = {}
      residents.forEach(r => {
        const sec = r.secName || 'Unknown'
        if (!bySecretariat[sec]) bySecretariat[sec] = []
        bySecretariat[sec].push(r)
      })

      const secretariats = Object.keys(bySecretariat).sort()
      console.log(`   Secretariats: ${secretariats.length}`)
      
      // Show top 5 secretariats by resident count
      const topSecretariats = secretariats
        .map(sec => ({ sec, count: bySecretariat[sec].length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      console.log(`\n   Top Secretariats by Resident Count:`)
      topSecretariats.forEach((item, idx) => {
        const withLogs = bySecretariat[item.sec].filter(r => r._count && r._count.updateLogs > 0).length
        console.log(`     ${idx + 1}. ${item.sec}: ${item.count.toLocaleString()} residents${withLogs > 0 ? ` (${withLogs} with update logs)` : ''}`)
      })

      // Show sample residents (first 3)
      console.log(`\n   Sample Residents (first 3):`)
      residents.slice(0, 3).forEach((r, idx) => {
        console.log(`     ${idx + 1}. ${r.name}`)
        console.log(`        Resident ID: ${r.residentId}`)
        console.log(`        Secretariat: ${r.secName || 'N/A'}`)
        console.log(`        Mobile: ${r.mobileNumber || 'N/A'}`)
        console.log(`        Health ID: ${r.healthId || 'N/A'}`)
        console.log(`        Gender: ${r.gender || 'N/A'}`)
        if (r._count && r._count.updateLogs > 0) {
          console.log(`        ⚠️  Update Logs: ${r._count.updateLogs}`)
        }
        console.log()
      })

      // Statistics
      const withMobile = residents.filter(r => r.mobileNumber).length
      const withHealthId = residents.filter(r => r.healthId).length
      const withUpdateLogs = residents.filter(r => r._count && r._count.updateLogs > 0).length

      console.log(`   Statistics:`)
      console.log(`     With Mobile Number: ${withMobile.toLocaleString()} (${((withMobile / residents.length) * 100).toFixed(1)}%)`)
      console.log(`     With Health ID: ${withHealthId.toLocaleString()} (${((withHealthId / residents.length) * 100).toFixed(1)}%)`)
      console.log(`     With Update Logs: ${withUpdateLogs.toLocaleString()} (${((withUpdateLogs / residents.length) * 100).toFixed(1)}%)`)
    })

    console.log('\n' + '═'.repeat(80))
    console.log('\n📊 OVERALL SUMMARY:')
    console.log(`   Total Residents to Delete: ${residentsToDelete.length.toLocaleString()}`)
    console.log(`   Residents with Update Logs: ${residentsWithLogs.toLocaleString()}`)
    console.log(`   Total Update Log Records: ${totalUpdateLogs.toLocaleString()}`)

    console.log('\n' + '═'.repeat(80))
    console.log('\n💡 NEXT STEPS:')
    console.log('   1. Review the statistics and sample data above')
    console.log('   2. Note the residents with update logs (may need special handling)')
    console.log('   3. If everything looks correct, run the actual deletion script:')
    console.log('      npm run delete:mandal-residents')
    console.log('   4. The deletion script will handle update logs automatically')
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

