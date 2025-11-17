/**
 * Preview Excel File Structure
 * Quick script to examine the structure of the mobile_number_repeated_data.xlsx file
 */

import ExcelJS from "exceljs"
import path from "path"

async function previewExcelFile() {
  const filePath = path.join(process.cwd(), "..", "mobile_number_repeated_data.xlsx")
  
  console.log("📂 Reading Excel file:", filePath)
  console.log()
  
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  
  console.log("📊 Workbook Info:")
  console.log(`   Sheets: ${workbook.worksheets.length}`)
  console.log()
  
  workbook.worksheets.forEach((worksheet, index) => {
    console.log(`📄 Sheet ${index + 1}: "${worksheet.name}"`)
    console.log(`   Rows: ${worksheet.rowCount}`)
    console.log(`   Columns: ${worksheet.columnCount}`)
    console.log()
    
    // Show headers (first row)
    const headerRow = worksheet.getRow(1)
    console.log("   Headers:")
    headerRow.eachCell((cell, colNumber) => {
      console.log(`      Column ${colNumber}: ${cell.value}`)
    })
    console.log()
    
    // Show first 5 data rows
    console.log("   Sample Data (first 5 rows):")
    for (let i = 2; i <= Math.min(6, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i)
      const rowData: any = {}
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getRow(1).getCell(colNumber).value
        rowData[String(header)] = cell.value
      })
      console.log(`      Row ${i}:`, JSON.stringify(rowData, null, 2))
    }
    console.log()
  })
}

previewExcelFile().catch(console.error)

