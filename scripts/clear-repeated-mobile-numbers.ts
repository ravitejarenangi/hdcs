/**
 * Clear Repeated Mobile Numbers Script
 * 
 * Purpose:
 * This script clears the citizen_mobile field for residents with repeated mobile numbers.
 * It reads the list of residents from mobile_number_repeated_data.xlsx and sets their
 * citizen_mobile field to NULL in the database.
 * 
 * Background:
 * The Excel file contains residents whose mobile numbers appear multiple times in the database.
 * To ensure data integrity and avoid duplicate mobile numbers, we need to clear the citizen_mobile
 * field for these residents.
 * 
 * Usage:
 *   # Dry run (analyze only, no updates):
 *   npx tsx scripts/clear-repeated-mobile-numbers.ts
 * 
 *   # Actually update the database:
 *   npx tsx scripts/clear-repeated-mobile-numbers.ts --apply
 * 
 * Author: System Administrator
 * Date: 2025-10-26
 */

import { PrismaClient } from "@prisma/client"
import ExcelJS from "exceljs"
import path from "path"

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

interface ResidentRecord {
  residentId: number
  mobileNumber: string
  timesRepeated: number
  name: string
  mandalName: string
  secretariatName: string
}

/**
 * Read the Excel file and extract resident IDs with repeated mobile numbers
 */
async function readExcelFile(): Promise<ResidentRecord[]> {
  const filePath = path.join(process.cwd(), "..", "mobile_number_repeated_data.xlsx")
  
  console.log(`${colors.blue}📂 Reading Excel file:${colors.reset} ${filePath}`)
  console.log()
  
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  
  const worksheet = workbook.worksheets[0]
  const records: ResidentRecord[] = []
  
  // Skip header row (row 1), start from row 2
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i)
    
    const mandalName = row.getCell(1).value?.toString() || ""
    const secretariatName = row.getCell(2).value?.toString() || ""
    const residentId = Number(row.getCell(3).value)
    const mobileNumber = row.getCell(6).value?.toString() || ""
    const timesRepeated = Number(row.getCell(7).value) || 0
    const name = row.getCell(8).value?.toString() || ""
    
    if (residentId && !isNaN(residentId)) {
      records.push({
        residentId,
        mobileNumber,
        timesRepeated,
        name,
        mandalName,
        secretariatName,
      })
    }
  }
  
  console.log(`${colors.green}✅ Found ${records.length.toLocaleString()} residents in Excel file${colors.reset}`)
  console.log()
  
  return records
}

/**
 * Clear citizen_mobile field for residents with repeated mobile numbers
 */
async function clearRepeatedMobileNumbers(shouldApply: boolean = false) {
  console.log("=".repeat(80))
  console.log(`${colors.bright}Clear Repeated Mobile Numbers Script${colors.reset}`)
  console.log("=".repeat(80))
  console.log()
  
  if (shouldApply) {
    console.log(`${colors.yellow}⚠️  MODE: APPLY CHANGES (Database will be updated)${colors.reset}`)
  } else {
    console.log(`${colors.cyan}ℹ️  MODE: DRY RUN (No changes will be made)${colors.reset}`)
  }
  console.log()
  
  try {
    // Step 1: Read Excel file
    console.log(`${colors.blue}📊 Step 1: Reading Excel file...${colors.reset}`)
    const excelRecords = await readExcelFile()
    
    // Step 2: Get current database values for these residents
    console.log(`${colors.blue}🔍 Step 2: Checking current database values...${colors.reset}`)
    console.log()
    
    const residentIds = excelRecords.map(r => r.residentId.toString())
    
    const residents = await prisma.resident.findMany({
      where: {
        residentId: {
          in: residentIds,
        },
      },
      select: {
        id: true,
        residentId: true,
        name: true,
        citizenMobile: true,
        mobileNumber: true,
        mandalName: true,
        secName: true,
      },
    })
    
    console.log(`${colors.green}✅ Found ${residents.length.toLocaleString()} residents in database${colors.reset}`)
    console.log()
    
    // Step 3: Analyze which ones have citizen_mobile set
    const withCitizenMobile = residents.filter(r => r.citizenMobile !== null && r.citizenMobile !== "")
    const withoutCitizenMobile = residents.filter(r => r.citizenMobile === null || r.citizenMobile === "")
    const notFoundInDb = excelRecords.filter(
      er => !residents.find(r => r.residentId === er.residentId.toString())
    )
    
    console.log(`${colors.yellow}⚠️  Has citizen_mobile (will be cleared):${colors.reset} ${withCitizenMobile.length.toLocaleString()}`)
    console.log(`${colors.green}✅ Already NULL (no action needed):${colors.reset} ${withoutCitizenMobile.length.toLocaleString()}`)
    if (notFoundInDb.length > 0) {
      console.log(`${colors.red}❌ Not found in database:${colors.reset} ${notFoundInDb.length.toLocaleString()}`)
    }
    console.log()
    
    // Step 4: Show sample records that will be updated
    if (withCitizenMobile.length > 0) {
      console.log(`${colors.blue}📋 Step 3: Sample records that will be updated:${colors.reset}`)
      console.log()
      
      const sampleSize = Math.min(10, withCitizenMobile.length)
      for (let i = 0; i < sampleSize; i++) {
        const resident = withCitizenMobile[i]
        const excelRecord = excelRecords.find(er => er.residentId.toString() === resident.residentId)
        
        console.log(`   ${i + 1}. ${resident.name}`)
        console.log(`      Resident ID: ${resident.residentId}`)
        console.log(`      Mandal: ${resident.mandalName}`)
        console.log(`      Secretariat: ${resident.secName}`)
        console.log(`      ${colors.red}Current citizen_mobile:${colors.reset} ${resident.citizenMobile}`)
        console.log(`      ${colors.green}New citizen_mobile:${colors.reset} NULL`)
        if (excelRecord) {
          console.log(`      ${colors.yellow}Repeated mobile:${colors.reset} ${excelRecord.mobileNumber} (${excelRecord.timesRepeated} times)`)
        }
        console.log()
      }
      
      if (withCitizenMobile.length > sampleSize) {
        console.log(`   ... and ${withCitizenMobile.length - sampleSize} more records`)
        console.log()
      }
    }
    
    // Step 5: Show sample records that are already NULL
    if (withoutCitizenMobile.length > 0) {
      console.log(`${colors.blue}📋 Step 4: Sample records already NULL (no action needed):${colors.reset}`)
      console.log()
      
      const sampleSize = Math.min(5, withoutCitizenMobile.length)
      for (let i = 0; i < sampleSize; i++) {
        const resident = withoutCitizenMobile[i]
        
        console.log(`   ${i + 1}. ${resident.name}`)
        console.log(`      Resident ID: ${resident.residentId}`)
        console.log(`      citizen_mobile: ${resident.citizenMobile || "NULL"} ✅`)
        console.log()
      }
      
      if (withoutCitizenMobile.length > sampleSize) {
        console.log(`   ... and ${withoutCitizenMobile.length - sampleSize} more records`)
        console.log()
      }
    }
    
    // Step 6: Show records not found in database
    if (notFoundInDb.length > 0) {
      console.log(`${colors.blue}📋 Step 5: Sample records NOT found in database:${colors.reset}`)
      console.log()
      
      const sampleSize = Math.min(5, notFoundInDb.length)
      for (let i = 0; i < sampleSize; i++) {
        const record = notFoundInDb[i]
        
        console.log(`   ${i + 1}. ${record.name}`)
        console.log(`      Resident ID: ${record.residentId}`)
        console.log(`      Mandal: ${record.mandalName}`)
        console.log(`      Secretariat: ${record.secretariatName}`)
        console.log()
      }
      
      if (notFoundInDb.length > sampleSize) {
        console.log(`   ... and ${notFoundInDb.length - sampleSize} more records`)
        console.log()
      }
    }
    
    // Step 7: Apply changes if requested
    if (shouldApply && withCitizenMobile.length > 0) {
      console.log(`${colors.blue}🔄 Step 6: Clearing citizen_mobile field in database...${colors.reset}`)
      console.log()
      
      let successCount = 0
      let errorCount = 0
      
      for (const resident of withCitizenMobile) {
        try {
          await prisma.resident.update({
            where: { id: resident.id },
            data: { citizenMobile: null },
          })
          
          successCount++
          
          // Show progress every 100 records
          if (successCount % 100 === 0) {
            console.log(`   Cleared ${successCount.toLocaleString()} / ${withCitizenMobile.length.toLocaleString()} records...`)
          }
        } catch (error) {
          errorCount++
          console.error(`   ${colors.red}Error updating resident ${resident.residentId}:${colors.reset}`, error)
        }
      }
      
      console.log()
      console.log(`${colors.green}✅ Successfully cleared:${colors.reset} ${successCount.toLocaleString()} records`)
      if (errorCount > 0) {
        console.log(`${colors.red}❌ Errors:${colors.reset} ${errorCount.toLocaleString()} records`)
      }
      console.log()
    } else if (!shouldApply && withCitizenMobile.length > 0) {
      console.log(`${colors.yellow}⚠️  DRY RUN: No changes were made to the database${colors.reset}`)
      console.log(`   To apply these changes, run: ${colors.bright}npx tsx scripts/clear-repeated-mobile-numbers.ts --apply${colors.reset}`)
      console.log()
    } else if (withCitizenMobile.length === 0) {
      console.log(`${colors.green}✅ All citizen_mobile fields are already NULL!${colors.reset}`)
      console.log()
    }
    
    // Summary
    console.log("=".repeat(80))
    console.log(`${colors.bright}Summary${colors.reset}`)
    console.log("=".repeat(80))
    console.log(`Total residents in Excel file: ${excelRecords.length.toLocaleString()}`)
    console.log(`Found in database: ${residents.length.toLocaleString()}`)
    console.log(`Has citizen_mobile (needs clearing): ${withCitizenMobile.length.toLocaleString()}`)
    console.log(`Already NULL (no action needed): ${withoutCitizenMobile.length.toLocaleString()}`)
    console.log(`Not found in database: ${notFoundInDb.length.toLocaleString()}`)
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
clearRepeatedMobileNumbers(shouldApply)

