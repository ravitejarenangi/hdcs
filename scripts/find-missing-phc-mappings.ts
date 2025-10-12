/**
 * Find Missing PHC Mappings
 * 
 * This script identifies mandal-secretariat combinations that are missing
 * from the PHC Master CSV file.
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const PHC_MASTER_CSV = '/Users/raviteja/dev-space/drda/data/PHCMaster.csv'

function parsePHCMasterCSV(filePath: string): Set<string> {
  const csvContent = fs.readFileSync(filePath, 'utf-8')
  const lines = csvContent.trim().split('\n')
  
  const mappings = new Set<string>()
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const parts = line.split(',')
    if (parts.length < 3) continue
    
    const mandalName = parts[0].trim()
    const secName = parts[1].trim()
    const key = `${mandalName}|${secName}`
    mappings.add(key)
  }
  
  return mappings
}

async function findMissingMappings() {
  console.log('🔍 Finding Missing PHC Mappings\n')
  console.log('='.repeat(80))

  try {
    // Load PHC Master mappings
    console.log(`\n📖 Loading PHC Master CSV...`)
    const phcMappings = parsePHCMasterCSV(PHC_MASTER_CSV)
    console.log(`   Loaded ${phcMappings.size} mappings from PHC Master`)

    // Get all mandal-secretariat combinations from database
    console.log(`\n📊 Getting mandal-secretariat combinations from database...`)
    const dbCombinations = await prisma.resident.groupBy({
      by: ['mandalName', 'secName'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    })
    console.log(`   Found ${dbCombinations.length} unique combinations in database`)

    // Find missing combinations
    const missing: Array<{ mandal: string | null, sec: string | null, count: number }> = []
    
    for (const combo of dbCombinations) {
      const key = `${combo.mandalName}|${combo.secName}`
      if (!phcMappings.has(key)) {
        missing.push({
          mandal: combo.mandalName,
          sec: combo.secName,
          count: combo._count.id,
        })
      }
    }

    console.log(`\n⚠️  Missing Mappings: ${missing.length}`)
    
    const totalMissingResidents = missing.reduce((sum, m) => sum + m.count, 0)
    console.log(`   Total residents affected: ${totalMissingResidents.toLocaleString()}`)

    // Group by mandal
    const byMandal = new Map<string, Array<{ sec: string | null, count: number }>>()
    
    for (const m of missing) {
      const mandal = m.mandal || '(NULL)'
      if (!byMandal.has(mandal)) {
        byMandal.set(mandal, [])
      }
      byMandal.get(mandal)!.push({ sec: m.sec, count: m.count })
    }

    console.log(`\n📋 Missing Mappings by Mandal:`)
    console.log('='.repeat(80))

    const sortedMandals = Array.from(byMandal.entries())
      .map(([mandal, secs]) => ({
        mandal,
        secs,
        totalResidents: secs.reduce((sum, s) => sum + s.count, 0),
      }))
      .sort((a, b) => b.totalResidents - a.totalResidents)

    for (const { mandal, secs, totalResidents } of sortedMandals) {
      console.log(`\n🏛️  ${mandal}`)
      console.log(`   Missing secretariats: ${secs.length}`)
      console.log(`   Affected residents: ${totalResidents.toLocaleString()}`)
      console.log(`   Secretariats:`)
      
      secs.sort((a, b) => b.count - a.count).forEach((sec, index) => {
        const secName = sec.sec || '(NULL)'
        console.log(`      ${index + 1}. ${secName}: ${sec.count.toLocaleString()} residents`)
      })
    }

    // Export to CSV for easy addition to PHC Master
    console.log(`\n💾 Exporting missing mappings to CSV...`)
    const outputPath = '/Users/raviteja/dev-space/drda/data/missing-phc-mappings.csv'
    
    let csvContent = 'mandal_name,sec_name,resident_count,suggested_phc_name\n'
    for (const m of missing) {
      const mandal = m.mandal || ''
      const sec = m.sec || ''
      csvContent += `${mandal},${sec},${m.count},\n`
    }
    
    fs.writeFileSync(outputPath, csvContent, 'utf-8')
    console.log(`   ✅ Exported to: ${outputPath}`)
    console.log(`   📝 Fill in the 'suggested_phc_name' column and add to PHC Master`)

    console.log('\n' + '='.repeat(80))
    console.log('✅ Analysis Complete')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
findMissingMappings()

