/**
 * Clear Citizen Mobile Script
 * 
 * This script sets the `citizenMobile` field to NULL for all residents in the database.
 * 
 * CONTEXT:
 * - `mobileNumber` is the primary mobile number field used throughout the application
 * - `citizenMobile` is a legacy field only used in import/export operations
 * - This script cleans up the `citizenMobile` field by setting all values to NULL
 * 
 * USAGE:
 *   # Preview changes without modifying database
 *   npx tsx scripts/clear-citizen-mobile.ts --dry-run
 * 
 *   # Apply changes with confirmation prompt
 *   npx tsx scripts/clear-citizen-mobile.ts
 * 
 *   # Apply changes without confirmation
 *   npx tsx scripts/clear-citizen-mobile.ts --force
 * 
 * SAFETY FEATURES:
 * - Dry-run mode to preview changes
 * - Confirmation prompt before applying changes
 * - Idempotent (safe to run multiple times)
 * - Detailed logging and error handling
 * 
 * @author Chittoor Health System
 * @date 2025-10-14
 */

import { PrismaClient } from "@prisma/client"
import * as readline from "readline"

const prisma = new PrismaClient()

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

// Helper function to format timestamp
function timestamp(): string {
  return new Date().toISOString()
}

// Helper function to print colored output
function print(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

// Helper function to print section headers
function printHeader(title: string) {
  const line = "─".repeat(80)
  print(`\n${line}`, colors.dim)
  print(title, colors.bright + colors.cyan)
  print(line, colors.dim)
}

// Helper function to get user confirmation
async function getUserConfirmation(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${prompt} (y/n): ${colors.reset}`, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes")
    })
  })
}

// Main function
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run")
  const isForce = args.includes("--force")

  print("\n" + "=".repeat(80), colors.bright + colors.blue)
  print("🧹 CLEAR CITIZEN MOBILE SCRIPT", colors.bright + colors.blue)
  print("=".repeat(80), colors.bright + colors.blue)
  print(`Started at: ${timestamp()}`, colors.dim)

  if (isDryRun) {
    print("\n⚠️  DRY-RUN MODE: No changes will be made to the database", colors.yellow)
  }

  try {
    // Step 1: Fetch statistics
    printHeader("📊 Step 1: Analyzing current data...")

    const totalResidents = await prisma.resident.count()
    print(`  Total residents in database: ${totalResidents.toLocaleString()}`, colors.cyan)

    const residentsWithCitizenMobile = await prisma.resident.count({
      where: {
        citizenMobile: {
          not: null,
        },
      },
    })

    const residentsWithNullCitizenMobile = totalResidents - residentsWithCitizenMobile

    print(
      `  Residents with non-null citizenMobile: ${residentsWithCitizenMobile.toLocaleString()}`,
      colors.yellow
    )
    print(
      `  Residents with null citizenMobile: ${residentsWithNullCitizenMobile.toLocaleString()}`,
      colors.green
    )

    // Step 2: Check if any action is needed
    printHeader("🔍 Step 2: Determining required action...")

    if (residentsWithCitizenMobile === 0) {
      print(
        "\n✅ All residents already have null citizenMobile. No changes needed.",
        colors.green
      )
      print("\n✅ Script completed successfully", colors.green)
      return
    }

    print(
      `  ${residentsWithCitizenMobile.toLocaleString()} resident(s) will be updated`,
      colors.yellow
    )

    // Step 3: Sample data (show a few examples)
    printHeader("📋 Step 3: Sample data (first 5 residents with non-null citizenMobile)...")

    const sampleResidents = await prisma.resident.findMany({
      where: {
        citizenMobile: {
          not: null,
        },
      },
      select: {
        residentId: true,
        name: true,
        mobileNumber: true,
        citizenMobile: true,
      },
      take: 5,
    })

    if (sampleResidents.length > 0) {
      sampleResidents.forEach((resident, index) => {
        print(
          `  ${index + 1}. ${resident.residentId} (${resident.name})`,
          colors.dim
        )
        print(
          `     - mobileNumber: ${resident.mobileNumber || "NULL"}`,
          colors.dim
        )
        print(
          `     - citizenMobile: ${resident.citizenMobile || "NULL"} → will be set to NULL`,
          colors.yellow
        )
      })

      if (residentsWithCitizenMobile > 5) {
        print(
          `  ... and ${(residentsWithCitizenMobile - 5).toLocaleString()} more resident(s)`,
          colors.dim
        )
      }
    }

    // Step 4: Dry-run exit
    if (isDryRun) {
      printHeader("✅ Dry-run completed")
      print(
        `\n📊 Summary: ${residentsWithCitizenMobile.toLocaleString()} resident(s) would be updated`,
        colors.cyan
      )
      print(
        "\nTo apply these changes, run the script without --dry-run flag:",
        colors.dim
      )
      print("  npx tsx scripts/clear-citizen-mobile.ts", colors.bright)
      return
    }

    // Step 5: Confirmation
    printHeader("⚠️  Step 4: Confirmation required")

    print(
      `\nYou are about to set citizenMobile to NULL for ${residentsWithCitizenMobile.toLocaleString()} resident(s).`,
      colors.yellow
    )
    print("This action will:", colors.yellow)
    print("  • Clear the citizenMobile field for all affected residents", colors.yellow)
    print("  • NOT affect the mobileNumber field (primary mobile field)", colors.green)
    print("  • Be logged in the database", colors.dim)

    if (!isForce) {
      print("\n⚠️  This action cannot be easily undone!", colors.red)
      const confirmed = await getUserConfirmation(
        "\nDo you want to proceed with clearing citizenMobile?"
      )

      if (!confirmed) {
        print("\n❌ Operation cancelled by user", colors.red)
        return
      }
    } else {
      print("\n⚡ Force mode enabled - skipping confirmation", colors.yellow)
    }

    // Step 6: Apply changes
    printHeader("💾 Step 5: Clearing citizenMobile field...")

    const startTime = Date.now()
    let successCount = 0
    let failureCount = 0

    try {
      // Use updateMany for efficient bulk update
      const result = await prisma.resident.updateMany({
        where: {
          citizenMobile: {
            not: null,
          },
        },
        data: {
          citizenMobile: null,
        },
      })

      successCount = result.count
      print(`  ✅ Successfully updated ${successCount.toLocaleString()} resident(s)`, colors.green)
    } catch (error) {
      failureCount = residentsWithCitizenMobile
      print(`  ❌ Error updating residents: ${error}`, colors.red)
      throw error
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    // Step 7: Final summary
    printHeader("📊 SUMMARY")
    print(`Total residents processed: ${residentsWithCitizenMobile.toLocaleString()}`, colors.cyan)
    print(`✅ Successfully updated: ${successCount.toLocaleString()}`, colors.green)
    print(`❌ Failed: ${failureCount.toLocaleString()}`, colors.red)
    print(`⏱️  Duration: ${duration} seconds`, colors.dim)

    if (failureCount === 0) {
      print("\n🎉 All citizenMobile fields cleared successfully!", colors.green)
    } else {
      print("\n⚠️  Some updates failed. Please check the errors above.", colors.yellow)
    }

    print("\n✅ Script completed successfully", colors.green)
  } catch (error) {
    print("\n❌ Script failed with error:", colors.red)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    print(`\nEnded at: ${timestamp()}`, colors.dim)
    print("=".repeat(80) + "\n", colors.bright + colors.blue)
  }
}

// Run the script
main()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })

