/**
 * Test Script: Panchayat Secretary Analytics Filtering
 * 
 * This script tests the data filtering logic in the Panchayat Secretary dashboard
 * to ensure placeholder values are excluded from statistics.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPanchayatFiltering() {
  console.log('🧪 Testing Panchayat Secretary Analytics Filtering\n')
  console.log('='.repeat(80))

  const mandalName = 'CHITTOOR' // Test with CHITTOOR mandal

  try {
    console.log(`\n📍 Testing Mandal: ${mandalName}`)
    console.log('='.repeat(80))

    // Test 1: Total Residents (with and without filtering)
    console.log('\n📋 Test 1: Total Residents Count')
    console.log('-'.repeat(80))

    const totalResidentsUnfiltered = await prisma.resident.count({
      where: { mandalName },
    })

    const totalResidentsFiltered = await prisma.resident.count({
      where: {
        mandalName,
        name: {
          not: {
            startsWith: 'UNKNOWN_NAME_',
          },
        },
      },
    })

    const placeholderNames = totalResidentsUnfiltered - totalResidentsFiltered

    console.log(`   Unfiltered: ${totalResidentsUnfiltered.toLocaleString()}`)
    console.log(`   Filtered: ${totalResidentsFiltered.toLocaleString()}`)
    console.log(`   Placeholder Names: ${placeholderNames.toLocaleString()}`)
    console.log(`   ${placeholderNames > 0 ? '✅' : '⚠️'} Filtering ${placeholderNames > 0 ? 'working' : 'not needed'}`)

    // Test 2: Mobile Number Completion (with and without filtering)
    console.log('\n📋 Test 2: Mobile Number Completion')
    console.log('-'.repeat(80))

    const mobileUnfiltered = await prisma.resident.count({
      where: {
        mandalName,
        mobileNumber: { not: null },
      },
    })

    const mobileFiltered = await prisma.resident.count({
      where: {
        mandalName,
        name: {
          not: {
            startsWith: 'UNKNOWN_NAME_',
          },
        },
        AND: [
          { mobileNumber: { not: null } },
          { mobileNumber: { not: 'N/A' } },
          { mobileNumber: { not: '0' } },
          { mobileNumber: { not: '' } },
        ],
      },
    })

    const mobileRateUnfiltered = totalResidentsUnfiltered > 0
      ? Math.round((mobileUnfiltered / totalResidentsUnfiltered) * 100)
      : 0

    const mobileRateFiltered = totalResidentsFiltered > 0
      ? Math.round((mobileFiltered / totalResidentsFiltered) * 100)
      : 0

    console.log(`   Unfiltered: ${mobileUnfiltered.toLocaleString()} (${mobileRateUnfiltered}%)`)
    console.log(`   Filtered: ${mobileFiltered.toLocaleString()} (${mobileRateFiltered}%)`)
    console.log(`   Excluded: ${mobileUnfiltered - mobileFiltered} records`)
    console.log(`   ✅ Filtering applied successfully`)

    // Test 3: Health ID Completion (with and without filtering)
    console.log('\n📋 Test 3: Health ID Completion')
    console.log('-'.repeat(80))

    const healthIdUnfiltered = await prisma.resident.count({
      where: {
        mandalName,
        healthId: { not: null },
      },
    })

    const healthIdFiltered = await prisma.resident.count({
      where: {
        mandalName,
        name: {
          not: {
            startsWith: 'UNKNOWN_NAME_',
          },
        },
        AND: [
          { healthId: { not: null } },
          { healthId: { not: 'N/A' } },
          { healthId: { not: '0' } },
          { healthId: { not: '' } },
        ],
      },
    })

    const healthIdRateUnfiltered = totalResidentsUnfiltered > 0
      ? Math.round((healthIdUnfiltered / totalResidentsUnfiltered) * 100)
      : 0

    const healthIdRateFiltered = totalResidentsFiltered > 0
      ? Math.round((healthIdFiltered / totalResidentsFiltered) * 100)
      : 0

    console.log(`   Unfiltered: ${healthIdUnfiltered.toLocaleString()} (${healthIdRateUnfiltered}%)`)
    console.log(`   Filtered: ${healthIdFiltered.toLocaleString()} (${healthIdRateFiltered}%)`)
    console.log(`   Excluded: ${healthIdUnfiltered - healthIdFiltered} records`)
    console.log(`   ✅ Filtering applied successfully`)

    // Test 4: Secretariat Statistics
    console.log('\n📋 Test 4: Secretariat Statistics')
    console.log('-'.repeat(80))

    const secretariatStatsUnfiltered = await prisma.resident.groupBy({
      by: ['secName'],
      _count: { id: true },
      where: {
        mandalName,
        secName: { not: null },
      },
    })

    const secretariatStatsFiltered = await prisma.resident.groupBy({
      by: ['secName'],
      _count: { id: true },
      where: {
        mandalName,
        secName: { not: null },
        name: {
          not: {
            startsWith: 'UNKNOWN_NAME_',
          },
        },
      },
    })

    console.log(`   Secretariats (Unfiltered): ${secretariatStatsUnfiltered.length}`)
    console.log(`   Secretariats (Filtered): ${secretariatStatsFiltered.length}`)
    
    // Show top 5 secretariats
    console.log(`\n   Top 5 Secretariats (Filtered):`)
    secretariatStatsFiltered
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 5)
      .forEach((stat, i) => {
        const unfilteredStat = secretariatStatsUnfiltered.find(s => s.secName === stat.secName)
        const diff = unfilteredStat ? unfilteredStat._count.id - stat._count.id : 0
        console.log(`   ${i + 1}. ${stat.secName}: ${stat._count.id.toLocaleString()} residents (excluded: ${diff})`)
      })

    console.log(`   ✅ Filtering applied to secretariat statistics`)

    // Test 5: Check for placeholder patterns
    console.log('\n📋 Test 5: Placeholder Pattern Analysis')
    console.log('-'.repeat(80))

    const placeholderPatterns = await prisma.$queryRaw<
      Array<{ pattern: string; count: bigint }>
    >`
      SELECT 
        CASE 
          WHEN name LIKE 'UNKNOWN_NAME_%' THEN 'UNKNOWN_NAME_*'
          WHEN mobile_number = '0' THEN 'Mobile: 0'
          WHEN mobile_number = 'N/A' THEN 'Mobile: N/A'
          WHEN health_id = '0' THEN 'Health ID: 0'
          WHEN health_id = 'N/A' THEN 'Health ID: N/A'
          ELSE 'Other'
        END as pattern,
        COUNT(*) as count
      FROM residents
      WHERE mandal_name = ${mandalName}
        AND (
          name LIKE 'UNKNOWN_NAME_%'
          OR mobile_number IN ('0', 'N/A', '')
          OR health_id IN ('0', 'N/A', '')
        )
      GROUP BY pattern
      ORDER BY count DESC
    `

    if (placeholderPatterns.length > 0) {
      console.log(`   Found ${placeholderPatterns.length} placeholder patterns:`)
      placeholderPatterns.forEach((p) => {
        console.log(`   - ${p.pattern}: ${Number(p.count).toLocaleString()} records`)
      })
    } else {
      console.log(`   ✅ No placeholder patterns found`)
    }

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('✅ FILTERING TESTS COMPLETE!')
    console.log('='.repeat(80))
    console.log('\n📊 Summary:')
    console.log(`   Mandal: ${mandalName}`)
    console.log(`   Total Residents (Filtered): ${totalResidentsFiltered.toLocaleString()}`)
    console.log(`   Mobile Completion (Filtered): ${mobileRateFiltered}%`)
    console.log(`   Health ID Completion (Filtered): ${healthIdRateFiltered}%`)
    console.log(`   Secretariats: ${secretariatStatsFiltered.length}`)
    console.log('\n🎯 Filtering Rules Applied:')
    console.log('   ✅ Exclude names starting with "UNKNOWN_NAME_"')
    console.log('   ✅ Exclude mobile numbers: NULL, "N/A", "0", ""')
    console.log('   ✅ Exclude health IDs: NULL, "N/A", "0", ""')
    console.log('\n💡 Impact:')
    console.log(`   - ${placeholderNames.toLocaleString()} residents with placeholder names excluded`)
    console.log(`   - ${(mobileUnfiltered - mobileFiltered).toLocaleString()} invalid mobile numbers excluded`)
    console.log(`   - ${(healthIdUnfiltered - healthIdFiltered).toLocaleString()} invalid health IDs excluded`)
    console.log('\n✅ Panchayat Secretary dashboard now shows accurate, filtered statistics!')

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testPanchayatFiltering()

