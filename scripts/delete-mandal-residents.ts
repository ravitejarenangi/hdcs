/**
 * ACTUAL DELETION Script - Delete residents from specific mandals
 * 
 * ⚠️  WARNING: This script will PERMANENTLY DELETE residents from the database!
 * 
 * This script will:
 * 1. Show preview of residents to delete
 * 2. Ask for confirmation
 * 3. Delete UpdateLog records first (to handle foreign key constraints)
 * 4. Delete residents
 * 5. Show summary of deletions
 * 
 * Usage:
 *   npm run delete:mandal-residents
 */

import { PrismaClient } from "@prisma/client"
import * as readline from "readline"

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
  _count?: {
    updateLogs: number
  }
}

// Helper function to prompt user for confirmation
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  )
}

async function main() {
  console.log('🔍 Scanning for residents to delete...\n')
  console.log('Target Mandals:', MANDALS_TO_DELETE.join(', '))
  console.log('─'.repeat(80))

  try {
    // Get total resident count
    const totalResidents = await prisma.resident.count()

    // Fetch residents to delete
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
        _count: {
          select: {
            updateLogs: true,
          },
        },
      },
    }) as ResidentToDelete[]

    const residentsToKeep = totalResidents - residentsToDelete.length

    console.log(`\n📊 Total residents in database: ${totalResidents.toLocaleString()}`)
    console.log(`\n🎯 Residents to be DELETED: ${residentsToDelete.length.toLocaleString()}`)
    console.log(`✅ Residents to be KEPT: ${residentsToKeep.toLocaleString()}`)
    console.log('─'.repeat(80))

    if (residentsToDelete.length === 0) {
      console.log('\n✨ No residents found matching the deletion criteria.')
      console.log('Nothing to delete!')
      return
    }

    // Show preview by mandal
    const byMandal: Record<string, ResidentToDelete[]> = {}
    residentsToDelete.forEach(resident => {
      const mandal = resident.mandalName || 'Unknown'
      if (!byMandal[mandal]) byMandal[mandal] = []
      byMandal[mandal].push(resident)
    })

    console.log('\n📋 PREVIEW BY MANDAL:\n')
    MANDALS_TO_DELETE.forEach(targetMandal => {
      const actualMandalKey = Object.keys(byMandal).find(
        key => key.toLowerCase() === targetMandal.toLowerCase()
      )
      const residents = actualMandalKey ? byMandal[actualMandalKey] : []
      
      if (residents.length > 0) {
        const withLogs = residents.filter(r => r._count && r._count.updateLogs > 0).length
        const totalLogs = residents.reduce((sum, r) => sum + (r._count?.updateLogs || 0), 0)
        
        console.log(`📍 ${targetMandal.toUpperCase()}: ${residents.length.toLocaleString()} residents`)
        if (withLogs > 0) {
          console.log(`   ⚠️  ${withLogs.toLocaleString()} residents have ${totalLogs.toLocaleString()} update log records`)
        }
      }
    })

    // Count total update logs
    const totalUpdateLogs = residentsToDelete.reduce((sum, r) => sum + (r._count?.updateLogs || 0), 0)

    console.log('\n' + '─'.repeat(80))
    console.log('\n⚠️  IMPORTANT INFORMATION:')
    console.log(`   • Total residents to delete: ${residentsToDelete.length.toLocaleString()}`)
    console.log(`   • Total update log records to delete: ${totalUpdateLogs.toLocaleString()}`)
    console.log(`   • This script will delete update logs FIRST, then residents`)
    console.log(`   • This action CANNOT be undone!`)
    
    console.log('\n' + '─'.repeat(80))
    console.log('\n⚠️  WARNING: This action cannot be undone!')
    console.log('⚠️  All resident data and their update history will be permanently deleted.\n')

    // Ask for confirmation
    const answer = await askQuestion(`Are you sure you want to delete ${residentsToDelete.length.toLocaleString()} resident(s)? (yes/no): `)

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled. No changes were made.')
      return
    }

    console.log('\n🗑️  Starting deletion process...\n')

    let successCount = 0
    let errorCount = 0
    let updateLogsDeleted = 0

    // Process deletions in batches for better performance
    const BATCH_SIZE = 100
    const totalBatches = Math.ceil(residentsToDelete.length / BATCH_SIZE)

    for (let i = 0; i < residentsToDelete.length; i += BATCH_SIZE) {
      const batch = residentsToDelete.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} residents)...`)

      for (const resident of batch) {
        try {
          // Delete update logs first (to handle foreign key constraint)
          if (resident._count && resident._count.updateLogs > 0) {
            const deletedLogs = await prisma.updateLog.deleteMany({
              where: {
                residentId: resident.residentId,
              },
            })
            updateLogsDeleted += deletedLogs.count
          }

          // Delete the resident
          await prisma.resident.delete({
            where: {
              id: resident.id,
            },
          })

          successCount++
          
          // Log every 50 deletions
          if (successCount % 50 === 0) {
            console.log(`   ✅ Deleted ${successCount} residents so far...`)
          }
        } catch (error) {
          console.error(`   ❌ Failed to delete: ${resident.name} (${resident.residentId})`)
          console.error(`      Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
          errorCount++
        }
      }
    }

    console.log('\n' + '─'.repeat(80))
    console.log('\n📊 DELETION SUMMARY:')
    console.log(`   ✅ Successfully deleted residents: ${successCount.toLocaleString()}`)
    console.log(`   🗑️  Update logs deleted: ${updateLogsDeleted.toLocaleString()}`)
    console.log(`   ❌ Failed to delete: ${errorCount.toLocaleString()}`)
    console.log(`   📝 Total processed: ${residentsToDelete.length.toLocaleString()}`)

    if (successCount > 0) {
      console.log('\n✨ Deletion process completed!')
      console.log(`\n📈 Database Impact:`)
      console.log(`   Before: ${totalResidents.toLocaleString()} residents`)
      console.log(`   After: ${(totalResidents - successCount).toLocaleString()} residents`)
      console.log(`   Removed: ${successCount.toLocaleString()} residents (${((successCount / totalResidents) * 100).toFixed(1)}%)`)
    }

    if (errorCount > 0) {
      console.log(`\n⚠️  ${errorCount} deletion(s) failed. Check the error messages above.`)
    }

  } catch (error) {
    console.error('\n❌ Error during deletion:')
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

