# Resident Deletion Scripts - Documentation

## Overview

These scripts help you safely delete resident records from specific mandals in the Chittoor Health System database.

**Target Mandals:**
- Kuppam
- Santhipuram
- Ramakuppam
- Gudipalle

---

## Scripts Available

### 1. `preview-mandal-residents-deletion.ts` (DRY RUN - SAFE)

**Purpose:** Preview which residents would be deleted WITHOUT actually deleting anything.

**What it does:**
- ✅ Shows detailed statistics of residents that would be deleted
- ✅ Groups residents by mandal and secretariat
- ✅ Shows sample resident data
- ✅ Analyzes foreign key constraints (UpdateLog records)
- ✅ **DOES NOT DELETE ANYTHING**

**Usage:**
```bash
npm run preview:delete-residents
```

**When to use:**
- **ALWAYS RUN THIS FIRST** before running the actual deletion script
- To verify which residents will be affected
- To review the impact before making changes
- To check how many update logs will be deleted

---

### 2. `delete-mandal-residents.ts` (ACTUAL DELETION)

**Purpose:** Actually delete residents from the database.

**What it does:**
- ⚠️ Shows preview of residents to delete
- ⚠️ Asks for confirmation (type "yes" to proceed)
- ⚠️ Deletes UpdateLog records first (handles foreign key constraints)
- ⚠️ Deletes residents in batches (100 at a time for performance)
- ⚠️ Logs progress every 50 deletions
- ⚠️ Shows summary of successful/failed deletions

**Usage:**
```bash
npm run delete:mandal-residents
```

**When to use:**
- **ONLY AFTER** reviewing the preview script output
- When you're absolutely sure you want to delete the residents
- When you have a database backup (strongly recommended)

---

## Deletion Logic

### What Gets Deleted

**Residents are deleted if:**
- `mandalName` field matches any of the target mandals (case-insensitive)

**Example:**
```typescript
{
  residentId: "RES123456",
  name: "John Doe",
  mandalName: "Kuppam",  // ❌ WILL BE DELETED
  secName: "Kuppam1"
}
```

### Foreign Key Constraint Handling

**The Problem:**
Residents may have UpdateLog records (audit trail of field updates). The database has a foreign key constraint that prevents deleting residents who have update logs.

**The Solution:**
The deletion script automatically:
1. **Deletes all UpdateLog records** for each resident FIRST
2. **Then deletes the resident** record

This ensures no foreign key constraint errors occur.

**Impact:**
- ✅ Residents are successfully deleted
- ⚠️ Update history (audit trail) is also deleted
- ⚠️ This is permanent and cannot be undone

---

## Step-by-Step Usage Guide

### Step 1: Preview (DRY RUN) - ALWAYS RUN THIS FIRST

```bash
cd chittoor-health-system
npm run preview:delete-residents
```

**Expected Output:**
```
🔍 DRY RUN - Preview Mode (No deletions will occur)

Target Mandals: Kuppam, Santhipuram, Ramakuppam, Gudipalle
════════════════════════════════════════════════════════════

📊 Database Statistics:
   Total residents in database: 125,450

════════════════════════════════════════════════════════════

📈 IMPACT ANALYSIS:
   🗑️  Residents to be DELETED: 15,234
   ✅ Residents to be KEPT: 110,216
   📊 Deletion Rate: 12.1%

⚠️  Foreign Key Constraint Analysis:
   Residents with UpdateLog records: 3,456
   Total UpdateLog records to handle: 12,789
   ⚠️  These residents have update history and may require special handling

════════════════════════════════════════════════════════════

📋 DETAILED PREVIEW BY MANDAL:

📍 KUPPAM (15,234 residents)
────────────────────────────────────────────────────────────
   Secretariats: 34

   Top Secretariats by Resident Count:
     1. KUPPAM1: 1,245 residents (234 with update logs)
     2. KUPPAM2: 1,123 residents (189 with update logs)
     3. ADAVIBUDUGURU: 987 residents (156 with update logs)
     4. ANIMIGANIPALLI: 876 residents (134 with update logs)
     5. CHANDAM: 765 residents (98 with update logs)

   Sample Residents (first 3):
     1. Ramesh Kumar
        Resident ID: RES001234
        Secretariat: KUPPAM1
        Mobile: 9876543210
        Health ID: 12-3456-7890-1234
        Gender: Male
        ⚠️  Update Logs: 5

     2. Lakshmi Devi
        Resident ID: RES001235
        Secretariat: KUPPAM1
        Mobile: N/A
        Health ID: N/A
        Gender: Female

     3. Suresh Babu
        Resident ID: RES001236
        Secretariat: KUPPAM2
        Mobile: 9123456789
        Health ID: 12-3456-7890-5678
        Gender: Male
        ⚠️  Update Logs: 3

   Statistics:
     With Mobile Number: 8,456 (55.5%)
     With Health ID: 6,789 (44.6%)
     With Update Logs: 3,456 (22.7%)

📍 SANTHIPURAM: 0 residents
📍 RAMAKUPPAM: 0 residents
📍 GUDIPALLE: 0 residents

════════════════════════════════════════════════════════════

📊 OVERALL SUMMARY:
   Total Residents to Delete: 15,234
   Residents with Update Logs: 3,456
   Total Update Log Records: 12,789

════════════════════════════════════════════════════════════

💡 NEXT STEPS:
   1. Review the statistics and sample data above
   2. Note the residents with update logs (may need special handling)
   3. If everything looks correct, run the actual deletion script:
      npm run delete:mandal-residents
   4. The deletion script will handle update logs automatically

⚠️  Remember: This is a DRY RUN - no data has been deleted!
```

### Step 2: Review the Output

**Check the following:**
- ✅ Are the correct mandals listed?
- ✅ Is the resident count reasonable?
- ✅ Review the sample residents
- ✅ Check the deletion rate percentage
- ✅ Note how many update logs will be deleted

### Step 3: (STRONGLY RECOMMENDED) Create Database Backup

```bash
# PostgreSQL
pg_dump -U your_username -d chittoor_health_db > backup_before_resident_deletion.sql

# MySQL
mysqldump -u your_username -p chittoor_health_db > backup_before_resident_deletion.sql
```

### Step 4: Run Actual Deletion

```bash
npm run delete:mandal-residents
```

**Expected Output:**
```
🔍 Scanning for residents to delete...

Target Mandals: Kuppam, Santhipuram, Ramakuppam, Gudipalle
────────────────────────────────────────────────────────────

📊 Total residents in database: 125,450

🎯 Residents to be DELETED: 15,234
✅ Residents to be KEPT: 110,216
────────────────────────────────────────────────────────────

📋 PREVIEW BY MANDAL:

📍 KUPPAM: 15,234 residents
   ⚠️  3,456 residents have 12,789 update log records

────────────────────────────────────────────────────────────

⚠️  IMPORTANT INFORMATION:
   • Total residents to delete: 15,234
   • Total update log records to delete: 12,789
   • This script will delete update logs FIRST, then residents
   • This action CANNOT be undone!

────────────────────────────────────────────────────────────

⚠️  WARNING: This action cannot be undone!
⚠️  All resident data and their update history will be permanently deleted.

Are you sure you want to delete 15,234 resident(s)? (yes/no): yes

🗑️  Starting deletion process...

Processing batch 1/153 (100 residents)...
   ✅ Deleted 50 residents so far...
   ✅ Deleted 100 residents so far...
Processing batch 2/153 (100 residents)...
   ✅ Deleted 150 residents so far...
   ✅ Deleted 200 residents so far...
...
Processing batch 153/153 (34 residents)...
   ✅ Deleted 15,200 residents so far...

────────────────────────────────────────────────────────────

📊 DELETION SUMMARY:
   ✅ Successfully deleted residents: 15,234
   🗑️  Update logs deleted: 12,789
   ❌ Failed to delete: 0
   📝 Total processed: 15,234

✨ Deletion process completed!

📈 Database Impact:
   Before: 125,450 residents
   After: 110,216 residents
   Removed: 15,234 residents (12.1%)
```

---

## Performance Considerations

### Batch Processing
- Residents are deleted in batches of **100** for optimal performance
- Progress is logged every **50 deletions**
- Large deletions (10,000+ residents) may take several minutes

### Expected Timing
- **1,000 residents:** ~30 seconds
- **10,000 residents:** ~5 minutes
- **50,000 residents:** ~25 minutes
- **100,000+ residents:** ~50+ minutes

---

## Modifying Target Mandals

To change which mandals to delete residents from, edit the `MANDALS_TO_DELETE` array in **both scripts**:

```typescript
const MANDALS_TO_DELETE = [
  "Kuppam",
  "Santhipuram",
  "Ramakuppam",
  "Gudipalle",
  // Add more mandals here if needed
]
```

---

## Troubleshooting

### Error: "Cannot find module 'tsx'"

**Solution:**
```bash
npm install -g tsx
# or
npx tsx scripts/preview-mandal-residents-deletion.ts
```

### Error: "Prisma Client not found"

**Solution:**
```bash
cd chittoor-health-system
npx prisma generate
```

### Error: "Database connection failed"

**Solution:**
- Check your `.env` file has correct `DATABASE_URL`
- Ensure database server is running
- Verify network connectivity

### Deletion is very slow

**Possible reasons:**
- Large number of residents (100,000+)
- Many update logs per resident
- Database server performance

**Solutions:**
- Be patient - large deletions take time
- Consider deleting in smaller batches (modify target mandals)
- Run during off-peak hours

---

## Important Warnings

⚠️ **CRITICAL WARNINGS:**
- Deletion is **PERMANENT** and **CANNOT BE UNDONE**
- Update history (audit trail) is also deleted
- Always run the preview script first
- **STRONGLY RECOMMENDED:** Create database backup before deletion
- Test in a development environment first if possible

✅ **BEST PRACTICES:**
1. Run preview script first
2. Review output carefully
3. Create database backup
4. Run deletion script
5. Verify results in the application

---

## Support

If you encounter any issues or need help:
1. Check the troubleshooting section above
2. Review the script output for error messages
3. Contact the development team

---

**Last Updated:** January 2025

