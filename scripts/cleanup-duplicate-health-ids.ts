/**
 * Script to clean up duplicate ABHA IDs (health_id) by setting them to NULL
 *
 * This script:
 * 1. Finds all health_id values that appear more than once (duplicates)
 * 2. Shows analysis of what will be affected
 * 3. Sets ALL records with duplicate health_id to NULL
 * 4. Uses efficient SQL operations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupDuplicateHealthIds() {
  console.log('🧹 Duplicate ABHA ID Cleanup Script\n')
  console.log('='.repeat(80))

  try {
    // 1. Find all duplicate health_id values
    console.log('\n📊 Step 1: Finding duplicate health_id values...\n')

    const duplicates = await prisma.$queryRaw<Array<{
      health_id: string
      count: number
      sample_names: string
    }>>`
      SELECT
        health_id,
        COUNT(*) as count,
        GROUP_CONCAT(name SEPARATOR ', ') as sample_names
      FROM residents
      WHERE health_id IS NOT NULL
        AND health_id != 'N/A'
        AND health_id != ''
      GROUP BY health_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, health_id
    `

    if (duplicates.length === 0) {
      console.log('✅ No duplicate health_id values found. All done!')
      return
    }

    // 2. Show analysis
    const totalDuplicateValues = duplicates.length
    const totalAffectedRecords = duplicates.reduce((sum, d) => sum + Number(d.count), 0)

    console.log(`Found ${totalDuplicateValues} duplicate health_id values affecting ${totalAffectedRecords} records\n`)
    console.log('Top 20 duplicates by count:')
    console.log('-'.repeat(80))

    duplicates.slice(0, 20).forEach((dup, index) => {
      const sampleNames = (dup.sample_names || '').split(',').slice(0, 3).join(', ')
      const moreCount = (dup.sample_names || '').split(',').length > 3 ? '...' : ''
      console.log(`${(index + 1).toString().padStart(2)}. ${dup.health_id} appears ${Number(dup.count)} times`)
      console.log(`     Sample: ${sampleNames}${moreCount}`)
      console.log('')
    })

    if (duplicates.length > 20) {
      console.log(`... and ${duplicates.length - 20} more duplicate health_id values\n`)
    }

    // 3. Confirm before proceeding
    console.log('⚠️  WARNING: This will set health_id to NULL for ALL records with duplicate values!')
    console.log(`    - ${totalDuplicateValues} duplicate health_id values will be cleared`)
    console.log(`    - ${totalAffectedRecords} residents will have their health_id set to NULL`)
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...')

    await new Promise(resolve => setTimeout(resolve, 5000))
    console.log('Proceeding with cleanup...\n')

    // 4. Perform the cleanup
    console.log('🔄 Step 2: Cleaning up duplicate health_id values...\n')

    const startTime = Date.now()

    // Use raw SQL for efficiency - update all records that have duplicate health_id
    const result = await prisma.$executeRaw`
      UPDATE residents
      SET health_id = NULL
      WHERE health_id IN (
        SELECT health_id
        FROM (
          SELECT health_id
          FROM residents
          WHERE health_id IS NOT NULL
            AND health_id != 'N/A'
            AND health_id != ''
          GROUP BY health_id
          HAVING COUNT(*) > 1
        ) AS duplicates
      )
    `

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`✅ Cleanup completed!`)
    console.log(`   Records updated: ${Number(result).toLocaleString()}`)
    console.log(`   Duration: ${duration} seconds`)

    // 5. Verify no duplicates remain
    console.log('\n🔍 Step 3: Verifying cleanup...\n')

    const remainingDuplicates = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM (
        SELECT health_id
        FROM residents
        WHERE health_id IS NOT NULL
          AND health_id != 'N/A'
          AND health_id != ''
        GROUP BY health_id
        HAVING COUNT(*) > 1
      ) AS remaining
    `

    const remainingCount = Number(remainingDuplicates[0]?.count || 0)

    console.log(`Remaining duplicate health_id values: ${remainingCount}`)

    if (remainingCount === 0) {
      console.log('✅ All duplicates cleaned up successfully!')
    } else {
      console.log('⚠️  Some duplicates still remain. You may need to run the script again.')
    }

    // 6. Show health_id statistics
    console.log('\n📊 Current health_id Distribution:\n')

    const stats = await prisma.$queryRaw<Array<{
      total: bigint
      with_health_id: bigint
      null_health_id: bigint
      na_health_id: bigint
    }>>`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as with_health_id,
        SUM(CASE WHEN health_id IS NULL THEN 1 ELSE 0 END) as null_health_id,
        SUM(CASE WHEN health_id = 'N/A' OR health_id = '' THEN 1 ELSE 0 END) as na_health_id
      FROM residents
    `

    console.log(`   Total residents:         ${Number(stats[0].total).toLocaleString()}`)
    console.log(`   With valid health_id:    ${Number(stats[0].with_health_id).toLocaleString()}`)
    console.log(`   NULL health_id:          ${Number(stats[0].null_health_id).toLocaleString()}`)
    console.log(`   N/A or empty health_id:  ${Number(stats[0].na_health_id).toLocaleString()}`)

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n✅ Duplicate ABHA ID cleanup completed!\n`)
    console.log(`Next steps:`)
    console.log(`1. Review the residents with NULL health_id`)
    console.log(`2. Field officers can now re-enter correct ABHA IDs`)
    console.log(`3. Consider adding a unique constraint on health_id column\n`)

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupDuplicateHealthIds()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
