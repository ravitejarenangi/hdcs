/**
 * Dry-run script to preview duplicate ABHA IDs (health_id) without making changes
 *
 * This script:
 * 1. Finds all health_id values that appear more than once (duplicates)
 * 2. Shows detailed analysis of what will be affected
 * 3. DOES NOT make any changes to the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function previewDuplicateHealthIds() {
  console.log('🔍 Duplicate ABHA ID Preview (DRY-RUN)\n')
  console.log('='.repeat(80))

  try {
    // 1. Find all duplicate health_id values
    console.log('\n📊 Finding duplicate health_id values...\n')

    const duplicates = await prisma.$queryRaw<Array<{
      health_id: string
      count: number
      sample_names: string
      sample_resident_ids: string
      sample_mandals: string
    }>>`
      SELECT
        health_id,
        COUNT(*) as count,
        GROUP_CONCAT(CONCAT(name, ' (', resident_id, ')') SEPARATOR '; ') as sample_names,
        GROUP_CONCAT(resident_id SEPARATOR ';') as sample_resident_ids,
        GROUP_CONCAT(DISTINCT mandal_name SEPARATOR ', ') as sample_mandals
      FROM residents
      WHERE health_id IS NOT NULL
        AND health_id != 'N/A'
        AND health_id != ''
      GROUP BY health_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, health_id
    `

    if (duplicates.length === 0) {
      console.log('✅ No duplicate health_id values found. Database is clean!')
      await prisma.$disconnect()
      return
    }

    // 2. Show summary
    const totalDuplicateValues = duplicates.length
    const totalAffectedRecords = duplicates.reduce((sum, d) => sum + Number(d.count), 0)

    console.log('📋 SUMMARY:')
    console.log('-'.repeat(80))
    console.log(`   Duplicate health_id values found: ${totalDuplicateValues}`)
    console.log(`   Total residents affected:       ${totalAffectedRecords}`)
    console.log(`   Percentage of all residents:   ${((totalAffectedRecords / 100000) * 100).toFixed(2)}% (approx)`)
    console.log('')

    // 3. Show all duplicates with details
    console.log('🔍 DUPLICATE DETAILS:')
    console.log('='.repeat(80))
    console.log('')

    for (let i = 0; i < duplicates.length; i++) {
      const dup = duplicates[i]
      const names = dup.sample_names.split(';').map(n => n.trim())
      const residentIds = dup.sample_resident_ids.split(';')
      const mandals = dup.sample_mandals ? dup.sample_mandals.split(',') : []

      console.log(`${(i + 1).toString().padStart(3)}. Health ID: ${dup.health_id}`)
      console.log(`     Appears ${Number(dup.count)} time(s) in ${[...new Set(mandals)].join(', ')}`)
      console.log(`     Residents:`)

      names.forEach((name, idx) => {
        console.log(`        - ${name} (ID: ${residentIds[idx]})`)
      })

      console.log('')
    }

    // 4. Show health_id statistics
    console.log('📊 CURRENT health_id DISTRIBUTION:')
    console.log('-'.repeat(80))

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

    console.log(`   Total residents:              ${Number(stats[0].total).toLocaleString()}`)
    console.log(`   With valid health_id:         ${Number(stats[0].with_health_id).toLocaleString()}`)
    console.log(`   NULL health_id:               ${Number(stats[0].null_health_id).toLocaleString()}`)
    console.log(`   N/A or empty health_id:       ${Number(stats[0].na_health_id).toLocaleString()}`)
    console.log('')

    // 5. What will happen
    console.log('⚠️  WHAT WILL HAPPEN WHEN YOU RUN CLEANUP:')
    console.log('-'.repeat(80))
    console.log(`   • ${totalDuplicateValues} unique health_id values will be set to NULL`)
    console.log(`   • ${totalAffectedRecords} residents will have their health_id cleared`)
    console.log(`   • ALL records with duplicate health_id will be affected (not extras)`)
    console.log(`   • Field officers can re-enter correct ABHA IDs after cleanup`)
    console.log('')

    console.log('='.repeat(80))
    console.log('\n✅ Dry-run complete. No changes were made to the database.\n')
    console.log('To run the actual cleanup, use: npm run cleanup:duplicate-health-ids\n')

  } catch (error) {
    console.error('\n❌ Error during preview:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the preview
previewDuplicateHealthIds()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
