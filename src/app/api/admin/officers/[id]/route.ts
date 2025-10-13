import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// PUT /api/admin/officers/[id] - Update user (any role)
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Get officer ID from params
    const { id } = await params

    // Parse request body
    const body = await request.json()
    const { fullName, isActive, mobileNumber, mandalName, assignedSecretariats } = body

    // Validate at least one field is provided
    if (
      fullName === undefined &&
      isActive === undefined &&
      mobileNumber === undefined &&
      mandalName === undefined &&
      assignedSecretariats === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      )
    }

    // Validate full name if provided
    if (fullName !== undefined && fullName.length < 3) {
      return NextResponse.json(
        { error: "Full name must be at least 3 characters long" },
        { status: 400 }
      )
    }

    // Validate mobile number if provided
    if (mobileNumber !== undefined && mobileNumber !== null && mobileNumber !== "") {
      if (!/^[0-9]{10}$/.test(mobileNumber)) {
        return NextResponse.json(
          { error: "Mobile number must be exactly 10 digits" },
          { status: 400 }
        )
      }
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Role-specific validation
    if (mandalName !== undefined) {
      if (existingUser.role !== "PANCHAYAT_SECRETARY") {
        return NextResponse.json(
          { error: "Only Panchayat Secretary users can have mandal assigned" },
          { status: 400 }
        )
      }

      if (mandalName) {
        // Verify mandal exists
        const mandalExists = await prisma.resident.findFirst({
          where: { mandalName },
        })

        if (!mandalExists) {
          return NextResponse.json(
            { error: `Mandal "${mandalName}" does not exist in the system` },
            { status: 400 }
          )
        }
      }
    }

    if (assignedSecretariats !== undefined) {
      if (existingUser.role !== "FIELD_OFFICER") {
        return NextResponse.json(
          { error: "Only Field Officer users can have secretariats assigned" },
          { status: 400 }
        )
      }

      if (assignedSecretariats && Array.isArray(assignedSecretariats)) {
        if (assignedSecretariats.length === 0) {
          return NextResponse.json(
            { error: "At least one secretariat must be assigned to Field Officer" },
            { status: 400 }
          )
        }

        // Verify all secretariats exist
        // Handle both old format (string[]) and new format (object[])
        const secretariatChecks = await Promise.all(
          assignedSecretariats.map((sec: string | { secName: string }) => {
            const secName = typeof sec === 'string' ? sec : sec.secName
            return prisma.resident.findFirst({
              where: { secName },
            })
          })
        )

        const invalidSecretariats = assignedSecretariats.filter(
          (_: unknown, index: number) => !secretariatChecks[index]
        ).map((sec: string | { secName: string }) => typeof sec === 'string' ? sec : sec.secName)

        if (invalidSecretariats.length > 0) {
          return NextResponse.json(
            { error: `The following secretariats do not exist: ${invalidSecretariats.join(", ")}` },
            { status: 400 }
          )
        }
      }
    }

    // Build update data
    const updateData: {
      fullName?: string
      isActive?: boolean
      mobileNumber?: string | null
      mandalName?: string | null
      assignedSecretariats?: string | null
    } = {}

    if (fullName !== undefined) updateData.fullName = fullName
    if (isActive !== undefined) updateData.isActive = isActive
    if (mobileNumber !== undefined) {
      updateData.mobileNumber = mobileNumber === "" ? null : mobileNumber
    }
    if (mandalName !== undefined) {
      updateData.mandalName = mandalName || null
    }
    if (assignedSecretariats !== undefined) {
      updateData.assignedSecretariats = assignedSecretariats
        ? JSON.stringify(assignedSecretariats)
        : null
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/officers/[id] - Deactivate user (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Get user ID from params
    const { id } = await params

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Prevent deleting yourself
    if (existingUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      )
    }

    // Soft delete: Set isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      message: "User deactivated successfully",
    })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "Failed to deactivate user" },
      { status: 500 }
    )
  }
}

