import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

// GET /api/admin/officers - Fetch all officers (all roles)
export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Fetch all users (all roles)
    const officers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        mobileNumber: true,
        role: true,
        mandalName: true,
        assignedSecretariats: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Get update counts for each officer
    const officerIds = officers.map((officer) => officer.id)
    const updateCounts = await prisma.updateLog.groupBy({
      by: ["userId"],
      where: { userId: { in: officerIds } },
      _count: { id: true },
    })

    const updateCountMap = new Map(
      updateCounts.map((item) => [item.userId, item._count.id])
    )

    // Combine data
    const officersWithStats = officers.map((officer) => ({
      id: officer.id,
      username: officer.username,
      fullName: officer.fullName,
      mobileNumber: officer.mobileNumber,
      role: officer.role,
      mandalName: officer.mandalName,
      assignedSecretariats: officer.assignedSecretariats,
      isActive: officer.isActive,
      lastLogin: officer.lastLogin,
      createdAt: officer.createdAt,
      updatedAt: officer.updatedAt,
      updateCount: updateCountMap.get(officer.id) || 0,
    }))

    return NextResponse.json(officersWithStats)
  } catch (error) {
    console.error("Fetch officers error:", error)
    return NextResponse.json(
      { error: "Failed to fetch officers" },
      { status: 500 }
    )
  }
}

// POST /api/admin/officers - Create new user (any role)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { username, password, fullName, mobileNumber, role, mandalName, assignedSecretariats } = body

    // Validate required fields
    if (!username || !password || !fullName || !role) {
      return NextResponse.json(
        { error: "Missing required fields: username, password, fullName, role" },
        { status: 400 }
      )
    }

    // Validate role
    if (!["ADMIN", "PANCHAYAT_SECRETARY", "FIELD_OFFICER"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be ADMIN, PANCHAYAT_SECRETARY, or FIELD_OFFICER" },
        { status: 400 }
      )
    }

    // Validate username format
    if (username.length < 4) {
      return NextResponse.json(
        { error: "Username must be at least 4 characters long" },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username must contain only letters, numbers, and underscores" },
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

    // Role-specific validation
    if (role === "PANCHAYAT_SECRETARY") {
      // Mandal is required for PANCHAYAT_SECRETARY
      if (!mandalName) {
        return NextResponse.json(
          { error: "Mandal name is required for Panchayat Secretary" },
          { status: 400 }
        )
      }

      // Verify mandal exists in residents table
      const mandalExists = await prisma.resident.findFirst({
        where: { mandalName },
      })

      if (!mandalExists) {
        return NextResponse.json(
          { error: `Mandal "${mandalName}" does not exist in the system` },
          { status: 400 }
        )
      }
    } else if (role === "FIELD_OFFICER") {
      // Assigned secretariats are required for FIELD_OFFICER
      if (!assignedSecretariats || !Array.isArray(assignedSecretariats) || assignedSecretariats.length === 0) {
        return NextResponse.json(
          { error: "At least one secretariat must be assigned to Field Officer" },
          { status: 400 }
        )
      }

      // Verify all secretariats exist in residents table
      // Handle both old format (string[]) and new format (object[])
      const secretariatChecks = await Promise.all(
        assignedSecretariats.map((sec: any) => {
          const secName = typeof sec === 'string' ? sec : sec.secName
          return prisma.resident.findFirst({
            where: { secName },
          })
        })
      )

      const invalidSecretariats = assignedSecretariats.filter(
        (_: any, index: number) => !secretariatChecks[index]
      ).map((sec: any) => typeof sec === 'string' ? sec : sec.secName)

      if (invalidSecretariats.length > 0) {
        return NextResponse.json(
          { error: `The following secretariats do not exist: ${invalidSecretariats.join(", ")}` },
          { status: 400 }
        )
      }
    } else if (role === "ADMIN") {
      // ADMIN should not have mandal or secretariats
      if (mandalName || assignedSecretariats) {
        return NextResponse.json(
          { error: "Admin users should not have mandal or secretariats assigned" },
          { status: 400 }
        )
      }
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Prepare data for creation
    const userData: {
      username: string
      passwordHash: string
      fullName: string
      mobileNumber: string | null
      role: "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER"
      mandalName?: string | null
      assignedSecretariats?: string | null
      isActive: boolean
    } = {
      username,
      passwordHash,
      fullName,
      mobileNumber: mobileNumber || null,
      role: role as "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER",
      isActive: true,
    }

    // Add role-specific fields
    if (role === "PANCHAYAT_SECRETARY") {
      userData.mandalName = mandalName
      userData.assignedSecretariats = null
    } else if (role === "FIELD_OFFICER") {
      userData.mandalName = null
      userData.assignedSecretariats = JSON.stringify(assignedSecretariats)
    } else {
      userData.mandalName = null
      userData.assignedSecretariats = null
    }

    // Create user
    const officer = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        username: true,
        fullName: true,
        mobileNumber: true,
        role: true,
        mandalName: true,
        assignedSecretariats: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(officer, { status: 201 })
  } catch (error) {
    console.error("Create officer error:", error)
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    )
  }
}

