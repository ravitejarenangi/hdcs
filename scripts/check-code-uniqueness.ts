import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkCodeUniqueness() {
  console.log("🔍 Checking Mandal Code and Secretariat Code Uniqueness...\n")

  try {
    // 1. Check Mandal Codes
    console.log("=" .repeat(80))
    console.log("📍 MANDAL CODE ANALYSIS")
    console.log("=" .repeat(80))

    const mandalData = await prisma.resident.groupBy({
      by: ["mandalName", "mandalCode"],
      _count: {
        id: true,
      },
      where: {
        mandalName: { not: null },
      },
      orderBy: {
        mandalName: "asc",
      },
    })

    // Group by mandal name to check if each mandal has unique code
    const mandalsByName = new Map<string, Set<string | number>>()
    const mandalsByCode = new Map<string | number, Set<string>>()

    for (const item of mandalData) {
      const name = item.mandalName || "NULL"
      const code = item.mandalCode ?? "NULL"

      // Track codes per mandal name
      if (!mandalsByName.has(name)) {
        mandalsByName.set(name, new Set())
      }
      mandalsByName.get(name)!.add(code)

      // Track names per mandal code
      const codeKey = code.toString()
      if (!mandalsByCode.has(codeKey)) {
        mandalsByCode.set(codeKey, new Set())
      }
      mandalsByCode.get(codeKey)!.add(name)
    }

    console.log(`\n📊 Total Unique Mandals: ${mandalsByName.size}`)
    console.log(`📊 Total Unique Mandal Codes: ${mandalsByCode.size}\n`)

    // Check for mandals with multiple codes
    console.log("🔍 Checking if each Mandal has a unique Mandal Code:\n")
    let mandalIssuesFound = false

    for (const [mandalName, codes] of mandalsByName.entries()) {
      if (codes.size > 1) {
        mandalIssuesFound = true
        console.log(`❌ ISSUE: Mandal "${mandalName}" has ${codes.size} different codes:`)
        console.log(`   Codes: ${Array.from(codes).join(", ")}`)
      }
    }

    if (!mandalIssuesFound) {
      console.log("✅ Each Mandal has exactly ONE unique Mandal Code!")
    }

    // Check for codes used by multiple mandals
    console.log("\n🔍 Checking if each Mandal Code is used by only one Mandal:\n")
    let codeIssuesFound = false

    for (const [code, names] of mandalsByCode.entries()) {
      if (names.size > 1) {
        codeIssuesFound = true
        console.log(`❌ ISSUE: Mandal Code "${code}" is used by ${names.size} different mandals:`)
        console.log(`   Mandals: ${Array.from(names).join(", ")}`)
      }
    }

    if (!codeIssuesFound) {
      console.log("✅ Each Mandal Code is used by exactly ONE Mandal!")
    }

    // Display all mandal-code mappings
    console.log("\n📋 Complete Mandal → Code Mapping:\n")
    console.log("─".repeat(80))
    console.log(
      `${"Mandal Name".padEnd(40)} | ${"Mandal Code".padEnd(15)} | ${"Residents"}`
    )
    console.log("─".repeat(80))

    const sortedMandals = Array.from(mandalsByName.keys()).sort()
    for (const mandalName of sortedMandals) {
      const codes = Array.from(mandalsByName.get(mandalName)!)
      const residents = mandalData
        .filter((d) => d.mandalName === mandalName)
        .reduce((sum, d) => sum + d._count.id, 0)

      console.log(
        `${mandalName.padEnd(40)} | ${codes.join(", ").padEnd(15)} | ${residents.toLocaleString()}`
      )
    }

    // 2. Check Secretariat Codes
    console.log("\n\n" + "=".repeat(80))
    console.log("🏢 SECRETARIAT CODE ANALYSIS")
    console.log("=" .repeat(80))

    const secData = await prisma.resident.groupBy({
      by: ["secName", "secCode"],
      _count: {
        id: true,
      },
      where: {
        secName: { not: null },
      },
      orderBy: {
        secName: "asc",
      },
    })

    // Group by secretariat name to check if each has unique code
    const secsByName = new Map<string, Set<string | number>>()
    const secsByCode = new Map<string | number, Set<string>>()

    for (const item of secData) {
      const name = item.secName || "NULL"
      const code = item.secCode ?? "NULL"

      // Track codes per secretariat name
      if (!secsByName.has(name)) {
        secsByName.set(name, new Set())
      }
      secsByName.get(name)!.add(code)

      // Track names per secretariat code
      const codeKey = code.toString()
      if (!secsByCode.has(codeKey)) {
        secsByCode.set(codeKey, new Set())
      }
      secsByCode.get(codeKey)!.add(name)
    }

    console.log(`\n📊 Total Unique Secretariats: ${secsByName.size}`)
    console.log(`📊 Total Unique Secretariat Codes: ${secsByCode.size}\n`)

    // Check for secretariats with multiple codes
    console.log("🔍 Checking if each Secretariat has a unique Secretariat Code:\n")
    let secIssuesFound = false

    for (const [secName, codes] of secsByName.entries()) {
      if (codes.size > 1) {
        secIssuesFound = true
        console.log(`❌ ISSUE: Secretariat "${secName}" has ${codes.size} different codes:`)
        console.log(`   Codes: ${Array.from(codes).join(", ")}`)
      }
    }

    if (!secIssuesFound) {
      console.log("✅ Each Secretariat has exactly ONE unique Secretariat Code!")
    }

    // Check for codes used by multiple secretariats
    console.log("\n🔍 Checking if each Secretariat Code is used by only one Secretariat:\n")
    let secCodeIssuesFound = false

    for (const [code, names] of secsByCode.entries()) {
      if (names.size > 1) {
        secCodeIssuesFound = true
        console.log(
          `❌ ISSUE: Secretariat Code "${code}" is used by ${names.size} different secretariats:`
        )
        console.log(`   Secretariats: ${Array.from(names).join(", ")}`)
      }
    }

    if (!secCodeIssuesFound) {
      console.log("✅ Each Secretariat Code is used by exactly ONE Secretariat!")
    }

    // Display sample secretariat-code mappings (first 20)
    console.log("\n📋 Sample Secretariat → Code Mapping (First 20):\n")
    console.log("─".repeat(80))
    console.log(
      `${"Secretariat Name".padEnd(40)} | ${"Sec Code".padEnd(15)} | ${"Residents"}`
    )
    console.log("─".repeat(80))

    const sortedSecs = Array.from(secsByName.keys()).sort()
    for (const secName of sortedSecs.slice(0, 20)) {
      const codes = Array.from(secsByName.get(secName)!)
      const residents = secData
        .filter((d) => d.secName === secName)
        .reduce((sum, d) => sum + d._count.id, 0)

      console.log(
        `${secName.padEnd(40)} | ${codes.join(", ").padEnd(15)} | ${residents.toLocaleString()}`
      )
    }

    if (sortedSecs.length > 20) {
      console.log(`\n... and ${sortedSecs.length - 20} more secretariats`)
    }

    // Summary
    console.log("\n\n" + "=".repeat(80))
    console.log("📊 SUMMARY")
    console.log("=" .repeat(80))

    console.log(`\n✅ Total Mandals: ${mandalsByName.size}`)
    console.log(`✅ Total Unique Mandal Codes: ${mandalsByCode.size}`)
    console.log(
      `${mandalIssuesFound || codeIssuesFound ? "❌" : "✅"} Mandal Code Uniqueness: ${
        mandalIssuesFound || codeIssuesFound ? "ISSUES FOUND" : "PERFECT"
      }`
    )

    console.log(`\n✅ Total Secretariats: ${secsByName.size}`)
    console.log(`✅ Total Unique Secretariat Codes: ${secsByCode.size}`)
    console.log(
      `${secIssuesFound || secCodeIssuesFound ? "❌" : "✅"} Secretariat Code Uniqueness: ${
        secIssuesFound || secCodeIssuesFound ? "ISSUES FOUND" : "PERFECT"
      }`
    )

    console.log("\n" + "=".repeat(80))
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCodeUniqueness()

