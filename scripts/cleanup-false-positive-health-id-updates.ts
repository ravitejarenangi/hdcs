/**
 * Cleanup Script: Remove False Positive ABHA ID Update Logs
 * 
 * Purpose:
 * This script identifies and removes false positive update log entries for ABHA IDs
 * where only the format changed (with/without dashes) but the actual value didn't change.
 * 
 * Background:
 * Before the ABHA ID normalization fix (commit 4049e5c), the system was logging updates
 * when users clicked save even if they didn't change the ABHA ID, because the format
 * changed from "91-4188-3161-8834" to "91418831618834" or vice versa.
 * 
 * This script:
 * 1. Finds all health_id update log entries
 * 2. Normalizes both old and new values (removes dashes)
 * 3. Identifies entries where normalized values are identical (false positives)
 * 4. Provides statistics and optionally removes these false positive entries
 * 
 * Usage:
 *   # Dry run (analyze only, no deletion):
 *   npx tsx scripts/cleanup-false-positive-health-id-updates.ts
 * 
 *   # Actually delete false positives:
 *   npx tsx scripts/cleanup-false-positive-health-id-updates.ts --delete
 * 
 * Author: System Administrator
 * Date: 2025-10-18
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Helper function to normalize ABHA ID (remove all non-digit characters)
function normalizeHealthId(healthId: string | null): string {
  if (!healthId || healthId === "null" || healthId === "N/A" || healthId === "") {
    return ""
  }
  // Remove all non-digit characters
  return healthId.replace(/\D/g, "")
}

// Helper function to format ABHA ID for display
function formatHealthId(healthId: string): string {
  const digits = normalizeHealthId(healthId)
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
  }
  return healthId
}

async function analyzeAndCleanup(shouldDelete: boolean = false) {
  console.log("=" .repeat(80))
  console.log("ABHA ID Update Log Cleanup Script")
  console.log("=" .repeat(80))
  console.log()

  try {
    // Step 1: Get all health_id update logs
    console.log("📊 Step 1: Fetching all ABHA ID update logs...")
    const healthIdUpdates = await prisma.updateLog.findMany({
      where: {
        OR: [
          { fieldUpdated: "health_id" },
          { fieldUpdated: "healthId" },
        ],
      },
      orderBy: {
        updateTimestamp: "desc",
      },
    })

    console.log(`   Found ${healthIdUpdates.length} total ABHA ID update log entries`)
    console.log()

    // Step 2: Analyze for false positives
    console.log("🔍 Step 2: Analyzing for false positives...")
    const falsePositives: typeof healthIdUpdates = []
    const legitimateUpdates: typeof healthIdUpdates = []

    for (const update of healthIdUpdates) {
      const normalizedOld = normalizeHealthId(update.oldValue)
      const normalizedNew = normalizeHealthId(update.newValue)

      if (normalizedOld === normalizedNew && normalizedOld !== "") {
        // False positive: same value, just different format
        falsePositives.push(update)
      } else {
        // Legitimate update: actual value changed
        legitimateUpdates.push(update)
      }
    }

    console.log(`   ✅ Legitimate updates: ${legitimateUpdates.length}`)
    console.log(`   ❌ False positives: ${falsePositives.length}`)
    console.log()

    // Step 3: Show statistics
    console.log("📈 Step 3: Statistics")
    console.log("-" .repeat(80))
    console.log(`Total ABHA ID update logs:     ${healthIdUpdates.length}`)
    console.log(`Legitimate updates:            ${legitimateUpdates.length} (${((legitimateUpdates.length / healthIdUpdates.length) * 100).toFixed(1)}%)`)
    console.log(`False positives (format only): ${falsePositives.length} (${((falsePositives.length / healthIdUpdates.length) * 100).toFixed(1)}%)`)
    console.log()

    // Step 4: Show sample false positives
    if (falsePositives.length > 0) {
      console.log("📋 Step 4: Sample False Positives (first 10)")
      console.log("-" .repeat(80))
      const samples = falsePositives.slice(0, 10)
      
      for (let i = 0; i < samples.length; i++) {
        const fp = samples[i]
        console.log(`\n${i + 1}. Update ID: ${fp.id}`)
        console.log(`   Timestamp: ${fp.updateTimestamp.toISOString()}`)
        console.log(`   Resident ID: ${fp.residentId}`)
        console.log(`   Old Value: "${fp.oldValue}"`)
        console.log(`   New Value: "${fp.newValue}"`)
        console.log(`   Normalized: "${normalizeHealthId(fp.oldValue)}" (both are identical)`)
        console.log(`   Formatted: "${formatHealthId(fp.oldValue || "")}"`)
      }
      console.log()
    }

    // Step 5: Show breakdown by time period
    console.log("📅 Step 5: False Positives by Time Period")
    console.log("-" .repeat(80))
    
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const last24h = falsePositives.filter(fp => fp.updateTimestamp >= oneDayAgo).length
    const last7d = falsePositives.filter(fp => fp.updateTimestamp >= oneWeekAgo).length
    const last30d = falsePositives.filter(fp => fp.updateTimestamp >= oneMonthAgo).length
    const older = falsePositives.filter(fp => fp.updateTimestamp < oneMonthAgo).length

    console.log(`Last 24 hours:  ${last24h}`)
    console.log(`Last 7 days:    ${last7d}`)
    console.log(`Last 30 days:   ${last30d}`)
    console.log(`Older than 30d: ${older}`)
    console.log()

    // Step 6: Delete or show what would be deleted
    if (shouldDelete) {
      if (falsePositives.length === 0) {
        console.log("✅ No false positives to delete. Database is clean!")
        console.log()
      } else {
        console.log("🗑️  Step 6: Deleting false positive entries...")
        console.log("-" .repeat(80))

        const falsePositiveIds = falsePositives.map(fp => fp.id)

        // Delete in batches to avoid MySQL prepared statement limit (max ~65,535 placeholders)
        const BATCH_SIZE = 1000
        let totalDeleted = 0

        console.log(`   Deleting ${falsePositiveIds.length} entries in batches of ${BATCH_SIZE}...`)

        for (let i = 0; i < falsePositiveIds.length; i += BATCH_SIZE) {
          const batch = falsePositiveIds.slice(i, i + BATCH_SIZE)
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1
          const totalBatches = Math.ceil(falsePositiveIds.length / BATCH_SIZE)

          const deleteResult = await prisma.updateLog.deleteMany({
            where: {
              id: {
                in: batch,
              },
            },
          })

          totalDeleted += deleteResult.count
          console.log(`   Batch ${batchNumber}/${totalBatches}: Deleted ${deleteResult.count} entries (Total: ${totalDeleted})`)
        }

        console.log()
        console.log(`✅ Successfully deleted ${totalDeleted} false positive entries`)
        console.log()

        // Verify deletion
        const remainingHealthIdUpdates = await prisma.updateLog.count({
          where: {
            OR: [
              { fieldUpdated: "health_id" },
              { fieldUpdated: "healthId" },
            ],
          },
        })

        console.log("📊 After Cleanup:")
        console.log(`   Remaining ABHA ID update logs: ${remainingHealthIdUpdates}`)
        console.log(`   Expected: ${legitimateUpdates.length}`)
        console.log(`   Match: ${remainingHealthIdUpdates === legitimateUpdates.length ? "✅ Yes" : "❌ No"}`)
        console.log()
      }
    } else {
      console.log("ℹ️  Step 6: DRY RUN MODE - No deletions performed")
      console.log("-" .repeat(80))
      if (falsePositives.length > 0) {
        console.log(`Would delete ${falsePositives.length} false positive entries`)
        console.log()
        console.log("To actually delete these entries, run:")
        console.log("  npx tsx scripts/cleanup-false-positive-health-id-updates.ts --delete")
      } else {
        console.log("✅ No false positives found. Database is clean!")
      }
      console.log()
    }

    // Step 7: Show impact on Recent Updates count
    console.log("📊 Step 7: Impact on Recent Updates Statistics")
    console.log("-" .repeat(80))
    
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const currentTotalUpdates = await prisma.updateLog.count({
      where: {
        updateTimestamp: { gte: thirtyDaysAgo },
      },
    })

    const currentHealthIdUpdates = await prisma.updateLog.count({
      where: {
        updateTimestamp: { gte: thirtyDaysAgo },
        OR: [
          { fieldUpdated: "health_id" },
          { fieldUpdated: "healthId" },
        ],
      },
    })

    const falsePositivesLast30d = falsePositives.filter(
      fp => fp.updateTimestamp >= thirtyDaysAgo
    ).length

    console.log("Current (Last 30 Days):")
    console.log(`  Total Updates:           ${currentTotalUpdates}`)
    console.log(`  ABHA ID Updates:         ${currentHealthIdUpdates}`)
    console.log()
    console.log("After Cleanup (Last 30 Days):")
    console.log(`  Total Updates:           ${currentTotalUpdates - falsePositivesLast30d}`)
    console.log(`  ABHA ID Updates:         ${currentHealthIdUpdates - falsePositivesLast30d}`)
    console.log(`  Reduction:               -${falsePositivesLast30d} (${((falsePositivesLast30d / currentTotalUpdates) * 100).toFixed(1)}%)`)
    console.log()

    console.log("=" .repeat(80))
    console.log("✅ Script completed successfully")
    console.log("=" .repeat(80))

  } catch (error) {
    console.error("❌ Error during cleanup:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Main execution
const args = process.argv.slice(2)
const shouldDelete = args.includes("--delete")

if (shouldDelete) {
  console.log("⚠️  WARNING: Running in DELETE mode")
  console.log("   This will permanently remove false positive update log entries")
  console.log()
}

analyzeAndCleanup(shouldDelete)
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })

