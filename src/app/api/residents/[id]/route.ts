import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

// Helper function to validate mobile number patterns
function isValidMobilePattern(mobile: string): boolean {
  // Check if all digits are the same (e.g., 9999999999, 8888888888)
  const allSameDigit = /^(\d)\1{9}$/.test(mobile)
  if (allSameDigit) return false

  // Check for repetitive patterns (e.g., 9999998888, 7777776666)
  // Pattern: 5+ same digits followed by 4+ same digits
  const repetitivePattern = /^(\d)\1{4,}(\d)\2{3,}$/.test(mobile)
  if (repetitivePattern) return false

  // Check for simple sequential patterns (e.g., 1234567890, 0987654321)
  const digits = mobile.split('').map(Number)
  let isAscending = true
  let isDescending = true

  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) isAscending = false
    if (digits[i] !== digits[i - 1] - 1) isDescending = false
  }

  if (isAscending || isDescending) return false

  return true
}

// Helper function to validate Health ID format
function isValidHealthIdFormat(healthId: string): boolean {
  // Remove all non-digit characters
  const digits = healthId.replace(/\D/g, '')

  // Must be exactly 14 digits
  return digits.length === 14 && /^\d{14}$/.test(digits)
}

// Validation schema for update requests
const updateSchema = z.object({
  citizenMobile: z
    .union([
      z.string()
        .regex(/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9")
        .refine(
          (val) => isValidMobilePattern(val),
          "Mobile number cannot be repetitive or sequential (e.g., 9999999999, 9999998888)"
        ),
      z.null(),
      z.literal(""),
    ])
    .optional()
    .transform((val) => (val === "" ? null : val)),
  healthId: z
    .union([
      z.string()
        .refine(
          (val) => isValidHealthIdFormat(val),
          "Health ID must be 14 digits (format: XX-XXXX-XXXX-XXXX)"
        ),
      // Health IDs are stored WITH dashes in database to match existing data
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

    // Validate citizenMobile uniqueness within secretariat (max 5 residents per mobile number)
    if (
      validatedData.citizenMobile !== undefined &&
      validatedData.citizenMobile !== null &&
      validatedData.citizenMobile !== "" &&
      validatedData.citizenMobile !== currentResident.citizenMobile // Only validate if mobile number is changing
    ) {
      // Count how many residents in the same secretariat already have this mobile number
      const duplicateCount = await prisma.resident.count({
        where: {
          citizenMobile: validatedData.citizenMobile,
          secName: currentResident.secName, // Same secretariat
          residentId: { not: residentId }, // Exclude current resident
        },
      })

      // If 5 or more residents already have this mobile number, reject the update
      if (duplicateCount >= 5) {
        return NextResponse.json(
          {
            error: "MOBILE_DUPLICATE_LIMIT_EXCEEDED",
            message: `This mobile number is already used by ${duplicateCount} residents in this secretariat. The same mobile number cannot be assigned to more than 5 residents.`,
          },
          { status: 400 }
        )
      }
    }

    // Prepare update data (only include fields that are provided)
    const updateData: {
      updatedAt: Date
      citizenMobile?: string | null
      healthId?: string | null
    } = {
      updatedAt: new Date(),
    }

    if (validatedData.citizenMobile !== undefined) {
      updateData.citizenMobile = validatedData.citizenMobile
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
      validatedData.citizenMobile !== undefined &&
      validatedData.citizenMobile !== currentResident.citizenMobile
    ) {
      changes.push({
        residentId,
        userId: session.user.id,
        fieldUpdated: "citizen_mobile",
        oldValue: currentResident.citizenMobile || "null",
        newValue: validatedData.citizenMobile || "null",
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

