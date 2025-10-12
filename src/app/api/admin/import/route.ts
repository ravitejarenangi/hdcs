import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"

interface ImportResult {
  totalRecords: number
  successRecords: number
  failedRecords: number
  duplicateRecords: number
  errors: Array<{ row: number; error: string; data?: unknown }>
}

interface ResidentData {
  residentId: string
  uid?: string
  hhId: string
  name: string
  dob?: Date
  gender?: "MALE" | "FEMALE" | "OTHER"
  mobileNumber?: string
  healthId?: string
  distName?: string
  mandalName?: string
  mandalCode?: number
  secName?: string
  secCode?: number
  ruralUrban?: string
  clusterName?: string
  qualification?: string
  occupation?: string
  caste?: string
  subCaste?: string
  casteCategory?: string
  hofMember?: string
  doorNumber?: string
  addressEkyc?: string
  addressHh?: string
  citizenMobile?: string
  age?: number
  phcName?: string
}

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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File
    const importMode = (formData.get("importMode") as string) || "add_update"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const fileName = file.name
    const fileExtension = fileName.split(".").pop()?.toLowerCase()

    if (!["csv", "xlsx", "xls"].includes(fileExtension || "")) {
      return NextResponse.json(
        { error: "Invalid file type. Only CSV and Excel files are supported." },
        { status: 400 }
      )
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let data: unknown[][] = []

    // Parse file based on type
    if (fileExtension === "csv") {
      const csvText = buffer.toString("utf-8")
      const rows = csvText.split("\n").map((row) => row.split(","))
      data = rows
    } else {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: "buffer" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    }

    if (data.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 })
    }

    // Extract headers and rows
    const headers = data[0] as string[]
    const rows = data.slice(1)

    // Map headers to database fields (case-insensitive)
    const headerMap = new Map<string, number>()
    headers.forEach((header, index) => {
      const normalizedHeader = header.toString().toLowerCase().trim()
      headerMap.set(normalizedHeader, index)
    })

    // Helper function to get value from row
    const getValue = (row: unknown[], fieldName: string): string | undefined => {
      const index = headerMap.get(fieldName.toLowerCase())
      if (index === undefined) return undefined
      const value = row[index]
      return value !== null && value !== undefined ? String(value).trim() : undefined
    }

    // Process rows
    const result: ImportResult = {
      totalRecords: rows.length,
      successRecords: 0,
      failedRecords: 0,
      duplicateRecords: 0,
      errors: [],
    }

    const recordsToProcess: ResidentData[] = []

    // Validate and prepare records
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const rowNumber = i + 2 // +2 because of header row and 0-based index

      try {
        // Skip empty rows
        if (row.every((cell) => !cell || String(cell).trim() === "")) {
          continue
        }

        // Extract required fields
        const residentId = getValue(row, "resident_id") || getValue(row, "residentid")
        const hhId = getValue(row, "hh_id") || getValue(row, "hhid") || getValue(row, "household_id")
        const name = getValue(row, "name")

        // Validate required fields
        if (!residentId) {
          result.errors.push({
            row: rowNumber,
            error: "Missing required field: resident_id",
            data: row,
          })
          result.failedRecords++
          continue
        }

        if (!hhId) {
          result.errors.push({
            row: rowNumber,
            error: "Missing required field: hh_id",
            data: row,
          })
          result.failedRecords++
          continue
        }

        if (!name) {
          result.errors.push({
            row: rowNumber,
            error: "Missing required field: name",
            data: row,
          })
          result.failedRecords++
          continue
        }

        // Parse optional fields
        const dobStr = getValue(row, "dob") || getValue(row, "date_of_birth")
        const dob = dobStr ? new Date(dobStr) : undefined

        const ageStr = getValue(row, "age")
        const age = ageStr ? parseInt(ageStr, 10) : undefined

        const genderStr = getValue(row, "gender")
        let gender: "MALE" | "FEMALE" | "OTHER" | undefined
        if (genderStr) {
          const genderUpper = genderStr.toUpperCase()
          if (["MALE", "FEMALE", "OTHER"].includes(genderUpper)) {
            gender = genderUpper as "MALE" | "FEMALE" | "OTHER"
          }
        }

        // Helper function to parse code values (convert to integer, handle .0 suffix)
        const parseCode = (value: string | undefined): number | undefined => {
          if (!value) return undefined
          const cleaned = value.replace(".0", "").trim()
          const parsed = parseInt(cleaned, 10)
          return isNaN(parsed) ? undefined : parsed
        }

        const record: ResidentData = {
          residentId,
          uid: getValue(row, "uid"),
          hhId,
          name,
          dob,
          gender,
          mobileNumber: getValue(row, "mobile_number") || getValue(row, "mobile"),
          healthId: getValue(row, "health_id") || getValue(row, "healthid"),
          distName: getValue(row, "dist_name") || getValue(row, "district"),
          mandalName: getValue(row, "mandal_name") || getValue(row, "mandal"),
          mandalCode: parseCode(getValue(row, "mandal_code")),
          secName: getValue(row, "sec_name") || getValue(row, "secretariat"),
          secCode: parseCode(getValue(row, "sec_code")),
          ruralUrban: getValue(row, "rural_urban") || getValue(row, "area_type"),
          clusterName: getValue(row, "cluster_name") || getValue(row, "cluster"),
          qualification: getValue(row, "qualification"),
          occupation: getValue(row, "occupation"),
          caste: getValue(row, "caste"),
          subCaste: getValue(row, "sub_caste") || getValue(row, "subcaste"),
          casteCategory: getValue(row, "caste_category"),
          hofMember: getValue(row, "hof_member") || getValue(row, "head_of_family"),
          doorNumber: getValue(row, "door_number"),
          addressEkyc: getValue(row, "address_ekyc") || getValue(row, "address"),
          addressHh: getValue(row, "address_hh"),
          citizenMobile: getValue(row, "citizen_mobile"),
          age,
          phcName: getValue(row, "phc_name") || getValue(row, "phc"),
        }

        recordsToProcess.push(record)
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : "Unknown error",
          data: row,
        })
        result.failedRecords++
      }
    }

    // Process records based on import mode
    for (const record of recordsToProcess) {
      try {
        if (importMode === "add") {
          // Add new only - skip if exists
          const existing = await prisma.resident.findUnique({
            where: { residentId: record.residentId },
          })

          if (existing) {
            result.duplicateRecords++
            continue
          }

          await prisma.resident.create({ data: record })
          result.successRecords++
        } else if (importMode === "update") {
          // Update existing only - skip if not exists
          const existing = await prisma.resident.findUnique({
            where: { residentId: record.residentId },
          })

          if (!existing) {
            result.failedRecords++
            result.errors.push({
              row: 0,
              error: `Resident ${record.residentId} not found for update`,
            })
            continue
          }

          await prisma.resident.update({
            where: { residentId: record.residentId },
            data: record,
          })
          result.successRecords++
        } else {
          // add_update - upsert
          await prisma.resident.upsert({
            where: { residentId: record.residentId },
            create: record,
            update: record,
          })
          result.successRecords++
        }
      } catch (error) {
        result.failedRecords++
        result.errors.push({
          row: 0,
          error: error instanceof Error ? error.message : "Database error",
          data: record,
        })
      }
    }

    // Log import
    const status =
      result.failedRecords === 0
        ? "success"
        : result.successRecords > 0
        ? "partial"
        : "failed"

    await prisma.importLog.create({
      data: {
        userId: session.user.id,
        fileName,
        fileSize: file.size,
        totalRecords: result.totalRecords,
        successRecords: result.successRecords,
        failedRecords: result.failedRecords,
        duplicateRecords: result.duplicateRecords,
        importMode,
        status,
        errorLog: result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 100)) : null,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import data" },
      { status: 500 }
    )
  }
}

