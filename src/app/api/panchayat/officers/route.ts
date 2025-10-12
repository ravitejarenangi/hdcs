import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET(_request: NextRequest) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is PANCHAYAT_SECRETARY
  if (session.user.role !== "PANCHAYAT_SECRETARY") {
    return NextResponse.json(
      { error: "Forbidden - Panchayat Secretary access required" },
      { status: 403 }
    )
  }

  // Get mandal from session
  const mandalName = session.user.mandalName

  if (!mandalName) {
    return NextResponse.json(
      { error: "Mandal not assigned to user" },
      { status: 400 }
    )
  }

  try {
    // Get all secretariats in this mandal
    const secretariatsInMandal = await prisma.resident.groupBy({
      by: ["secName"],
      where: {
        mandalName,
        secName: { not: null },
      },
    })

    const secretariatNames = secretariatsInMandal
      .map((s) => s.secName)
      .filter((name): name is string => name !== null)

    // Fetch all field officers
    const allOfficers = await prisma.user.findMany({
      where: { role: "FIELD_OFFICER" },
      select: {
        id: true,
        username: true,
        fullName: true,
        mobileNumber: true,
        assignedSecretariats: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Filter officers who have at least one secretariat in this mandal
    const mandalOfficers = allOfficers.filter((officer) => {
      if (!officer.assignedSecretariats) return false
      try {
        const assignedSecs = JSON.parse(officer.assignedSecretariats)

        // Handle multiple formats
        if (Array.isArray(assignedSecs) && assignedSecs.length > 0) {
          if (typeof assignedSecs[0] === "string") {
            // Check if it's the "MANDAL -> SECRETARIAT" format
            if (assignedSecs[0].includes(" -> ")) {
              // Format: ["MANDAL -> SECRETARIAT"]
              return assignedSecs.some((sec: string) => {
                const [secMandal, secName] = sec.split(" -> ")
                return secMandal === mandalName && secretariatNames.includes(secName)
              })
            } else {
              // Old format: ["Secretariat1", "Secretariat2"]
              return assignedSecs.some((sec: string) => secretariatNames.includes(sec))
            }
          } else {
            // Object format: [{ mandalName: "...", secName: "..." }]
            return assignedSecs.some((sec: { mandalName: string; secName: string }) =>
              sec.mandalName === mandalName && secretariatNames.includes(sec.secName)
            )
          }
        }
        return false
      } catch {
        return false
      }
    })

    // Get update counts for these officers
    const officerIds = mandalOfficers.map((o) => o.id)

    if (officerIds.length === 0) {
      return NextResponse.json({
        officers: [],
        total: 0,
      })
    }

    const updateCounts = await prisma.updateLog.groupBy({
      by: ["userId"],
      where: {
        userId: { in: officerIds },
      },
      _count: { id: true },
    })

    const updateCountMap = new Map(
      updateCounts.map((uc) => [uc.userId, uc._count.id])
    )

    // Combine data
    const officersWithStats = mandalOfficers.map((officer) => ({
      id: officer.id,
      username: officer.username,
      fullName: officer.fullName,
      mobileNumber: officer.mobileNumber,
      assignedSecretariats: officer.assignedSecretariats,
      isActive: officer.isActive,
      lastLogin: officer.lastLogin,
      createdAt: officer.createdAt,
      updatedAt: officer.updatedAt,
      updateCount: updateCountMap.get(officer.id) || 0,
    }))

    return NextResponse.json({
      officers: officersWithStats,
      total: officersWithStats.length,
    })
  } catch (error) {
    console.error("Officers fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is PANCHAYAT_SECRETARY
  if (session.user.role !== "PANCHAYAT_SECRETARY") {
    return NextResponse.json(
      { error: "Forbidden - Panchayat Secretary access required" },
      { status: 403 }
    )
  }

  // Get mandal from session
  const mandalName = session.user.mandalName

  if (!mandalName) {
    return NextResponse.json(
      { error: "Mandal not assigned to user" },
      { status: 400 }
    )
  }

  try {
    // Parse request body
    const body = await request.json()
    const { username, password, fullName, mobileNumber, assignedSecretariats } = body

    // Validate required fields
    if (!username || !password || !fullName || !assignedSecretariats) {
      return NextResponse.json(
        { error: "Missing required fields: username, password, fullName, assignedSecretariats" },
        { status: 400 }
      )
    }

    // Validate assignedSecretariats is an array
    if (!Array.isArray(assignedSecretariats) || assignedSecretariats.length === 0) {
      return NextResponse.json(
        { error: "assignedSecretariats must be a non-empty array" },
        { status: 400 }
      )
    }

    // Validate username
    if (username.length < 4) {
      return NextResponse.json(
        { error: "Username must be at least 4 characters long" },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores" },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      )
    }

    // Validate full name
    if (fullName.length < 3) {
      return NextResponse.json(
        { error: "Full name must be at least 3 characters long" },
        { status: 400 }
      )
    }

    // Validate mobile number (optional, but must be 10 digits if provided)
    if (mobileNumber) {
      if (!/^[0-9]{10}$/.test(mobileNumber)) {
        return NextResponse.json(
          { error: "Mobile number must be exactly 10 digits" },
          { status: 400 }
        )
      }
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one uppercase letter" },
        { status: 400 }
      )
    }

    if (!/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one number" },
        { status: 400 }
      )
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one special character" },
        { status: 400 }
      )
    }

    // Convert string array to object array if needed (backward compatibility)
    let secretariatObjects: Array<{ mandalName: string; secName: string }>

    if (typeof assignedSecretariats[0] === "string") {
      // Old format: ["Secretariat1", "Secretariat2"]
      // Convert to new format: [{ mandalName: "...", secName: "..." }]
      secretariatObjects = assignedSecretariats.map((secName: string) => ({
        mandalName,
        secName,
      }))
    } else {
      // New format: already objects
      secretariatObjects = assignedSecretariats
    }

    // Validate that all secretariats belong to this mandal
    const secretariatNames = secretariatObjects.map((s) => s.secName)

    const secretariatsInMandal = await prisma.resident.groupBy({
      by: ["secName"],
      where: {
        mandalName,
        secName: { in: secretariatNames },
      },
    })

    const validSecretariats = secretariatsInMandal
      .map((s) => s.secName)
      .filter((name): name is string => name !== null)

    const invalidSecretariats = secretariatNames.filter(
      (sec: string) => !validSecretariats.includes(sec)
    )

    if (invalidSecretariats.length > 0) {
      return NextResponse.json(
        {
          error: `The following secretariats do not belong to ${mandalName} mandal: ${invalidSecretariats.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create field officer with correct secretariat format
    const officer = await prisma.user.create({
      data: {
        username,
        passwordHash,
        fullName,
        mobileNumber: mobileNumber || null,
        assignedSecretariats: JSON.stringify(secretariatObjects),
        role: "FIELD_OFFICER",
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        mobileNumber: true,
        assignedSecretariats: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: "Field officer created successfully",
      officer,
    })
  } catch (error) {
    console.error("Officer creation error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

