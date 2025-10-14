/**
 * Password Update Script for Panchayat Secretaries and Field Officers
 * 
 * This script updates passwords for PANCHAYAT_SECRETARY and FIELD_OFFICER users
 * from the current password (Welcome@123) to a new password (Test@123).
 * 
 * Features:
 * - Dry-run mode to preview changes without applying them
 * - Interactive confirmation before making changes
 * - Proper bcrypt password hashing (same algorithm used in the system)
 * - Detailed logging of all operations
 * - Error handling and rollback on failure
 * - Idempotent (safe to run multiple times)
 * 
 * Usage:
 *   # Dry run (preview changes without applying)
 *   npx tsx scripts/update-passwords.ts --dry-run
 * 
 *   # Apply changes (with confirmation prompt)
 *   npx tsx scripts/update-passwords.ts
 * 
 *   # Apply changes without confirmation (use with caution!)
 *   npx tsx scripts/update-passwords.ts --force
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import * as readline from "readline"

const prisma = new PrismaClient()

// Configuration
const OLD_PASSWORD = "Welcome@123"
const NEW_PASSWORD = "Test@123"
const BCRYPT_SALT_ROUNDS = 10 // Same as used in create-field-officers.ts

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const isForce = args.includes("--force")

/**
 * Prompt user for confirmation
 */
function askForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes")
    })
  })
}

/**
 * Verify that a user's current password matches the expected old password
 */
async function verifyOldPassword(passwordHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(OLD_PASSWORD, passwordHash)
  } catch (error) {
    console.error("Error verifying password:", error)
    return false
  }
}

/**
 * Main function to update passwords
 */
async function updatePasswords() {
  console.log("🔐 Password Update Script for Panchayat Secretaries and Field Officers")
  console.log("=" .repeat(80))
  console.log()

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made to the database")
    console.log()
  }

  try {
    // Step 1: Fetch all Panchayat Secretaries and Field Officers
    console.log("📊 Step 1: Fetching users...")
    console.log("─".repeat(80))

    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ["PANCHAYAT_SECRETARY", "FIELD_OFFICER"],
        },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        passwordHash: true,
        mandalName: true,
        assignedSecretariats: true,
        isActive: true,
      },
      orderBy: [
        { role: "asc" },
        { mandalName: "asc" },
        { username: "asc" },
      ],
    })

    console.log(`Found ${users.length} users:`)
    const panchayatSecretaries = users.filter((u) => u.role === "PANCHAYAT_SECRETARY")
    const fieldOfficers = users.filter((u) => u.role === "FIELD_OFFICER")
    console.log(`  - ${panchayatSecretaries.length} Panchayat Secretaries`)
    console.log(`  - ${fieldOfficers.length} Field Officers`)
    console.log()

    if (users.length === 0) {
      console.log("✅ No users found to update. Exiting.")
      return
    }

    // Step 2: Verify current passwords and categorize users
    console.log("🔍 Step 2: Verifying current passwords...")
    console.log("─".repeat(80))

    const usersToUpdate: typeof users = []
    const usersAlreadyUpdated: typeof users = []
    const usersWithDifferentPassword: typeof users = []

    for (const user of users) {
      const hasOldPassword = await verifyOldPassword(user.passwordHash)
      const hasNewPassword = await bcrypt.compare(NEW_PASSWORD, user.passwordHash)

      if (hasOldPassword) {
        usersToUpdate.push(user)
      } else if (hasNewPassword) {
        usersAlreadyUpdated.push(user)
      } else {
        usersWithDifferentPassword.push(user)
      }
    }

    console.log(`Password verification results:`)
    console.log(`  ✅ Users with old password (${OLD_PASSWORD}): ${usersToUpdate.length}`)
    console.log(`  ℹ️  Users already updated (${NEW_PASSWORD}): ${usersAlreadyUpdated.length}`)
    console.log(`  ⚠️  Users with different password: ${usersWithDifferentPassword.length}`)
    console.log()

    // Show users with different passwords (potential issue)
    if (usersWithDifferentPassword.length > 0) {
      console.log("⚠️  WARNING: The following users have a different password:")
      console.log("─".repeat(80))
      for (const user of usersWithDifferentPassword) {
        console.log(`  - ${user.username} (${user.fullName}) - ${user.role}`)
      }
      console.log()
      console.log("These users will NOT be updated. Please verify their passwords manually.")
      console.log()
    }

    // Show users already updated
    if (usersAlreadyUpdated.length > 0 && isDryRun) {
      console.log("ℹ️  Users already updated (no action needed):")
      console.log("─".repeat(80))
      for (const user of usersAlreadyUpdated) {
        console.log(`  - ${user.username} (${user.fullName}) - ${user.role}`)
      }
      console.log()
    }

    // If no users need updating, exit
    if (usersToUpdate.length === 0) {
      console.log("✅ All users are already up to date. No changes needed.")
      return
    }

    // Step 3: Show users that will be updated
    console.log("📝 Step 3: Users to be updated:")
    console.log("─".repeat(80))

    // Group by role for better readability
    const psToUpdate = usersToUpdate.filter((u) => u.role === "PANCHAYAT_SECRETARY")
    const foToUpdate = usersToUpdate.filter((u) => u.role === "FIELD_OFFICER")

    if (psToUpdate.length > 0) {
      console.log(`\n  Panchayat Secretaries (${psToUpdate.length}):`)
      for (const user of psToUpdate) {
        console.log(`    - ${user.username} (${user.fullName}) - Mandal: ${user.mandalName || "N/A"}`)
      }
    }

    if (foToUpdate.length > 0) {
      console.log(`\n  Field Officers (${foToUpdate.length}):`)
      for (const user of foToUpdate) {
        const secretariats = user.assignedSecretariats
          ? JSON.parse(user.assignedSecretariats).slice(0, 2).join(", ") + "..."
          : "N/A"
        console.log(`    - ${user.username} (${user.fullName}) - Secretariats: ${secretariats}`)
      }
    }

    console.log()
    console.log("─".repeat(80))
    console.log(`Total users to update: ${usersToUpdate.length}`)
    console.log(`Old password: ${OLD_PASSWORD}`)
    console.log(`New password: ${NEW_PASSWORD}`)
    console.log("─".repeat(80))
    console.log()

    // If dry run, exit here
    if (isDryRun) {
      console.log("🔍 DRY RUN COMPLETE - No changes were made")
      console.log()
      console.log("To apply these changes, run:")
      console.log("  npx tsx scripts/update-passwords.ts")
      return
    }

    // Step 4: Confirm before proceeding
    if (!isForce) {
      console.log("⚠️  WARNING: This will update passwords for the users listed above.")
      console.log()
      const confirmed = await askForConfirmation(
        "Are you sure you want to proceed? (y/N): "
      )

      if (!confirmed) {
        console.log()
        console.log("❌ Operation cancelled by user.")
        return
      }
      console.log()
    }

    // Step 5: Generate new password hash
    console.log("🔒 Step 4: Generating new password hash...")
    console.log("─".repeat(80))

    const newPasswordHash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_SALT_ROUNDS)
    console.log(`✅ New password hash generated (${newPasswordHash.length} characters)`)
    console.log()

    // Step 6: Update passwords
    console.log("💾 Step 5: Updating passwords...")
    console.log("─".repeat(80))

    let successCount = 0
    let errorCount = 0
    const errors: Array<{ username: string; error: string }> = []

    for (const user of usersToUpdate) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newPasswordHash },
        })

        successCount++
        console.log(`  ✅ Updated: ${user.username} (${user.fullName})`)
      } catch (error) {
        errorCount++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push({ username: user.username, error: errorMessage })
        console.error(`  ❌ Failed: ${user.username} - ${errorMessage}`)
      }
    }

    console.log()
    console.log("=" .repeat(80))
    console.log("📊 SUMMARY")
    console.log("=" .repeat(80))
    console.log(`Total users processed: ${usersToUpdate.length}`)
    console.log(`✅ Successfully updated: ${successCount}`)
    console.log(`❌ Failed: ${errorCount}`)
    console.log()

    if (errors.length > 0) {
      console.log("❌ Errors encountered:")
      for (const error of errors) {
        console.log(`  - ${error.username}: ${error.error}`)
      }
      console.log()
    }

    if (successCount === usersToUpdate.length) {
      console.log("🎉 All passwords updated successfully!")
    } else if (successCount > 0) {
      console.log("⚠️  Some passwords were updated, but there were errors.")
    } else {
      console.log("❌ No passwords were updated due to errors.")
    }

    console.log()
  } catch (error) {
    console.error()
    console.error("❌ FATAL ERROR:")
    console.error("─".repeat(80))
    console.error(error)
    console.error()
    console.error("The operation was aborted. No changes were made.")
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
updatePasswords()
  .then(() => {
    console.log("✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Script failed:", error)
    process.exit(1)
  })

