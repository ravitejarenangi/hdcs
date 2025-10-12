import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// Generate random password
function generateRandomPassword(): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const lowercase = "abcdefghijklmnopqrstuvwxyz"
  const numbers = "0123456789"
  const special = "!@#$%^&*"
  const all = uppercase + lowercase + numbers + special

  let password = ""
  
  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]

  // Fill remaining characters (total length 12)
  for (let i = 4; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)]
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("")
}

// POST /api/admin/officers/[id]/reset-password - Reset officer password
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const { newPassword, generateRandom } = body

    let passwordToSet: string

    if (generateRandom) {
      // Generate random password
      passwordToSet = generateRandomPassword()
    } else if (newPassword) {
      // Use provided password
      passwordToSet = newPassword

      // Validate password strength
      if (passwordToSet.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters long" },
          { status: 400 }
        )
      }

      if (!/[A-Z]/.test(passwordToSet)) {
        return NextResponse.json(
          { error: "Password must contain at least one uppercase letter" },
          { status: 400 }
        )
      }

      if (!/[0-9]/.test(passwordToSet)) {
        return NextResponse.json(
          { error: "Password must contain at least one number" },
          { status: 400 }
        )
      }

      if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordToSet)) {
        return NextResponse.json(
          { error: "Password must contain at least one special character" },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Either newPassword or generateRandom must be provided" },
        { status: 400 }
      )
    }

    // Check if officer exists and is a field officer
    const existingOfficer = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingOfficer) {
      return NextResponse.json(
        { error: "Field officer not found" },
        { status: 404 }
      )
    }

    if (existingOfficer.role !== "FIELD_OFFICER") {
      return NextResponse.json(
        { error: "User is not a field officer" },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(passwordToSet, 10)

    // Update password
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    })

    return NextResponse.json({
      message: "Password reset successfully",
      newPassword: passwordToSet,
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    )
  }
}

