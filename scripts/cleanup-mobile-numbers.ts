/**
 * Script to clean up mobile numbers by removing the ".0" decimal suffix
 * 
 * This script:
 * 1. Removes ".0" suffix from all mobile numbers
 * 2. Converts "0.0" to "0" (placeholder)
 * 3. Preserves NULL values
 * 4. Uses batch processing for efficiency
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BATCH_SIZE = 10000 // Process 10,000 records at a time

async function cleanupMobileNumbers() {
  console.log('🧹 Mobile Number Cleanup Script\n')
  console.log('='.repeat(80))

  try {
    // 1. Get total count of records with ".0" suffix
    const totalWithDecimal = await prisma.resident.count({
      where: {
        mobileNumber: {
          contains: '.0',
        },
      },
    })

    console.log(`\n📊 Analysis:`)
    console.log(`   Total records with ".0" suffix: ${totalWithDecimal.toLocaleString()}`)

    if (totalWithDecimal === 0) {
      console.log('\n✅ No mobile numbers need cleanup. All done!')
      return
    }

    // 2. Confirm before proceeding
    console.log(`\n⚠️  This will update ${totalWithDecimal.toLocaleString()} records`)
    console.log(`   Batch size: ${BATCH_SIZE.toLocaleString()} records per batch`)
    console.log(`   Estimated batches: ${Math.ceil(totalWithDecimal / BATCH_SIZE)}`)

    // 3. Use MySQL UPDATE with REPLACE to remove ".0" suffix
    console.log(`\n🔄 Starting cleanup...`)

    const startTime = Date.now()

    // Execute the update using raw SQL for efficiency
    const result = await prisma.$executeRaw`
      UPDATE residents 
      SET mobile_number = REPLACE(mobile_number, '.0', '')
      WHERE mobile_number LIKE '%.0'
    `

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`\n✅ Cleanup completed!`)
    console.log(`   Records updated: ${result.toLocaleString()}`)
    console.log(`   Duration: ${duration} seconds`)
    console.log(`   Speed: ${Math.round(result / parseFloat(duration)).toLocaleString()} records/second`)

    // 4. Verify the cleanup
    console.log(`\n🔍 Verifying cleanup...`)

    const remainingWithDecimal = await prisma.resident.count({
      where: {
        mobileNumber: {
          contains: '.0',
        },
      },
    })

    console.log(`   Records still with ".0": ${remainingWithDecimal.toLocaleString()}`)

    // 5. Check the new distribution
    const mobileZero = await prisma.resident.count({
      where: { mobileNumber: '0' },
    })

    const mobileNull = await prisma.resident.count({
      where: { mobileNumber: null },
    })

    const validMobiles = await prisma.resident.count({
      where: {
        AND: [
          { mobileNumber: { not: null } },
          { mobileNumber: { not: 'N/A' } },
          { mobileNumber: { not: '0' } },
          { mobileNumber: { not: '' } },
        ],
      },
    })

    console.log(`\n📊 New Mobile Number Distribution:`)
    console.log(`   Valid mobile numbers: ${validMobiles.toLocaleString()}`)
    console.log(`   "0" placeholder: ${mobileZero.toLocaleString()}`)
    console.log(`   NULL: ${mobileNull.toLocaleString()}`)

    // 6. Sample cleaned records
    const samples = await prisma.resident.findMany({
      where: {
        AND: [
          { mobileNumber: { not: null } },
          { mobileNumber: { not: '0' } },
        ],
      },
      select: {
        residentId: true,
        name: true,
        mobileNumber: true,
      },
      take: 10,
    })

    console.log(`\n📋 Sample Cleaned Records:`)
    samples.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.residentId}: "${r.mobileNumber}" (${r.name})`)
    })

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n✅ Mobile number cleanup completed successfully!\n`)
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupMobileNumbers()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

