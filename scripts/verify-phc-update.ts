/**
 * Verify PHC Update Results
 * 
 * This script verifies the PHC assignment updates and provides
 * detailed before/after comparison.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyPHCUpdate() {
  console.log('🔍 PHC Update Verification Report\n')
  console.log('='.repeat(80))

  try {
    // Get total residents
    const totalResidents = await prisma.resident.count()
    console.log(`\n📋 Total Residents: ${totalResidents.toLocaleString()}`)

    // Get PHC distribution
    const phcDistribution = await prisma.resident.groupBy({
      by: ['phcName'],
      _count: {
        phcName: true,
      },
      orderBy: {
        _count: {
          phcName: 'desc',
        },
      },
    })

    console.log(`\n🏥 PHC Distribution:`)
    console.log(`   Total unique PHCs: ${phcDistribution.length}`)

    // Count N/A assignments
    const naCount = phcDistribution.find(p => p.phcName === 'N/A')?._count.phcName || 0
    const validPHCCount = totalResidents - naCount
    
    console.log(`\n📊 Assignment Status:`)
    console.log(`   Valid PHC assignments: ${validPHCCount.toLocaleString()} (${((validPHCCount / totalResidents) * 100).toFixed(2)}%)`)
    console.log(`   N/A assignments: ${naCount.toLocaleString()} (${((naCount / totalResidents) * 100).toFixed(2)}%)`)

    // Top PHCs
    console.log(`\n🏆 Top 20 PHCs by Resident Count:`)
    phcDistribution.slice(0, 20).forEach((phc, index) => {
      const phcName = phc.phcName || '(NULL)'
      const count = phc._count.phcName
      const percentage = ((count / totalResidents) * 100).toFixed(2)
      console.log(`   ${index + 1}. ${phcName}: ${count.toLocaleString()} residents (${percentage}%)`)
    })

    // Sample verification - check specific mandal-secretariat combinations
    console.log(`\n🔍 Sample Verification (Mandal-Secretariat → PHC):`)
    
    const samples = [
      { mandal: 'BAIREDDI PALLE', sec: 'ALAPALLI' },
      { mandal: 'BAIREDDI PALLE', sec: 'BAIREDDIPALLI1' },
      { mandal: 'CHITTOOR', sec: 'LALUGARDEN-01' },
      { mandal: 'GANGADHARA NELLORE', sec: 'VELKURU' },
      { mandal: 'KUPPAM', sec: 'KOTALURU' },
    ]

    for (const sample of samples) {
      const resident = await prisma.resident.findFirst({
        where: {
          mandalName: sample.mandal,
          secName: sample.sec,
        },
        select: {
          mandalName: true,
          secName: true,
          phcName: true,
        },
      })

      if (resident) {
        console.log(`   ${resident.mandalName} → ${resident.secName} → ${resident.phcName}`)
      }
    }

    // Check for null/empty PHC
    const nullPHC = await prisma.resident.count({
      where: {
        OR: [
          { phcName: null },
          { phcName: '' },
        ],
      },
    })

    console.log(`\n⚠️  Residents with NULL/Empty PHC: ${nullPHC.toLocaleString()}`)

    // Get mandal-wise PHC distribution
    console.log(`\n📍 Mandal-wise Summary:`)
    const mandalStats = await prisma.resident.groupBy({
      by: ['mandalName'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    })

    for (const mandal of mandalStats) {
      const mandalName = mandal.mandalName || '(NULL)'
      const totalInMandal = mandal._count.id
      
      // Count N/A in this mandal
      const naInMandal = await prisma.resident.count({
        where: {
          mandalName: mandal.mandalName,
          phcName: 'N/A',
        },
      })
      
      const validInMandal = totalInMandal - naInMandal
      const validPercentage = ((validInMandal / totalInMandal) * 100).toFixed(1)
      
      console.log(`   ${mandalName}: ${totalInMandal.toLocaleString()} residents, ${validInMandal.toLocaleString()} with valid PHC (${validPercentage}%)`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ Verification Complete')
    console.log('='.repeat(80))

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ ${validPHCCount.toLocaleString()} residents have valid PHC assignments`)
    console.log(`   ⚠️  ${naCount.toLocaleString()} residents still have N/A (no mapping in PHC Master)`)
    console.log(`   📈 Success Rate: ${((validPHCCount / totalResidents) * 100).toFixed(2)}%`)

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the verification
verifyPHCUpdate()

