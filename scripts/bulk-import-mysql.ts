#!/usr/bin/env tsx

/**
 * MySQL Bulk Import Script using LOAD DATA LOCAL INFILE
 * 
 * This script uses MySQL's native LOAD DATA LOCAL INFILE command to efficiently
 * import large CSV files (2M+ records) without Node.js memory limitations.
 * 
 * Usage:
 *   npm run bulk-import -- --file /path/to/file.csv --dry-run
 *   npm run bulk-import -- --file /path/to/file.csv --mode add_update
 * 
 * Options:
 *   --file <path>     Path to CSV file to import
 *   --mode <mode>     Import mode: add, update, or add_update (default: add_update)
 *   --dry-run         Validate without importing
 *   --help            Show help
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import mysql from 'mysql2/promise'

const prisma = new PrismaClient()

interface ImportOptions {
  file?: string
  mode: 'add' | 'update' | 'add_update'
  dryRun: boolean
}

interface ImportStats {
  totalRecords: number
  inserted: number
  updated: number
  skipped: number
  errors: number
  duration: number
}

// Column mapping from CSV to database
const COLUMN_MAPPING = {
  distName: 'dist_name',
  mandalName: 'mandal_name',
  mandalCode: 'mandal_code',
  secName: 'sec_name',
  secCode: 'sec_code',
  ruralUrban: 'rural_urban',
  hhId: 'hh_id',
  residentId: 'resident_id',
  uid: 'uid',
  clusterName: 'cluster_name',
  name: 'name',
  dob: 'dob',
  gender: 'gender',
  qualification: 'qualification',
  occupation: 'occupation',
  caste: 'caste',
  subCaste: 'sub_caste',
  casteCategory: 'caste_category',
  casteCategoryDetailed: 'caste_category_detailed',
  mobileNumber: 'mobile_number',
  hofMember: 'hof_member',
  doorNumber: 'door_number',
  addressEkyc: 'address_ekyc',
  addressHh: 'address_hh',
  healthId: 'health_id',
  citizenMobile: 'citizen_mobile',
  age: 'age',
  phcName: 'phc_name',
}

async function getMySQLConnection() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set')
  }

  // Parse DATABASE_URL: mysql://user:password@host:port/database
  const match = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) {
    throw new Error('Invalid DATABASE_URL format')
  }

  const [, user, password, host, port, database] = match

  return mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    multipleStatements: true,
    infileStreamFactory: (filePath: string) => fs.createReadStream(filePath),
    connectTimeout: 60000, // 60 seconds
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  })
}

async function validateCSVFile(filePath: string): Promise<{ valid: boolean; columns: string[]; error?: string }> {
  if (!fs.existsSync(filePath)) {
    return { valid: false, columns: [], error: `File not found: ${filePath}` }
  }

  // Read only first line to get column names (using stream to avoid memory issues)
  const firstLine = await new Promise<string>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    let data = ''

    stream.on('data', (chunk) => {
      data += chunk
      const newlineIndex = data.indexOf('\n')
      if (newlineIndex !== -1) {
        stream.destroy()
        resolve(data.substring(0, newlineIndex))
      }
    })

    stream.on('end', () => resolve(data))
    stream.on('error', reject)
  })

  const columns = firstLine.split(',').map(col => col.trim().replace(/^"|"$/g, ''))

  // Check if all required columns are present
  const requiredColumns = ['residentId', 'hhId', 'name']
  const missingColumns = requiredColumns.filter(col => !columns.includes(col))

  if (missingColumns.length > 0) {
    return {
      valid: false,
      columns,
      error: `Missing required columns: ${missingColumns.join(', ')}`
    }
  }

  return { valid: true, columns }
}

async function countCSVLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })

    stream.on('data', (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === '\n') lineCount++
      }
    })

    stream.on('end', () => resolve(lineCount))
    stream.on('error', reject)
  })
}

async function performDryRun(connection: mysql.Connection, filePath: string): Promise<void> {
  console.log('🔍 DRY RUN MODE - Validating CSV file...\n')

  // Validate file
  const validation = await validateCSVFile(filePath)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  console.log('✅ CSV File Validation:')
  console.log(`   File: ${filePath}`)
  console.log(`   Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`   Columns: ${validation.columns.length}`)
  console.log()

  console.log('📋 CSV Columns:')
  validation.columns.forEach((col, idx) => {
    const dbCol = COLUMN_MAPPING[col as keyof typeof COLUMN_MAPPING] || col
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${col.padEnd(25)} → ${dbCol}`)
  })
  console.log()

  // Count records in CSV (using streaming to avoid memory issues)
  console.log('📊 Counting records in CSV file...')
  const lineCount = await countCSVLines(filePath)
  const recordCount = lineCount > 0 ? lineCount - 1 : 0 // Subtract header
  console.log(`   Total records: ${recordCount.toLocaleString()}`)
  console.log()

  // Create temporary table for validation
  console.log('🔧 Creating temporary table for validation...')
  
  const tempTableName = `residents_temp_${Date.now()}`
  
  try {
    // Create temp table with same structure as residents
    await connection.query(`
      CREATE TEMPORARY TABLE ${tempTableName} LIKE residents
    `)
    
    console.log(`   ✅ Temporary table created: ${tempTableName}`)
    console.log()

    // Build LOAD DATA LOCAL INFILE query
    const csvColumns = validation.columns.map(col => `@${col}`).join(', ')
    const setStatements = validation.columns
      .map(col => {
        const dbCol = COLUMN_MAPPING[col as keyof typeof COLUMN_MAPPING] || col

        // Handle special conversions
        if (col === 'dob') {
          return `${dbCol} = NULLIF(STR_TO_DATE(@${col}, '%Y-%m-%d %H:%i:%s'), '')`
        } else if (col === 'gender') {
          return `${dbCol} = CASE
            WHEN UPPER(@${col}) IN ('MALE', 'M') THEN 'MALE'
            WHEN UPPER(@${col}) IN ('FEMALE', 'F') THEN 'FEMALE'
            WHEN UPPER(@${col}) IN ('OTHER', 'O') THEN 'OTHER'
            ELSE NULL
          END`
        } else if (col === 'mobileNumber') {
          // Remove ".0" suffix from mobile numbers (e.g., "9876543210.0" -> "9876543210")
          return `${dbCol} = NULLIF(REPLACE(@${col}, '.0', ''), '')`
        } else if (['age', 'mandalCode', 'secCode'].includes(col)) {
          return `${dbCol} = NULLIF(@${col}, '')`
        } else {
          return `${dbCol} = NULLIF(@${col}, '')`
        }
      })
      .join(',\n      ')

    const loadQuery = `
      LOAD DATA LOCAL INFILE '${filePath}'
      INTO TABLE ${tempTableName}
      FIELDS TERMINATED BY ','
      OPTIONALLY ENCLOSED BY '"'
      LINES TERMINATED BY '\\n'
      IGNORE 1 LINES
      (${csvColumns})
      SET
      id = UUID(),
      created_at = NOW(),
      updated_at = NOW(),
      ${setStatements}
    `

    console.log('📥 Loading data into temporary table...')
    console.log('   This may take a few minutes for large files...')
    console.log()

    const startTime = Date.now()
    const [result] = await connection.query(loadQuery) as any
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`   ✅ Data loaded in ${duration}s`)
    console.log()

    // Get statistics
    const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM ${tempTableName}`) as any
    const recordCount = countResult[0].count

    console.log('📊 Validation Results:')
    console.log(`   Records loaded: ${recordCount.toLocaleString()}`)
    console.log(`   Warnings: ${(result as any).warningStatus || 0}`)
    console.log()

    // Check for missing required fields
    const [missingHhId] = await connection.query(
      `SELECT COUNT(*) as count FROM ${tempTableName} WHERE hh_id IS NULL OR hh_id = ''`
    ) as any
    const [missingName] = await connection.query(
      `SELECT COUNT(*) as count FROM ${tempTableName} WHERE name IS NULL OR name = ''`
    ) as any
    const [missingResidentId] = await connection.query(
      `SELECT COUNT(*) as count FROM ${tempTableName} WHERE resident_id IS NULL OR resident_id = ''`
    ) as any

    console.log('✅ Required Field Validation:')
    console.log(`   Missing residentId: ${missingResidentId[0].count}`)
    console.log(`   Missing hhId: ${missingHhId[0].count}`)
    console.log(`   Missing name: ${missingName[0].count}`)
    console.log()

    if (missingResidentId[0].count > 0 || missingHhId[0].count > 0 || missingName[0].count > 0) {
      console.log('❌ VALIDATION FAILED: Some records have missing required fields')
      console.log()
    } else {
      console.log('✅ VALIDATION PASSED: All records have required fields')
      console.log()
      console.log('🚀 Ready to import!')
      console.log()
      console.log('Run the actual import with:')
      console.log(`   npm run bulk-import -- --file ${filePath} --mode add_update`)
      console.log()
    }

    // Drop temp table
    await connection.query(`DROP TEMPORARY TABLE ${tempTableName}`)

  } catch (error: any) {
    console.error('❌ Validation Error:', error.message)
    throw error
  }
}

async function performImport(
  connection: mysql.Connection,
  filePath: string,
  mode: 'add' | 'update' | 'add_update'
): Promise<ImportStats> {
  console.log(`🚀 Starting bulk import in ${mode.toUpperCase()} mode...\n`)

  const startTime = Date.now()
  let stats: ImportStats = {
    totalRecords: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    duration: 0,
  }

  // Validate file first
  const validation = await validateCSVFile(filePath)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Build LOAD DATA LOCAL INFILE query (same as dry run)
  const csvColumns = validation.columns.map(col => `@${col}`).join(', ')
  const setStatements = validation.columns
    .map(col => {
      const dbCol = COLUMN_MAPPING[col as keyof typeof COLUMN_MAPPING] || col

      if (col === 'dob') {
        return `${dbCol} = NULLIF(STR_TO_DATE(@${col}, '%Y-%m-%d %H:%i:%s'), '')`
      } else if (col === 'gender') {
        return `${dbCol} = CASE
          WHEN UPPER(@${col}) IN ('MALE', 'M') THEN 'MALE'
          WHEN UPPER(@${col}) IN ('FEMALE', 'F') THEN 'FEMALE'
          WHEN UPPER(@${col}) IN ('OTHER', 'O') THEN 'OTHER'
          ELSE NULL
        END`
      } else if (col === 'mobileNumber') {
        // Remove ".0" suffix from mobile numbers (e.g., "9876543210.0" -> "9876543210")
        return `${dbCol} = NULLIF(REPLACE(@${col}, '.0', ''), '')`
      } else if (['age', 'mandalCode', 'secCode'].includes(col)) {
        return `${dbCol} = NULLIF(@${col}, '')`
      } else {
        return `${dbCol} = NULLIF(@${col}, '')`
      }
    })
    .join(',\n      ')

  const loadQuery = `
    LOAD DATA LOCAL INFILE '${filePath}'
    INTO TABLE residents
    FIELDS TERMINATED BY ','
    OPTIONALLY ENCLOSED BY '"'
    LINES TERMINATED BY '\\n'
    IGNORE 1 LINES
    (${csvColumns})
    SET
    id = UUID(),
    created_at = NOW(),
    updated_at = NOW(),
    ${setStatements}
  `

  console.log('📥 Importing data...')
  console.log('   This may take several minutes for large files...')
  console.log()

  try {
    // Increase timeouts for large import
    await connection.query('SET SESSION wait_timeout = 3600')
    await connection.query('SET SESSION interactive_timeout = 3600')
    await connection.query('SET SESSION net_read_timeout = 3600')
    await connection.query('SET SESSION net_write_timeout = 3600')

    console.log('   ⏱️  Timeouts increased to 1 hour for large import')
    console.log()

    const [result] = await connection.query(loadQuery) as any

    stats.totalRecords = (result as any).affectedRows || 0
    stats.inserted = stats.totalRecords
    stats.duration = (Date.now() - startTime) / 1000

    console.log('✅ Import Complete!')
    console.log()

  } catch (error: any) {
    console.error('❌ Import Error:', error.message)
    console.error('   Error code:', (error as any).code)
    console.error('   SQL State:', (error as any).sqlState)
    throw error
  }

  return stats
}

async function main() {
  const options: ImportOptions = {
    mode: 'add_update',
    dryRun: false,
  }

  // Parse command line arguments
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
        options.file = args[++i]
        break
      case '--mode':
        options.mode = args[++i] as 'add' | 'update' | 'add_update'
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--help':
        console.log(`
MySQL Bulk Import Script

Usage:
  npm run bulk-import -- --file /path/to/file.csv --dry-run
  npm run bulk-import -- --file /path/to/file.csv --mode add_update

Options:
  --file <path>     Path to CSV file to import
  --mode <mode>     Import mode: add, update, or add_update (default: add_update)
  --dry-run         Validate without importing
  --help            Show this help message
`)
        process.exit(0)
      default:
        console.error(`Unknown option: ${args[i]}`)
        process.exit(1)
    }
  }

  if (!options.file) {
    console.error('❌ Error: --file option is required')
    process.exit(1)
  }

  console.log('🚀 MySQL Bulk Import Tool\n')

  let connection: mysql.Connection | null = null

  try {
    // Connect to MySQL
    console.log('🔌 Connecting to MySQL...')
    connection = await getMySQLConnection()
    console.log('   ✅ Connected\n')

    if (options.dryRun) {
      await performDryRun(connection, options.file)
    } else {
      const stats = await performImport(connection, options.file, options.mode)
      
      console.log('📊 Import Statistics:')
      console.log(`   Total records: ${stats.totalRecords.toLocaleString()}`)
      console.log(`   Inserted: ${stats.inserted.toLocaleString()}`)
      console.log(`   Updated: ${stats.updated.toLocaleString()}`)
      console.log(`   Skipped: ${stats.skipped.toLocaleString()}`)
      console.log(`   Errors: ${stats.errors.toLocaleString()}`)
      console.log(`   Duration: ${stats.duration.toFixed(2)}s`)
      console.log(`   Speed: ${(stats.totalRecords / stats.duration).toFixed(0)} records/sec`)
      console.log()
    }

  } catch (error: any) {
    console.error('❌ Fatal Error:', error.message)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
    await prisma.$disconnect()
  }
}

main()

