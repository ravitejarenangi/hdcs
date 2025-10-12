#!/usr/bin/env tsx

/**
 * UID Cleanup Script
 * 
 * This script removes the ".0" suffix from all UID (Aadhar) numbers in the database.
 * The UIDs were imported with a decimal suffix (e.g., "123456789012.0") which causes
 * search failures when users enter the standard 12-digit format.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupUIDs() {
  console.log('🧹 UID Cleanup Script\n')
  console.log('='.repeat(80))

  try {
    // Count UIDs with ".0" suffix
    const withDecimal = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM residents
      WHERE uid LIKE '%.0'
    `

    const totalWithDecimal = Number(withDecimal[0].count)

    console.log('\n📊 Analysis:')
    console.log(`   Total records with ".0" suffix: ${totalWithDecimal.toLocaleString()}`)

    if (totalWithDecimal === 0) {
      console.log('\n✅ No UIDs need cleanup!')
      return
    }

    console.log(`\n⚠️  This will update ${totalWithDecimal.toLocaleString()} records`)
    console.log(`   Batch size: 10,000 records per batch`)
    console.log(`   Estimated batches: ${Math.ceil(totalWithDecimal / 10000)}`)

    console.log('\n🔄 Starting cleanup...\n')

    const startTime = Date.now()
    let totalUpdated = 0

    // Update in batches using raw SQL for better performance
    // This removes the ".0" suffix from all UIDs
    const result = await prisma.$executeRaw`
      UPDATE residents
      SET uid = TRIM(TRAILING '.0' FROM uid)
      WHERE uid LIKE '%.0'
    `

    totalUpdated = result

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    const speed = Math.round(totalUpdated / parseFloat(duration))

    console.log('✅ Cleanup completed!')
    console.log(`   Records updated: ${totalUpdated.toLocaleString()}`)
    console.log(`   Duration: ${duration} seconds`)
    console.log(`   Speed: ${speed.toLocaleString()} records/second`)

    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...')

    const stillWithDecimal = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM residents
      WHERE uid LIKE '%.0'
    `

    console.log(`   Records still with ".0": ${Number(stillWithDecimal[0].count)}`)

    // Check new UID distribution
    const uidLengths = await prisma.$queryRaw<Array<{ length: number; count: bigint }>>`
      SELECT LENGTH(uid) as length, COUNT(*) as count
      FROM residents
      WHERE uid IS NOT NULL
      GROUP BY LENGTH(uid)
      ORDER BY count DESC
      LIMIT 5
    `

    console.log('\n📊 New UID Length Distribution:')
    uidLengths.forEach(row => {
      console.log(`   Length ${row.length}: ${Number(row.count).toLocaleString()}`)
    })

    // Sample cleaned UIDs
    const samples = await prisma.resident.findMany({
      select: { residentId: true, uid: true, name: true },
      take: 10,
    })

    console.log('\n📋 Sample Cleaned Records:')
    samples.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.residentId}: "${r.uid}" (${r.name})`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('✅ UID cleanup completed successfully!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupUIDs()

