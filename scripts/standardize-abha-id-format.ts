/**
 * ABHA ID (Health ID) Standardization Script
 * 
 * Purpose:
 * This script standardizes the format of ABHA IDs (Health IDs) in the database.
 * It converts 14-digit numeric IDs without dashes to the standard format: XX-XXXX-XXXX-XXXX
 * 
 * Requirements:
 * - If the ABHA ID contains exactly 14 numeric digits (no dashes), format it as XX-XXXX-XXXX-XXXX
 * - If the ABHA ID already has dashes or is not exactly 14 numeric digits, leave it unchanged
 * - Preserve null/empty values
 * 
 * Examples:
 * - "12345678901234" → "12-3456-7890-1234" (14 digits, add dashes)
 * - "12-3456-7890-1234" → "12-3456-7890-1234" (already has dashes, no change)
 * - "123456789" → "123456789" (not 14 digits, no change)
 * - "ABC123" → "ABC123" (not numeric, no change)
 * - null → null (preserve null)
 * 
 * Usage:
 *   # Dry run (analyze only, no updates):
 *   npx tsx scripts/standardize-abha-id-format.ts
 * 
 *   # Actually update the database:
 *   npx tsx scripts/standardize-abha-id-format.ts --apply
 * 
 * Author: System Administrator
 * Date: 2025-10-26
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
}

/**
 * Check if a string contains exactly 14 numeric digits (no dashes)
 */
function isUnformattedHealthId(healthId: string): boolean {
  // Remove all whitespace
  const trimmed = healthId.trim()
  
  // Check if it's exactly 14 digits with no dashes or other characters
  return /^\d{14}$/.test(trimmed)
}

/**
 * Format a 14-digit ABHA ID to XX-XXXX-XXXX-XXXX format
 */
function formatHealthId(healthId: string): string {
  const digits = healthId.trim()
  
  if (digits.length !== 14) {
    return healthId // Return as-is if not 14 digits
  }
  
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
}

/**
 * Analyze and optionally update ABHA IDs in the database
 */
async function standardizeHealthIds(shouldApply: boolean = false) {
  console.log("=".repeat(80))
  console.log(`${colors.bright}ABHA ID Standardization Script${colors.reset}`)
  console.log("=".repeat(80))
  console.log()
  
  if (shouldApply) {
    console.log(`${colors.yellow}⚠️  MODE: APPLY CHANGES (Database will be updated)${colors.reset}`)
  } else {
    console.log(`${colors.cyan}ℹ️  MODE: DRY RUN (No changes will be made)${colors.reset}`)
  }
  console.log()
  
  try {
    // Step 1: Get all residents with non-null health IDs
    console.log(`${colors.blue}📊 Step 1: Fetching all residents with Health IDs...${colors.reset}`)
    
    const residents = await prisma.resident.findMany({
      where: {
        healthId: {
          not: null,
        },
      },
      select: {
        id: true,
        residentId: true,
        name: true,
        healthId: true,
      },
    })
    
    console.log(`   Found ${colors.bright}${residents.length.toLocaleString()}${colors.reset} residents with Health IDs`)
    console.log()
    
    // Step 2: Analyze which ones need formatting
    console.log(`${colors.blue}🔍 Step 2: Analyzing Health ID formats...${colors.reset}`)
    
    const needsFormatting: typeof residents = []
    const alreadyFormatted: typeof residents = []
    const invalidFormat: typeof residents = []
    
    for (const resident of residents) {
      const healthId = resident.healthId || ""
      
      if (isUnformattedHealthId(healthId)) {
        needsFormatting.push(resident)
      } else if (healthId.includes("-")) {
        alreadyFormatted.push(resident)
      } else {
        invalidFormat.push(resident)
      }
    }
    
    console.log()
    console.log(`${colors.green}✅ Already formatted (with dashes):${colors.reset} ${alreadyFormatted.length.toLocaleString()}`)
    console.log(`${colors.yellow}⚠️  Needs formatting (14 digits, no dashes):${colors.reset} ${needsFormatting.length.toLocaleString()}`)
    console.log(`${colors.red}❌ Invalid format (not 14 digits):${colors.reset} ${invalidFormat.length.toLocaleString()}`)
    console.log()
    
    // Step 3: Show sample records that need formatting
    if (needsFormatting.length > 0) {
      console.log(`${colors.blue}📋 Step 3: Sample records that will be updated:${colors.reset}`)
      console.log()
      
      const sampleSize = Math.min(10, needsFormatting.length)
      for (let i = 0; i < sampleSize; i++) {
        const resident = needsFormatting[i]
        const oldValue = resident.healthId || ""
        const newValue = formatHealthId(oldValue)
        
        console.log(`   ${i + 1}. ${resident.name}`)
        console.log(`      Resident ID: ${resident.residentId}`)
        console.log(`      ${colors.red}Old:${colors.reset} ${oldValue}`)
        console.log(`      ${colors.green}New:${colors.reset} ${newValue}`)
        console.log()
      }
      
      if (needsFormatting.length > sampleSize) {
        console.log(`   ... and ${needsFormatting.length - sampleSize} more records`)
        console.log()
      }
    }
    
    // Step 4: Show sample invalid records (for information)
    if (invalidFormat.length > 0) {
      console.log(`${colors.blue}📋 Step 4: Sample invalid Health IDs (will NOT be changed):${colors.reset}`)
      console.log()
      
      const sampleSize = Math.min(5, invalidFormat.length)
      for (let i = 0; i < sampleSize; i++) {
        const resident = invalidFormat[i]
        const healthId = resident.healthId || ""
        
        console.log(`   ${i + 1}. ${resident.name}`)
        console.log(`      Resident ID: ${resident.residentId}`)
        console.log(`      Health ID: ${healthId} (length: ${healthId.length})`)
        console.log()
      }
      
      if (invalidFormat.length > sampleSize) {
        console.log(`   ... and ${invalidFormat.length - sampleSize} more invalid records`)
        console.log()
      }
    }
    
    // Step 5: Apply changes if requested
    if (shouldApply && needsFormatting.length > 0) {
      console.log(`${colors.blue}🔄 Step 5: Applying changes to database...${colors.reset}`)
      console.log()
      
      let successCount = 0
      let errorCount = 0
      
      for (const resident of needsFormatting) {
        try {
          const oldValue = resident.healthId || ""
          const newValue = formatHealthId(oldValue)
          
          await prisma.resident.update({
            where: { id: resident.id },
            data: { healthId: newValue },
          })
          
          successCount++
          
          // Show progress every 100 records
          if (successCount % 100 === 0) {
            console.log(`   Updated ${successCount.toLocaleString()} / ${needsFormatting.length.toLocaleString()} records...`)
          }
        } catch (error) {
          errorCount++
          console.error(`   ${colors.red}Error updating resident ${resident.residentId}:${colors.reset}`, error)
        }
      }
      
      console.log()
      console.log(`${colors.green}✅ Successfully updated:${colors.reset} ${successCount.toLocaleString()} records`)
      if (errorCount > 0) {
        console.log(`${colors.red}❌ Errors:${colors.reset} ${errorCount.toLocaleString()} records`)
      }
      console.log()
    } else if (!shouldApply && needsFormatting.length > 0) {
      console.log(`${colors.yellow}⚠️  DRY RUN: No changes were made to the database${colors.reset}`)
      console.log(`   To apply these changes, run: ${colors.bright}npx tsx scripts/standardize-abha-id-format.ts --apply${colors.reset}`)
      console.log()
    } else if (needsFormatting.length === 0) {
      console.log(`${colors.green}✅ All Health IDs are already in the correct format!${colors.reset}`)
      console.log()
    }
    
    // Summary
    console.log("=".repeat(80))
    console.log(`${colors.bright}Summary${colors.reset}`)
    console.log("=".repeat(80))
    console.log(`Total residents with Health IDs: ${residents.length.toLocaleString()}`)
    console.log(`Already formatted: ${alreadyFormatted.length.toLocaleString()}`)
    console.log(`Needs formatting: ${needsFormatting.length.toLocaleString()}`)
    console.log(`Invalid format: ${invalidFormat.length.toLocaleString()}`)
    console.log("=".repeat(80))
    console.log()
    
  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Main execution
const shouldApply = process.argv.includes("--apply")
standardizeHealthIds(shouldApply)

