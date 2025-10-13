#!/usr/bin/env tsx

/**
 * CLI Script for Importing Resident Data from CSV/Excel Files
 * 
 * Usage:
 *   npm run import:residents -- --health health-data.csv --demographic demographic-data.csv --mode add_update
 *   npm run import:residents -- --merged merged-data.csv --mode add
 * 
 * Options:
 *   --health <file>        Path to health data CSV/Excel file
 *   --demographic <file>   Path to demographic data CSV/Excel file
 *   --merged <file>        Path to pre-merged CSV/Excel file
 *   --mode <mode>          Import mode: add, update, or add_update (default: add_update)
 *   --dry-run              Validate data without importing
 *   --batch-size <size>    Number of records to import per batch (default: 100)
 *   --help                 Show help
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import { parse as parseStream } from 'csv-parse'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

interface HealthDataRow {
  resident_id: string
  health_id?: string
  citizen_name?: string
  citizen_mobile?: string
  gender?: string
  subcaste?: string
  caste_category?: string
  age?: string
  door_no?: string
  phc_name?: string
  sec_name?: string
  mandal_name?: string
  district_name?: string
}

interface DemographicDataRow {
  'Dist Name'?: string
  'Mandal Name'?: string
  'Mandal Code'?: string
  'Sec name'?: string
  'Sec Code'?: string
  'R/U'?: string
  'HH ID'?: string
  'resident ID': string
  'UID'?: string
  'Cluster name'?: string
  'Name of citizen'?: string
  'DOB'?: string
  'Gender'?: string
  'Qualification'?: string
  'Occupation'?: string
  'Caste'?: string
  'Sub caste'?: string
  'caste cat'?: string
  'Mobile Number'?: string
  'HOF/Member'?: string
  'Door Number'?: string
  'Address as per ekyc'?: string
  'Address as per HH data'?: string
}

interface MergedResidentData {
  residentId: string
  hhId: string
  name: string
  uid?: string
  dob?: Date
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  mobileNumber?: string
  healthId?: string
  distName?: string
  mandalName?: string
  mandalCode?: string
  secName?: string
  secCode?: string
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

interface ImportStats {
  total: number
  success: number
  failed: number
  duplicates: number
  errors: string[]
}

// Utility Functions
function normalizeGender(gender?: string): 'MALE' | 'FEMALE' | 'OTHER' | undefined {
  if (!gender) return undefined
  const normalized = gender.trim().toUpperCase()
  if (['MALE', 'M'].includes(normalized)) return 'MALE'
  if (['FEMALE', 'F'].includes(normalized)) return 'FEMALE'
  return 'OTHER'
}

function parseDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined
  
  // Try multiple date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      if (format === formats[0]) {
        // YYYY-MM-DD
        return new Date(`${match[1]}-${match[2]}-${match[3]}`)
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        return new Date(`${match[3]}-${match[2]}-${match[1]}`)
      }
    }
  }
  
  // Try native Date parsing as fallback
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? undefined : date
}

function validateUID(uid?: string): string | undefined {
  if (!uid) return undefined
  const cleaned = uid.trim()
  if (!/^\d{12}$/.test(cleaned)) {
    console.warn(`Invalid UID format: ${uid} (must be 12 digits)`)
    return undefined
  }
  return cleaned
}

function parseInteger(value?: string): number | undefined {
  if (!value) return undefined
  const num = parseInt(value.trim(), 10)
  return isNaN(num) ? undefined : num
}

function readFile(filePath: string): any[] {
  const ext = path.extname(filePath).toLowerCase()
  const fullPath = path.resolve(filePath)

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`)
  }

  if (ext === '.csv') {
    const content = fs.readFileSync(fullPath, 'utf-8')
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  } else if (['.xlsx', '.xls'].includes(ext)) {
    const workbook = XLSX.readFile(fullPath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json(worksheet)
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .csv, .xlsx, or .xls`)
  }
}

async function readFileStreaming(filePath: string): Promise<any[]> {
  const ext = path.extname(filePath).toLowerCase()
  const fullPath = path.resolve(filePath)

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`)
  }

  if (ext === '.csv') {
    // Use streaming for large CSV files
    return new Promise((resolve, reject) => {
      const records: any[] = []
      const parser = parseStream({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })

      fs.createReadStream(fullPath)
        .pipe(parser)
        .on('data', (record) => {
          records.push(record)
        })
        .on('end', () => {
          resolve(records)
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  } else if (['.xlsx', '.xls'].includes(ext)) {
    const workbook = XLSX.readFile(fullPath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json(worksheet)
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .csv, .xlsx, or .xls`)
  }
}

function mergeHealthData(healthRow: HealthDataRow): Partial<MergedResidentData> {
  return {
    residentId: healthRow.resident_id,
    healthId: healthRow.health_id || undefined,
    citizenMobile: healthRow.citizen_mobile || undefined,
    age: parseInteger(healthRow.age),
    phcName: healthRow.phc_name || undefined,
    // Note: Overlapping fields from health data are used as fallback only
    name: healthRow.citizen_name || undefined,
    gender: normalizeGender(healthRow.gender),
    subCaste: healthRow.subcaste || undefined,
    casteCategory: healthRow.caste_category || undefined,
    doorNumber: healthRow.door_no || undefined,
    secName: healthRow.sec_name || undefined,
    mandalName: healthRow.mandal_name || undefined,
    distName: healthRow.district_name || undefined,
  }
}

function mergeDemographicData(demoRow: DemographicDataRow): Partial<MergedResidentData> {
  return {
    residentId: demoRow['resident ID'],
    hhId: demoRow['HH ID'] || '',
    name: demoRow['Name of citizen'] || '',
    uid: validateUID(demoRow['UID']),
    dob: parseDate(demoRow['DOB']),
    gender: normalizeGender(demoRow['Gender']),
    mobileNumber: demoRow['Mobile Number'] || undefined,
    distName: demoRow['Dist Name'] || undefined,
    mandalName: demoRow['Mandal Name'] || undefined,
    mandalCode: demoRow['Mandal Code'] || undefined,
    secName: demoRow['Sec name'] || undefined,
    secCode: demoRow['Sec Code'] || undefined,
    ruralUrban: demoRow['R/U'] || undefined,
    clusterName: demoRow['Cluster name'] || undefined,
    qualification: demoRow['Qualification'] || undefined,
    occupation: demoRow['Occupation'] || undefined,
    caste: demoRow['Caste'] || undefined,
    subCaste: demoRow['Sub caste'] || undefined,
    casteCategory: demoRow['caste cat'] || undefined,
    hofMember: demoRow['HOF/Member'] || undefined,
    doorNumber: demoRow['Door Number'] || undefined,
    addressEkyc: demoRow['Address as per ekyc'] || undefined,
    addressHh: demoRow['Address as per HH data'] || undefined,
  }
}

function mergeRecords(
  healthData: Map<string, Partial<MergedResidentData>>,
  demoData: Map<string, Partial<MergedResidentData>>
): MergedResidentData[] {
  const merged: MergedResidentData[] = []
  const allResidentIds = new Set([...healthData.keys(), ...demoData.keys()])
  
  for (const residentId of allResidentIds) {
    const health = healthData.get(residentId) || {}
    const demo = demoData.get(residentId) || {}
    
    // Demographic data takes priority for overlapping fields
    const mergedRecord: MergedResidentData = {
      residentId,
      hhId: demo.hhId || health.hhId || '',
      name: demo.name || health.name || '',
      uid: demo.uid || health.uid,
      dob: demo.dob || health.dob,
      gender: demo.gender || health.gender,
      mobileNumber: demo.mobileNumber || health.mobileNumber,
      healthId: health.healthId || demo.healthId,
      distName: demo.distName || health.distName,
      mandalName: demo.mandalName || health.mandalName,
      mandalCode: demo.mandalCode || health.mandalCode,
      secName: demo.secName || health.secName,
      secCode: demo.secCode || health.secCode,
      ruralUrban: demo.ruralUrban || health.ruralUrban,
      clusterName: demo.clusterName || health.clusterName,
      qualification: demo.qualification || health.qualification,
      occupation: demo.occupation || health.occupation,
      caste: demo.caste || health.caste,
      subCaste: demo.subCaste || health.subCaste,
      casteCategory: demo.casteCategory || health.casteCategory,
      hofMember: demo.hofMember || health.hofMember,
      doorNumber: demo.doorNumber || health.doorNumber,
      addressEkyc: demo.addressEkyc || health.addressEkyc,
      addressHh: demo.addressHh || health.addressHh,
      citizenMobile: health.citizenMobile || demo.citizenMobile,
      age: health.age || demo.age,
      phcName: health.phcName || demo.phcName,
    }
    
    merged.push(mergedRecord)
  }
  
  return merged
}

function validateRecord(record: MergedResidentData): string[] {
  const errors: string[] = []

  if (!record.residentId) {
    errors.push('Missing required field: residentId')
  }

  if (!record.hhId) {
    errors.push('Missing required field: hhId')
  }

  if (!record.name) {
    errors.push('Missing required field: name')
  }

  if (record.uid && !/^\d{12}$/.test(record.uid)) {
    errors.push(`Invalid UID format: ${record.uid}`)
  }

  if (record.mobileNumber && !/^[6-9]\d{9}$/.test(record.mobileNumber)) {
    errors.push(`Invalid mobile number format: ${record.mobileNumber}`)
  }

  if (record.citizenMobile && !/^[6-9]\d{9}$/.test(record.citizenMobile)) {
    errors.push(`Invalid citizen mobile format: ${record.citizenMobile}`)
  }

  return errors
}

async function importRecords(
  records: MergedResidentData[],
  mode: 'add' | 'update' | 'add_update',
  batchSize: number,
  dryRun: boolean
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: records.length,
    success: 0,
    failed: 0,
    duplicates: 0,
    errors: [],
  }

  console.log(`\n📊 Import Statistics:`)
  console.log(`   Total records: ${stats.total}`)
  console.log(`   Import mode: ${mode}`)
  console.log(`   Batch size: ${batchSize}`)
  console.log(`   Dry run: ${dryRun ? 'Yes' : 'No'}`)
  console.log(`\n`)

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(records.length / batchSize)

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`)

    for (const record of batch) {
      try {
        // Validate record
        const validationErrors = validateRecord(record)
        if (validationErrors.length > 0) {
          stats.failed++
          stats.errors.push(`Record ${record.residentId}: ${validationErrors.join(', ')}`)
          console.error(`  ❌ ${record.residentId}: ${validationErrors.join(', ')}`)
          continue
        }

        if (dryRun) {
          console.log(`  ✓ ${record.residentId}: Valid (dry run)`)
          stats.success++
          continue
        }

        // Check if record exists
        const existing = await prisma.resident.findUnique({
          where: { residentId: record.residentId },
        })

        if (existing) {
          if (mode === 'add') {
            stats.duplicates++
            console.log(`  ⚠️  ${record.residentId}: Already exists (skipped in 'add' mode)`)
            continue
          } else if (mode === 'update' || mode === 'add_update') {
            // Update existing record
            await prisma.resident.update({
              where: { residentId: record.residentId },
              data: {
                hhId: record.hhId,
                name: record.name,
                uid: record.uid || null,
                dob: record.dob || null,
                gender: record.gender || null,
                mobileNumber: record.mobileNumber || null,
                healthId: record.healthId || null,
                distName: record.distName || null,
                mandalName: record.mandalName || null,
                mandalCode: record.mandalCode ? parseInt(record.mandalCode.toString()) : null,
                secName: record.secName || null,
                secCode: record.secCode ? parseInt(record.secCode.toString()) : null,
                ruralUrban: record.ruralUrban || null,
                clusterName: record.clusterName || null,
                qualification: record.qualification || null,
                occupation: record.occupation || null,
                caste: record.caste || null,
                subCaste: record.subCaste || null,
                casteCategory: record.casteCategory || null,
                hofMember: record.hofMember || null,
                doorNumber: record.doorNumber || null,
                addressEkyc: record.addressEkyc || null,
                addressHh: record.addressHh || null,
                citizenMobile: record.citizenMobile || null,
                age: record.age || null,
                phcName: record.phcName || null,
              },
            })
            stats.success++
            console.log(`  ✓ ${record.residentId}: Updated`)
          }
        } else {
          if (mode === 'update') {
            stats.failed++
            stats.errors.push(`Record ${record.residentId}: Not found (cannot update in 'update' mode)`)
            console.error(`  ❌ ${record.residentId}: Not found (cannot update)`)
            continue
          } else if (mode === 'add' || mode === 'add_update') {
            // Create new record
            await prisma.resident.create({
              data: {
                residentId: record.residentId,
                hhId: record.hhId,
                name: record.name,
                uid: record.uid || null,
                dob: record.dob || null,
                gender: record.gender || null,
                mobileNumber: record.mobileNumber || null,
                healthId: record.healthId || null,
                distName: record.distName || null,
                mandalName: record.mandalName || null,
                mandalCode: record.mandalCode ? parseInt(record.mandalCode.toString()) : null,
                secName: record.secName || null,
                secCode: record.secCode ? parseInt(record.secCode.toString()) : null,
                ruralUrban: record.ruralUrban || null,
                clusterName: record.clusterName || null,
                qualification: record.qualification || null,
                occupation: record.occupation || null,
                caste: record.caste || null,
                subCaste: record.subCaste || null,
                casteCategory: record.casteCategory || null,
                hofMember: record.hofMember || null,
                doorNumber: record.doorNumber || null,
                addressEkyc: record.addressEkyc || null,
                addressHh: record.addressHh || null,
                citizenMobile: record.citizenMobile || null,
                age: record.age || null,
                phcName: record.phcName || null,
              },
            })
            stats.success++
            console.log(`  ✓ ${record.residentId}: Created`)
          }
        }
      } catch (error) {
        stats.failed++
        const errorMsg = error instanceof Error ? error.message : String(error)
        stats.errors.push(`Record ${record.residentId}: ${errorMsg}`)
        console.error(`  ❌ ${record.residentId}: ${errorMsg}`)
      }
    }
  }

  return stats
}

async function main() {
  const args = process.argv.slice(2)

  // Parse command line arguments
  const options: {
    healthFile?: string
    demoFile?: string
    mergedFile?: string
    mode: 'add' | 'update' | 'add_update'
    dryRun: boolean
    batchSize: number
  } = {
    mode: 'add_update',
    dryRun: false,
    batchSize: 100,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--health':
        options.healthFile = args[++i]
        break
      case '--demographic':
        options.demoFile = args[++i]
        break
      case '--merged':
        options.mergedFile = args[++i]
        break
      case '--mode':
        const mode = args[++i]
        if (!['add', 'update', 'add_update'].includes(mode)) {
          console.error(`Invalid mode: ${mode}. Use 'add', 'update', or 'add_update'`)
          process.exit(1)
        }
        options.mode = mode as 'add' | 'update' | 'add_update'
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10)
        break
      case '--help':
        console.log(`
CLI Script for Importing Resident Data from CSV/Excel Files

Usage:
  npm run import:residents -- --health health-data.csv --demographic demographic-data.csv --mode add_update
  npm run import:residents -- --merged merged-data.csv --mode add

Options:
  --health <file>        Path to health data CSV/Excel file
  --demographic <file>   Path to demographic data CSV/Excel file
  --merged <file>        Path to pre-merged CSV/Excel file
  --mode <mode>          Import mode: add, update, or add_update (default: add_update)
  --dry-run              Validate data without importing
  --batch-size <size>    Number of records to import per batch (default: 100)
  --help                 Show this help message

Examples:
  # Import from separate health and demographic files
  npm run import:residents -- --health data/health.csv --demographic data/demographic.csv

  # Import from pre-merged file
  npm run import:residents -- --merged data/merged.csv --mode add

  # Dry run to validate data
  npm run import:residents -- --health data/health.csv --demographic data/demographic.csv --dry-run

  # Import with custom batch size
  npm run import:residents -- --merged data/merged.csv --batch-size 50
        `)
        process.exit(0)
      default:
        console.error(`Unknown option: ${args[i]}`)
        console.log('Use --help for usage information')
        process.exit(1)
    }
  }

  console.log('🚀 Resident Data Import Tool\n')

  try {
    let mergedRecords: MergedResidentData[] = []

    if (options.mergedFile) {
      // Import from pre-merged file (use streaming for large files)
      console.log(`📂 Reading merged file: ${options.mergedFile}`)
      console.log(`   Using streaming parser for large file...\n`)
      const data = await readFileStreaming(options.mergedFile)
      console.log(`   ✅ Found ${data.length.toLocaleString()} records\n`)

      // Assume merged file has database column names
      mergedRecords = data.map((row: any) => ({
        residentId: row.residentId || row.resident_id,
        hhId: row.hhId || row.hh_id || '',
        name: row.name || '',
        uid: validateUID(row.uid),
        dob: parseDate(row.dob),
        gender: normalizeGender(row.gender),
        mobileNumber: row.mobileNumber || row.mobile_number,
        healthId: row.healthId || row.health_id,
        distName: row.distName || row.dist_name,
        mandalName: row.mandalName || row.mandal_name,
        mandalCode: row.mandalCode || row.mandal_code,
        secName: row.secName || row.sec_name,
        secCode: row.secCode || row.sec_code,
        ruralUrban: row.ruralUrban || row.rural_urban,
        clusterName: row.clusterName || row.cluster_name,
        qualification: row.qualification,
        occupation: row.occupation,
        caste: row.caste,
        subCaste: row.subCaste || row.sub_caste,
        casteCategory: row.casteCategory || row.caste_category,
        hofMember: row.hofMember || row.hof_member,
        doorNumber: row.doorNumber || row.door_number,
        addressEkyc: row.addressEkyc || row.address_ekyc,
        addressHh: row.addressHh || row.address_hh,
        citizenMobile: row.citizenMobile || row.citizen_mobile,
        age: parseInteger(row.age),
        phcName: row.phcName || row.phc_name,
      }))
    } else if (options.healthFile || options.demoFile) {
      // Import from separate files and merge
      const healthDataMap = new Map<string, Partial<MergedResidentData>>()
      const demoDataMap = new Map<string, Partial<MergedResidentData>>()

      if (options.healthFile) {
        console.log(`📂 Reading health data file: ${options.healthFile}`)
        const healthData = readFile(options.healthFile) as HealthDataRow[]
        console.log(`   Found ${healthData.length} records`)

        for (const row of healthData) {
          const merged = mergeHealthData(row)
          healthDataMap.set(row.resident_id, merged)
        }
      }

      if (options.demoFile) {
        console.log(`📂 Reading demographic data file: ${options.demoFile}`)
        const demoData = readFile(options.demoFile) as DemographicDataRow[]
        console.log(`   Found ${demoData.length} records`)

        for (const row of demoData) {
          const merged = mergeDemographicData(row)
          demoDataMap.set(row['resident ID'], merged)
        }
      }

      console.log(`\n🔄 Merging data...`)
      mergedRecords = mergeRecords(healthDataMap, demoDataMap)
      console.log(`   Merged ${mergedRecords.length} unique records\n`)
    } else {
      console.error('❌ Error: Must provide either --merged or both --health and --demographic files')
      console.log('Use --help for usage information')
      process.exit(1)
    }

    // Import records
    const stats = await importRecords(mergedRecords, options.mode, options.batchSize, options.dryRun)

    // Print summary
    console.log(`\n✅ Import Complete!\n`)
    console.log(`📊 Summary:`)
    console.log(`   Total records: ${stats.total}`)
    console.log(`   ✓ Success: ${stats.success}`)
    console.log(`   ❌ Failed: ${stats.failed}`)
    console.log(`   ⚠️  Duplicates: ${stats.duplicates}`)

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`)
      stats.errors.slice(0, 10).forEach((error) => {
        console.log(`   - ${error}`)
      })
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`)
      }
    }

    if (options.dryRun) {
      console.log(`\n⚠️  This was a dry run. No data was imported.`)
      console.log(`   Remove --dry-run flag to perform actual import.`)
    }

  } catch (error) {
    console.error(`\n❌ Fatal Error:`, error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})

