import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/settings/profile - Fetch current user's profile
export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch user profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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
        lastLogin: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Get profile error:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
}

// PUT /api/settings/profile - Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { fullName, mobileNumber } = body

    // Validate required fields
    if (!fullName || fullName.trim() === "") {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      )
    }

    // Validate mobile number format if provided
    if (mobileNumber) {
      const mobileRegex = /^[6-9][0-9]{9}$/
      if (!mobileRegex.test(mobileNumber)) {
        return NextResponse.json(
          { error: "Invalid mobile number format. Must be 10 digits starting with 6-9" },
          { status: 400 }
        )
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber || null,
        updatedAt: new Date(),
      },
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
        lastLogin: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Update profile error:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}

