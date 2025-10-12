import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔧 Fixing Field Officer Assignment...\n")

  // Update field_officer_1 with correct assignment format
  const updatedUser = await prisma.user.update({
    where: { username: "field_officer_1" },
    data: {
      assignedSecretariats: JSON.stringify([
        {
          mandalName: "CHITTOOR",
          secName: "KONGAREDDYPALLI",
        },
      ]),
    },
  })

  console.log("✅ Successfully updated field_officer_1!")
  console.log()
  console.log("Updated User Information:")
  console.log("   Username:", updatedUser.username)
  console.log("   Full Name:", updatedUser.fullName)
  console.log("   Role:", updatedUser.role)
  console.log("   Assigned Secretariats:", updatedUser.assignedSecretariats)
  console.log()

  // Verify the assignment
  const parsed = JSON.parse(updatedUser.assignedSecretariats || "[]")
  console.log("📋 Parsed Assignment:")
  console.log(JSON.stringify(parsed, null, 2))
  console.log()

  console.log("✅ Assignment is now in the correct format!")
  console.log()
  console.log("Next Steps:")
  console.log("1. Log out and log back in as field_officer_1")
  console.log("2. Navigate to the Field Officer Dashboard")
  console.log("3. You should see:")
  console.log("   - Mandal dropdown pre-filled with 'CHITTOOR' (disabled)")
  console.log("   - Secretariat dropdown pre-filled with 'KONGAREDDYPALLI' (disabled)")
  console.log("   - No warning about missing secretariat assignments")
}

main()
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

