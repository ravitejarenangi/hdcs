import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

// Validation schema for update requests
const updateSchema = z.object({
  mobileNumber: z
    .union([
      z.string().regex(/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"),
      z.null(),
      z.literal(""),
    ])
    .optional()
    .transform((val) => (val === "" ? null : val)),
  healthId: z
    .union([
      z.string().min(1, "Health ID cannot be empty").max(50, "Health ID too long"),
      z.null(),
      z.literal(""),
    ])
    .optional()
    .transform((val) => (val === "" ? null : val)),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id: residentId } = await params

    // Validate request body
    const validatedData = updateSchema.parse(body)

    // Get current resident data for logging
    const currentResident = await prisma.resident.findUnique({
      where: { residentId },
    })

    if (!currentResident) {
      return NextResponse.json(
        { error: "Resident not found" },
        { status: 404 }
      )
    }

    // Prepare update data (only include fields that are provided)
    const updateData: {
      updatedAt: Date
      mobileNumber?: string | null
      healthId?: string | null
    } = {
      updatedAt: new Date(),
    }

    if (validatedData.mobileNumber !== undefined) {
      updateData.mobileNumber = validatedData.mobileNumber
    }

    if (validatedData.healthId !== undefined) {
      updateData.healthId = validatedData.healthId
    }

    // Update resident
    const updatedResident = await prisma.resident.update({
      where: { residentId },
      data: updateData,
    })

    // Log changes to UpdateLog table
    const changes = []
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     "unknown"

    if (
      validatedData.mobileNumber !== undefined &&
      validatedData.mobileNumber !== currentResident.mobileNumber
    ) {
      changes.push({
        residentId,
        userId: session.user.id,
        fieldUpdated: "mobile_number",
        oldValue: currentResident.mobileNumber || "null",
        newValue: validatedData.mobileNumber || "null",
        ipAddress,
      })
    }

    if (
      validatedData.healthId !== undefined &&
      validatedData.healthId !== currentResident.healthId
    ) {
      changes.push({
        residentId,
        userId: session.user.id,
        fieldUpdated: "health_id",
        oldValue: currentResident.healthId || "null",
        newValue: validatedData.healthId || "null",
        ipAddress,
      })
    }

    // Create update logs if there are changes
    if (changes.length > 0) {
      await prisma.updateLog.createMany({
        data: changes,
      })
    }

    return NextResponse.json({
      success: true,
      resident: updatedResident,
      changesLogged: changes.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues)
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    console.error("Update error:", error)
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET method to retrieve a single resident
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id: residentId } = await params

    const resident = await prisma.resident.findUnique({
      where: { residentId },
    })

    if (!resident) {
      return NextResponse.json(
        { error: "Resident not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(resident)
  } catch (error) {
    console.error("Get resident error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

