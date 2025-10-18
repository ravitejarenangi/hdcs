/**
 * Fix Invalid DOB (Date of Birth) Values Script
 * 
 * Purpose:
 * This script identifies and fixes invalid date values in the `dob` column
 * that cause Prisma errors when querying residents.
 * 
 * Problem:
 * Some residents have invalid DOB values like:
 * - '0000-00-00' (all zeros)
 * - '1990-00-15' (month set to zero)
 * - '1990-05-00' (day set to zero)
 * 
 * These invalid dates cause Prisma to throw errors:
 * "Value out of range for the type: The column `dob` contained an invalid 
 * datetime value with either day or month set to zero."
 * 
 * Solution:
 * Set invalid DOB values to NULL, which is the proper way to represent
 * "unknown" or "missing" date of birth in the database.
 * 
 * Usage:
 *   # Dry run (analyze only, no updates):
 *   npx tsx scripts/fix-invalid-dob-dates.ts
 * 
 *   # Actually fix invalid dates:
 *   npx tsx scripts/fix-invalid-dob-dates.ts --fix
 * 
 * Author: System Administrator
 * Date: 2025-10-18
 */

import { PrismaClient } from "@prisma/client"
import mysql from "mysql2/promise"

const prisma = new PrismaClient()

// Parse DATABASE_URL to get connection details
function parseDatabaseUrl(url: string) {
  // Format: mysql://user:password@host:port/database
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) {
    throw new Error("Invalid DATABASE_URL format")
  }
  return {
    host: match[3],
    port: parseInt(match[4]),
    user: match[1],
    password: match[2],
    database: match[5],
  }
}

const DATABASE_URL = process.env.DATABASE_URL || ""
const DB_CONFIG = parseDatabaseUrl(DATABASE_URL)

async function analyzeAndFixInvalidDates(shouldFix: boolean = false) {
  console.log("=" .repeat(80))
  console.log("Invalid DOB (Date of Birth) Fix Script")
  console.log("=" .repeat(80))
  console.log()

  let connection: mysql.Connection | null = null

  try {
    // Connect to MySQL directly (bypassing Prisma for raw queries)
    console.log("📊 Step 1: Connecting to database...")
    connection = await mysql.createConnection(DB_CONFIG)
    console.log("   ✅ Connected successfully")
    console.log()

    // Step 2: Find invalid dates
    console.log("🔍 Step 2: Searching for invalid DOB values...")
    
    // Query to find invalid dates (dates with day or month = 0, or year = 0000)
    const [invalidDates] = await connection.execute(`
      SELECT 
        resident_id,
        name,
        dob,
        mandal_name,
        sec_name,
        phc_name
      FROM residents
      WHERE dob IS NOT NULL
        AND (
          YEAR(dob) = 0 
          OR MONTH(dob) = 0 
          OR DAY(dob) = 0
          OR dob = '0000-00-00'
        )
      ORDER BY mandal_name, sec_name, name
    `) as any

    console.log(`   Found ${invalidDates.length} residents with invalid DOB values`)
    console.log()

    if (invalidDates.length === 0) {
      console.log("✅ No invalid DOB values found. Database is clean!")
      console.log()
      return
    }

    // Step 3: Show statistics by location
    console.log("📈 Step 3: Statistics by Location")
    console.log("-" .repeat(80))

    // Group by mandal
    const byMandal = invalidDates.reduce((acc: any, row: any) => {
      const mandal = row.mandal_name || "Unknown"
      acc[mandal] = (acc[mandal] || 0) + 1
      return acc
    }, {})

    console.log("\nBy Mandal:")
    Object.entries(byMandal)
      .sort(([, a]: any, [, b]: any) => b - a)
      .forEach(([mandal, count]) => {
        console.log(`  ${mandal}: ${count}`)
      })

    // Group by secretariat
    const bySecretariat = invalidDates.reduce((acc: any, row: any) => {
      const key = `${row.mandal_name || "Unknown"} - ${row.sec_name || "Unknown"}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    console.log("\nBy Secretariat (Top 10):")
    Object.entries(bySecretariat)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10)
      .forEach(([secretariat, count]) => {
        console.log(`  ${secretariat}: ${count}`)
      })

    console.log()

    // Step 4: Show sample invalid dates
    console.log("📋 Step 4: Sample Invalid DOB Values (first 20)")
    console.log("-" .repeat(80))

    const samples = invalidDates.slice(0, 20)
    for (let i = 0; i < samples.length; i++) {
      const row = samples[i]
      console.log(`\n${i + 1}. Resident ID: ${row.resident_id}`)
      console.log(`   Name: ${row.name}`)
      console.log(`   DOB: ${row.dob}`)
      console.log(`   Location: ${row.mandal_name} - ${row.sec_name}`)
      console.log(`   PHC: ${row.phc_name || "N/A"}`)
    }
    console.log()

    // Step 5: Fix or show what would be fixed
    if (shouldFix) {
      console.log("🔧 Step 5: Fixing invalid DOB values...")
      console.log("-" .repeat(80))
      console.log("   Setting invalid DOB values to NULL...")

      const [result] = await connection.execute(`
        UPDATE residents
        SET dob = NULL
        WHERE dob IS NOT NULL
          AND (
            YEAR(dob) = 0 
            OR MONTH(dob) = 0 
            OR DAY(dob) = 0
            OR dob = '0000-00-00'
          )
      `) as any

      console.log(`   ✅ Updated ${result.affectedRows} residents`)
      console.log()

      // Verify fix
      const [remaining] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM residents
        WHERE dob IS NOT NULL
          AND (
            YEAR(dob) = 0 
            OR MONTH(dob) = 0 
            OR DAY(dob) = 0
            OR dob = '0000-00-00'
          )
      `) as any

      console.log("📊 Verification:")
      console.log(`   Remaining invalid DOB values: ${remaining[0].count}`)
      console.log(`   Expected: 0`)
      console.log(`   Match: ${remaining[0].count === 0 ? "✅ Yes" : "❌ No"}`)
      console.log()

      if (remaining[0].count === 0) {
        console.log("✅ All invalid DOB values have been fixed!")
        console.log()
        console.log("🔄 Next Steps:")
        console.log("   1. Test the Field Officer login that was failing")
        console.log("   2. Search should now work without errors")
        console.log("   3. Invalid dates are now NULL (properly representing unknown DOB)")
        console.log()
      }
    } else {
      console.log("ℹ️  Step 5: DRY RUN MODE - No updates performed")
      console.log("-" .repeat(80))
      console.log(`Would set ${invalidDates.length} invalid DOB values to NULL`)
      console.log()
      console.log("To actually fix these dates, run:")
      console.log("  npx tsx scripts/fix-invalid-dob-dates.ts --fix")
      console.log()
    }

    // Step 6: Show impact
    console.log("📊 Step 6: Impact Analysis")
    console.log("-" .repeat(80))

    const [totalResidents] = await connection.execute(`
      SELECT COUNT(*) as count FROM residents
    `) as any

    const [residentsWithDob] = await connection.execute(`
      SELECT COUNT(*) as count FROM residents WHERE dob IS NOT NULL
    `) as any

    console.log(`Total residents: ${totalResidents[0].count}`)
    console.log(`Residents with DOB: ${residentsWithDob[0].count}`)
    console.log(`Invalid DOB values: ${invalidDates.length}`)
    console.log(`Percentage invalid: ${((invalidDates.length / residentsWithDob[0].count) * 100).toFixed(2)}%`)
    console.log()

    if (shouldFix) {
      console.log("After fix:")
      console.log(`Residents with valid DOB: ${residentsWithDob[0].count - invalidDates.length}`)
      console.log(`Residents with NULL DOB: ${totalResidents[0].count - residentsWithDob[0].count + invalidDates.length}`)
    }
    console.log()

    console.log("=" .repeat(80))
    console.log("✅ Script completed successfully")
    console.log("=" .repeat(80))

  } catch (error) {
    console.error("❌ Error during analysis/fix:", error)
    throw error
  } finally {
    if (connection) {
      await connection.end()
    }
    await prisma.$disconnect()
  }
}

// Main execution
const args = process.argv.slice(2)
const shouldFix = args.includes("--fix")

if (shouldFix) {
  console.log("⚠️  WARNING: Running in FIX mode")
  console.log("   This will set invalid DOB values to NULL")
  console.log()
}

analyzeAndFixInvalidDates(shouldFix)
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })

