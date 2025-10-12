/**
 * Update PHC Assignments from PHC Master CSV
 * 
 * This script updates the phcName field for all residents based on the
 * PHC Master mapping (mandal_name + sec_name → phc_name).
 * 
 * Usage:
 *   npx tsx scripts/update-phc-assignments.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// PHC Master CSV file path
const PHC_MASTER_CSV = '/Users/raviteja/dev-space/drda/data/PHCMaster.csv'

interface PHCMapping {
  mandalName: string
  secName: string
  phcName: string
}

interface UpdateStats {
  totalResidents: number
  totalMappings: number
  residentsUpdated: number
  residentsUnmatched: number
  unmatchedCombinations: Set<string>
  phcDistribution: Map<string, number>
}

function printSeparator() {
  console.log('='.repeat(80))
}

function printHeader() {
  printSeparator()
  console.log('🏥 PHC Assignment Update Script')
  console.log('Updating resident PHC assignments from PHC Master mapping')
  printSeparator()
}

/**
 * Parse PHC Master CSV file
 */
function parsePHCMasterCSV(filePath: string): Map<string, string> {
  console.log(`\n📖 Reading PHC Master CSV: ${filePath}`)
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`PHC Master CSV file not found: ${filePath}`)
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8')
  const lines = csvContent.trim().split('\n')
  
  if (lines.length < 2) {
    throw new Error('PHC Master CSV file is empty or has no data rows')
  }

  // Parse header
  const header = lines[0].split(',')
  console.log(`   Header: ${header.join(', ')}`)
  
  // Create mapping: "MANDAL|SECRETARIAT" → "PHC"
  const phcMapping = new Map<string, string>()
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const parts = line.split(',')
    if (parts.length < 3) {
      console.warn(`   ⚠️  Skipping invalid line ${i + 1}: ${line}`)
      continue
    }
    
    const mandalName = parts[0].trim()
    const secName = parts[1].trim()
    const phcName = parts[2].trim()
    
    const key = `${mandalName}|${secName}`
    phcMapping.set(key, phcName)
  }
  
  console.log(`   ✅ Loaded ${phcMapping.size} PHC mappings`)
  
  return phcMapping
}

/**
 * Get current PHC distribution
 */
async function getCurrentPHCDistribution(): Promise<Map<string, number>> {
  const distribution = await prisma.resident.groupBy({
    by: ['phcName'],
    _count: {
      phcName: true,
    },
  })
  
  const map = new Map<string, number>()
  distribution.forEach(item => {
    const phcName = item.phcName || '(NULL)'
    map.set(phcName, item._count.phcName)
  })
  
  return map
}

/**
 * Update PHC assignments
 */
async function updatePHCAssignments(
  phcMapping: Map<string, string>,
  dryRun: boolean = false
): Promise<UpdateStats> {
  const stats: UpdateStats = {
    totalResidents: 0,
    totalMappings: phcMapping.size,
    residentsUpdated: 0,
    residentsUnmatched: 0,
    unmatchedCombinations: new Set<string>(),
    phcDistribution: new Map<string, number>(),
  }

  console.log(`\n📊 Getting total resident count...`)
  stats.totalResidents = await prisma.resident.count()
  console.log(`   Total residents: ${stats.totalResidents.toLocaleString()}`)

  console.log(`\n🔄 Processing updates...`)
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`)

  // Get all unique mandal-secretariat combinations from residents
  const combinations = await prisma.resident.groupBy({
    by: ['mandalName', 'secName'],
    _count: {
      id: true,
    },
  })

  console.log(`   Found ${combinations.length} unique mandal-secretariat combinations`)

  let processedCount = 0
  const batchSize = 50

  for (let i = 0; i < combinations.length; i += batchSize) {
    const batch = combinations.slice(i, i + batchSize)
    
    for (const combo of batch) {
      const mandalName = combo.mandalName
      const secName = combo.secName
      const residentCount = combo._count.id
      
      const key = `${mandalName}|${secName}`
      const phcName = phcMapping.get(key)
      
      if (phcName) {
        // Update residents with this mandal-secretariat combination
        if (!dryRun) {
          await prisma.resident.updateMany({
            where: {
              mandalName: mandalName,
              secName: secName,
            },
            data: {
              phcName: phcName,
            },
          })
        }
        
        stats.residentsUpdated += residentCount
        stats.phcDistribution.set(
          phcName,
          (stats.phcDistribution.get(phcName) || 0) + residentCount
        )
      } else {
        // No mapping found
        stats.residentsUnmatched += residentCount
        stats.unmatchedCombinations.add(key)
      }
      
      processedCount++
      
      // Progress indicator
      if (processedCount % 100 === 0) {
        const progress = ((processedCount / combinations.length) * 100).toFixed(1)
        process.stdout.write(`\r   Progress: ${processedCount}/${combinations.length} (${progress}%)`)
      }
    }
  }
  
  console.log(`\r   Progress: ${processedCount}/${combinations.length} (100.0%)`)
  
  return stats
}

/**
 * Display update statistics
 */
function displayStats(stats: UpdateStats, beforeDistribution: Map<string, number>) {
  printSeparator()
  console.log('📊 Update Statistics')
  printSeparator()
  
  console.log(`\n📋 Summary:`)
  console.log(`   Total Residents: ${stats.totalResidents.toLocaleString()}`)
  console.log(`   Total PHC Mappings: ${stats.totalMappings.toLocaleString()}`)
  console.log(`   Residents Updated: ${stats.residentsUpdated.toLocaleString()} (${((stats.residentsUpdated / stats.totalResidents) * 100).toFixed(2)}%)`)
  console.log(`   Residents Unmatched: ${stats.residentsUnmatched.toLocaleString()} (${((stats.residentsUnmatched / stats.totalResidents) * 100).toFixed(2)}%)`)
  
  if (stats.unmatchedCombinations.size > 0) {
    console.log(`\n⚠️  Unmatched Mandal-Secretariat Combinations: ${stats.unmatchedCombinations.size}`)
    console.log(`   (These residents will keep their current PHC assignment)`)
    
    if (stats.unmatchedCombinations.size <= 20) {
      console.log(`\n   Unmatched combinations:`)
      Array.from(stats.unmatchedCombinations).slice(0, 20).forEach((combo, index) => {
        const [mandal, sec] = combo.split('|')
        console.log(`   ${index + 1}. ${mandal} → ${sec}`)
      })
    } else {
      console.log(`\n   First 20 unmatched combinations:`)
      Array.from(stats.unmatchedCombinations).slice(0, 20).forEach((combo, index) => {
        const [mandal, sec] = combo.split('|')
        console.log(`   ${index + 1}. ${mandal} → ${sec}`)
      })
      console.log(`   ... and ${stats.unmatchedCombinations.size - 20} more`)
    }
  }
  
  console.log(`\n🏥 PHC Distribution (Top 15):`)
  const sortedPHCs = Array.from(stats.phcDistribution.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
  
  sortedPHCs.forEach((entry, index) => {
    const [phcName, count] = entry
    const percentage = ((count / stats.residentsUpdated) * 100).toFixed(2)
    console.log(`   ${index + 1}. ${phcName}: ${count.toLocaleString()} residents (${percentage}%)`)
  })
}

/**
 * Main function
 */
async function main() {
  printHeader()
  
  try {
    // Step 1: Parse PHC Master CSV
    const phcMapping = parsePHCMasterCSV(PHC_MASTER_CSV)
    
    // Step 2: Get current PHC distribution (before update)
    console.log(`\n📊 Getting current PHC distribution...`)
    const beforeDistribution = await getCurrentPHCDistribution()
    console.log(`   Current unique PHCs: ${beforeDistribution.size}`)
    
    // Step 3: Perform dry run first
    console.log(`\n🔍 Performing DRY RUN...`)
    const dryRunStats = await updatePHCAssignments(phcMapping, true)
    
    // Step 4: Display dry run results
    displayStats(dryRunStats, beforeDistribution)
    
    // Step 5: Display dry run results
    console.log(`\n⚠️  This was a DRY RUN. No changes were made to the database.`)
    console.log(`\n📊 Dry run shows:`)
    console.log(`   ✅ ${dryRunStats.residentsUpdated.toLocaleString()} residents will be updated`)
    console.log(`   ⚠️  ${dryRunStats.residentsUnmatched.toLocaleString()} residents will remain unchanged (no mapping found)`)

    // Step 6: Perform actual update
    console.log(`\n🚀 Performing LIVE UPDATE...`)
    console.log(`⏳ This may take a few minutes...`)

    const liveStats = await updatePHCAssignments(phcMapping, false)

    console.log(`\n✅ PHC assignments updated successfully!`)

    // Step 7: Verify updates
    console.log(`\n🔍 Verifying updates...`)
    const afterDistribution = await getCurrentPHCDistribution()
    console.log(`   PHC count after update: ${afterDistribution.size}`)

    printSeparator()
    console.log('✅ UPDATE COMPLETE!')
    printSeparator()
    
  } catch (error) {
    console.error('\n❌ ERROR:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
main()

