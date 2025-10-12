/**
 * Test script to verify completion rate calculations
 * This script tests the updated logic that excludes placeholder values
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testCompletionRates() {
  console.log('🔍 Testing Completion Rate Calculations\n')
  console.log('=' .repeat(80))

  try {
    // 1. Total residents count
    const totalResidents = await prisma.resident.count()
    console.log(`\n📊 Total Residents: ${totalResidents.toLocaleString()}`)

    // 2. Mobile number completion (EXCLUDING placeholders)
    const residentsWithMobile = await prisma.resident.count({
      where: {
        AND: [
          { mobileNumber: { not: null } },
          { mobileNumber: { not: 'N/A' } },
          { mobileNumber: { not: '0' } },
          { mobileNumber: { not: '0.0' } },
          { mobileNumber: { not: '' } },
        ],
      },
    })
    const mobileCompletionRate =
      totalResidents > 0 ? Math.round((residentsWithMobile / totalResidents) * 100) : 0

    console.log(`\n📱 Mobile Number Completion:`)
    console.log(`   Valid mobile numbers: ${residentsWithMobile.toLocaleString()}`)
    console.log(`   Completion rate: ${mobileCompletionRate}%`)

    // 3. Health ID completion (EXCLUDING placeholders)
    const residentsWithHealthId = await prisma.resident.count({
      where: {
        AND: [
          { healthId: { not: null } },
          { healthId: { not: 'N/A' } },
          { healthId: { not: '' } },
        ],
      },
    })
    const healthIdCompletionRate =
      totalResidents > 0 ? Math.round((residentsWithHealthId / totalResidents) * 100) : 0

    console.log(`\n🏥 Health ID Completion:`)
    console.log(`   Valid health IDs: ${residentsWithHealthId.toLocaleString()}`)
    console.log(`   Completion rate: ${healthIdCompletionRate}%`)

    // 4. Count records with placeholder values
    console.log(`\n⚠️  Placeholder Records:`)

    const residentsWithNamePlaceholder = await prisma.resident.count({
      where: { name: { startsWith: 'UNKNOWN_NAME_' } },
    })
    console.log(`   UNKNOWN_NAME_* placeholders: ${residentsWithNamePlaceholder.toLocaleString()}`)

    const residentsWithHhIdPlaceholder = await prisma.resident.count({
      where: { hhId: { startsWith: 'HH_UNKNOWN_' } },
    })
    console.log(`   HH_UNKNOWN_* placeholders: ${residentsWithHhIdPlaceholder.toLocaleString()}`)

    const residentsWithMobilePlaceholder = await prisma.resident.count({
      where: {
        OR: [
          { mobileNumber: null },
          { mobileNumber: 'N/A' },
          { mobileNumber: '0' },
          { mobileNumber: '0.0' },
          { mobileNumber: '' },
        ],
      },
    })
    console.log(
      `   Missing/placeholder mobile numbers: ${residentsWithMobilePlaceholder.toLocaleString()}`
    )

    const residentsWithHealthIdPlaceholder = await prisma.resident.count({
      where: {
        OR: [{ healthId: null }, { healthId: 'N/A' }, { healthId: '' }],
      },
    })
    console.log(
      `   Missing/placeholder health IDs: ${residentsWithHealthIdPlaceholder.toLocaleString()}`
    )

    // 5. Sample placeholder records
    console.log(`\n📋 Sample Placeholder Records:`)

    const sampleNamePlaceholders = await prisma.resident.findMany({
      where: { name: { startsWith: 'UNKNOWN_NAME_' } },
      select: {
        residentId: true,
        hhId: true,
        name: true,
        mobileNumber: true,
      },
      take: 5,
    })

    console.log(`\n   Name Placeholders (first 5):`)
    sampleNamePlaceholders.forEach((r, i) => {
      console.log(
        `   ${i + 1}. residentId: ${r.residentId}, name: ${r.name}, mobile: ${r.mobileNumber || 'NULL'}`
      )
    })

    const sampleHhIdPlaceholders = await prisma.resident.findMany({
      where: { hhId: { startsWith: 'HH_UNKNOWN_' } },
      select: {
        residentId: true,
        hhId: true,
        name: true,
      },
      take: 5,
    })

    if (sampleHhIdPlaceholders.length > 0) {
      console.log(`\n   HH ID Placeholders (first 5):`)
      sampleHhIdPlaceholders.forEach((r, i) => {
        console.log(`   ${i + 1}. residentId: ${r.residentId}, hhId: ${r.hhId}, name: ${r.name}`)
      })
    }

    // 6. Breakdown of mobile number values
    console.log(`\n📊 Mobile Number Value Breakdown:`)

    const mobileNull = await prisma.resident.count({
      where: { mobileNumber: null },
    })
    console.log(`   NULL: ${mobileNull.toLocaleString()}`)

    const mobileNA = await prisma.resident.count({
      where: { mobileNumber: 'N/A' },
    })
    console.log(`   "N/A": ${mobileNA.toLocaleString()}`)

    const mobileZero = await prisma.resident.count({
      where: { mobileNumber: '0' },
    })
    console.log(`   "0": ${mobileZero.toLocaleString()}`)

    const mobileZeroFloat = await prisma.resident.count({
      where: { mobileNumber: '0.0' },
    })
    console.log(`   "0.0": ${mobileZeroFloat.toLocaleString()}`)

    const mobileEmpty = await prisma.resident.count({
      where: { mobileNumber: '' },
    })
    console.log(`   Empty string: ${mobileEmpty.toLocaleString()}`)

    console.log(
      `   Valid mobile numbers: ${residentsWithMobile.toLocaleString()} (${mobileCompletionRate}%)`
    )

    // 7. Summary
    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n✅ Summary:`)
    console.log(`   Total Residents: ${totalResidents.toLocaleString()}`)
    console.log(`   Mobile Completion: ${mobileCompletionRate}% (${residentsWithMobile.toLocaleString()} valid)`)
    console.log(`   Health ID Completion: ${healthIdCompletionRate}% (${residentsWithHealthId.toLocaleString()} valid)`)
    console.log(`   Records needing attention:`)
    console.log(`     - Name placeholders: ${residentsWithNamePlaceholder.toLocaleString()}`)
    console.log(`     - HH ID placeholders: ${residentsWithHhIdPlaceholder.toLocaleString()}`)
    console.log(`     - Missing mobile: ${residentsWithMobilePlaceholder.toLocaleString()}`)
    console.log(`     - Missing health ID: ${residentsWithHealthIdPlaceholder.toLocaleString()}`)

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n✅ Test completed successfully!\n`)
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testCompletionRates()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

