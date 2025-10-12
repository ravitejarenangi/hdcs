/**
 * Analyze Current PHC Assignments
 * 
 * This script analyzes the current state of PHC assignments in the database
 * before performing the bulk update.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyzeCurrentPHCAssignments() {
  console.log('📊 Analyzing Current PHC Assignments\n')
  console.log('='.repeat(80))

  try {
    // Get total residents
    const totalResidents = await prisma.resident.count()
    console.log(`\n📋 Total Residents: ${totalResidents.toLocaleString()}`)

    // Get residents with PHC assigned
    const residentsWithPHC = await prisma.resident.count({
      where: {
        phcName: {
          not: null,
        },
      },
    })

    // Get residents without PHC
    const residentsWithoutPHC = await prisma.resident.count({
      where: {
        OR: [
          { phcName: null },
          { phcName: '' },
        ],
      },
    })

    console.log(`\n📊 PHC Assignment Status:`)
    console.log(`   With PHC: ${residentsWithPHC.toLocaleString()} (${((residentsWithPHC / totalResidents) * 100).toFixed(2)}%)`)
    console.log(`   Without PHC: ${residentsWithoutPHC.toLocaleString()} (${((residentsWithoutPHC / totalResidents) * 100).toFixed(2)}%)`)

    // Get unique PHC names
    const uniquePHCs = await prisma.resident.groupBy({
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

    console.log(`\n📍 Unique PHC Names: ${uniquePHCs.length}`)
    console.log(`\n🏥 Top 10 PHCs by Resident Count:`)
    uniquePHCs.slice(0, 10).forEach((phc, index) => {
      const phcName = phc.phcName || '(NULL/Empty)'
      console.log(`   ${index + 1}. ${phcName}: ${phc._count.phcName.toLocaleString()} residents`)
    })

    // Get unique mandal-secretariat combinations
    const mandalSecCombinations = await prisma.resident.groupBy({
      by: ['mandalName', 'secName'],
      _count: {
        id: true,
      },
    })

    console.log(`\n🗺️  Unique Mandal-Secretariat Combinations: ${mandalSecCombinations.length}`)

    // Sample data
    console.log(`\n👀 Sample Residents (first 5):`)
    const sampleResidents = await prisma.resident.findMany({
      take: 5,
      select: {
        residentId: true,
        name: true,
        mandalName: true,
        secName: true,
        phcName: true,
      },
    })

    sampleResidents.forEach((resident, index) => {
      console.log(`   ${index + 1}. ${resident.name}`)
      console.log(`      Mandal: ${resident.mandalName}`)
      console.log(`      Secretariat: ${resident.secName}`)
      console.log(`      Current PHC: ${resident.phcName || '(NULL)'}`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('✅ Analysis Complete')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the analysis
analyzeCurrentPHCAssignments()

