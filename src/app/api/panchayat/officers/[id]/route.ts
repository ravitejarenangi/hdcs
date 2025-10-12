import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params

    // Parse request body
    const body = await request.json()
    const { fullName, mobileNumber, assignedSecretariats, isActive } = body

    // Validate at least one field is provided
    if (
      fullName === undefined &&
      mobileNumber === undefined &&
      assignedSecretariats === undefined &&
      isActive === undefined
    ) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Check if officer exists and is a field officer
    const officer = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, assignedSecretariats: true },
    })

    if (!officer) {
      return NextResponse.json({ error: "Officer not found" }, { status: 404 })
    }

    if (officer.role !== "FIELD_OFFICER") {
      return NextResponse.json(
        { error: "User is not a field officer" },
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

    // Validate assignedSecretariats if provided
    if (assignedSecretariats !== undefined) {
      if (!Array.isArray(assignedSecretariats) || assignedSecretariats.length === 0) {
        return NextResponse.json(
          { error: "assignedSecretariats must be a non-empty array" },
          { status: 400 }
        )
      }

      // Validate that all secretariats belong to this mandal
      const secretariatsInMandal = await prisma.resident.groupBy({
        by: ["secName"],
        where: {
          mandalName,
          secName: { in: assignedSecretariats },
        },
      })

      const validSecretariats = secretariatsInMandal
        .map((s) => s.secName)
        .filter((name): name is string => name !== null)

      const invalidSecretariats = assignedSecretariats.filter(
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
    }

    // Build update data
    const updateData: {
      fullName?: string
      mobileNumber?: string | null
      assignedSecretariats?: string
      isActive?: boolean
    } = {}

    if (fullName !== undefined) updateData.fullName = fullName
    if (isActive !== undefined) updateData.isActive = isActive
    if (mobileNumber !== undefined) {
      updateData.mobileNumber = mobileNumber === "" ? null : mobileNumber
    }
    if (assignedSecretariats !== undefined) {
      updateData.assignedSecretariats = JSON.stringify(assignedSecretariats)
    }

    // Update officer
    const updatedOfficer = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        mobileNumber: true,
        assignedSecretariats: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: "Officer updated successfully",
      officer: updatedOfficer,
    })
  } catch (error) {
    console.error("Officer update error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  try {
    const { id } = await params

    // Check if officer exists and is a field officer
    const officer = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!officer) {
      return NextResponse.json({ error: "Officer not found" }, { status: 404 })
    }

    if (officer.role !== "FIELD_OFFICER") {
      return NextResponse.json(
        { error: "User is not a field officer" },
        { status: 400 }
      )
    }

    // Soft delete (deactivate)
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      message: "Officer deactivated successfully",
    })
  } catch (error) {
    console.error("Officer deletion error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

