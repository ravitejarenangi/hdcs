import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const settingsSchema = z.object({
    cutoffDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
})

export async function GET(request: NextRequest) {
    const session = await auth()

    // Only ADMIN can access settings
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const setting = await prisma.systemSettings.findUnique({
            where: { key: "RESIDENT_UPDATE_CUTOFF_DATE" },
        })

        return NextResponse.json({
            cutoffDate: setting?.value || null,
            updatedAt: setting?.updatedAt || null,
        })
    } catch (error) {
        console.error("Error fetching settings:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const session = await auth()

    // Only ADMIN can update settings
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { cutoffDate } = settingsSchema.parse(body)

        let setting;
        if (cutoffDate === null) {
            // If null, delete the setting to disable locking
            try {
                await prisma.systemSettings.delete({
                    where: { key: "RESIDENT_UPDATE_CUTOFF_DATE" },
                })
            } catch (e) {
                // Ignore if not found
            }
            return NextResponse.json({
                success: true,
                cutoffDate: null,
                updatedAt: new Date(),
            })
        } else {
            setting = await prisma.systemSettings.upsert({
                where: { key: "RESIDENT_UPDATE_CUTOFF_DATE" },
                update: {
                    value: cutoffDate,
                    description: "Residents last updated before this date (and complete) are locked.",
                },
                create: {
                    key: "RESIDENT_UPDATE_CUTOFF_DATE",
                    value: cutoffDate,
                    description: "Residents last updated before this date (and complete) are locked.",
                },
            })
        }

        return NextResponse.json({
            success: true,
            cutoffDate: setting?.value ?? null,
            updatedAt: setting?.updatedAt ?? new Date(),
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 })
        }
        console.error("Error updating settings:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
