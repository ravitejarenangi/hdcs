/**
 * Generate SQL Script to Clear Repeated Mobile Numbers
 * 
 * This script reads the Excel file and generates a SQL script
 * that can be executed directly in MySQL to clear citizen_mobile fields.
 */

import ExcelJS from "exceljs"
import path from "path"
import fs from "fs"

async function generateSQL() {
  const filePath = path.join(process.cwd(), "..", "mobile_number_repeated_data.xlsx")
  
  console.log("📂 Reading Excel file:", filePath)
  
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  
  const worksheet = workbook.worksheets[0]
  const residentIds: string[] = []
  
  // Skip header row (row 1), start from row 2
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i)
    const residentId = row.getCell(3).value?.toString()
    
    if (residentId) {
      residentIds.push(residentId)
    }
  }
  
  console.log(`✅ Found ${residentIds.length} resident IDs`)
  console.log()
  
  // Generate SQL script
  const sqlLines: string[] = []
  
  sqlLines.push("-- ============================================================================")
  sqlLines.push("-- Clear Repeated Mobile Numbers - SQL Script")
  sqlLines.push("-- ============================================================================")
  sqlLines.push("-- Purpose: Clear citizen_mobile field for residents with repeated mobile numbers")
  sqlLines.push(`-- Total residents to update: ${residentIds.length}`)
  sqlLines.push("-- Date: " + new Date().toISOString().split('T')[0])
  sqlLines.push("-- ============================================================================")
  sqlLines.push("")
  sqlLines.push("-- Step 1: Check current values (optional - for verification)")
  sqlLines.push("-- Uncomment to see current values before updating:")
  sqlLines.push("-- SELECT resident_id, name, citizen_mobile, mobile_number")
  sqlLines.push("-- FROM residents")
  sqlLines.push(`-- WHERE resident_id IN (${residentIds.slice(0, 10).map(id => `'${id}'`).join(', ')}, ...);`)
  sqlLines.push("")
  sqlLines.push("-- Step 2: Update citizen_mobile to NULL for all repeated mobile numbers")
  sqlLines.push("UPDATE `residents`")
  sqlLines.push("SET `citizen_mobile` = NULL")
  sqlLines.push("WHERE `resident_id` IN (")
  
  // Split into chunks of 100 IDs per line for readability
  const chunkSize = 100
  for (let i = 0; i < residentIds.length; i += chunkSize) {
    const chunk = residentIds.slice(i, i + chunkSize)
    const line = "  " + chunk.map(id => `'${id}'`).join(", ")
    
    if (i + chunkSize < residentIds.length) {
      sqlLines.push(line + ",")
    } else {
      sqlLines.push(line)
    }
  }
  
  sqlLines.push(");")
  sqlLines.push("")
  sqlLines.push("-- Step 3: Verify the update (optional)")
  sqlLines.push("-- Uncomment to verify that citizen_mobile is now NULL:")
  sqlLines.push("-- SELECT COUNT(*) as updated_count")
  sqlLines.push("-- FROM residents")
  sqlLines.push(`-- WHERE resident_id IN (${residentIds.slice(0, 10).map(id => `'${id}'`).join(', ')}, ...)`)
  sqlLines.push("-- AND citizen_mobile IS NULL;")
  sqlLines.push("")
  sqlLines.push("-- ============================================================================")
  sqlLines.push(`-- Expected result: ${residentIds.length} rows updated`)
  sqlLines.push("-- ============================================================================")
  
  const sqlContent = sqlLines.join("\n")
  
  // Save to file
  const outputPath = path.join(process.cwd(), "scripts", "clear-repeated-mobile-numbers.sql")
  fs.writeFileSync(outputPath, sqlContent, "utf-8")
  
  console.log("✅ SQL script generated successfully!")
  console.log("📄 Output file:", outputPath)
  console.log()
  console.log("To execute the SQL script:")
  console.log("  1. Using Prisma:")
  console.log("     npx prisma db execute --file scripts/clear-repeated-mobile-numbers.sql")
  console.log()
  console.log("  2. Using MySQL command line:")
  console.log("     mysql -u your_user -p chittoor_health < scripts/clear-repeated-mobile-numbers.sql")
  console.log()
}

generateSQL().catch(console.error)

