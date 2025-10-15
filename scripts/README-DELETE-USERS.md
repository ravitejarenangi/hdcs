# User Deletion Scripts - Documentation

## Overview

These scripts help you safely delete users from specific mandals in the Chittoor Health System database.

**Target Mandals:**
- Kuppam
- Santhipuram
- Ramakuppam
- Gudipalle

---

## Scripts Available

### 1. `preview-mandal-users-deletion.ts` (DRY RUN - SAFE)

**Purpose:** Preview which users would be deleted WITHOUT actually deleting anything.

**What it does:**
- ✅ Shows detailed list of users that would be deleted
- ✅ Groups users by mandal and role
- ✅ Shows statistics and impact analysis
- ✅ **DOES NOT DELETE ANYTHING**

**Usage:**
```bash
npx tsx scripts/preview-mandal-users-deletion.ts
```

**When to use:**
- **ALWAYS RUN THIS FIRST** before running the actual deletion script
- To verify which users will be affected
- To review the impact before making changes
- To generate a report of users in target mandals

---

### 2. `delete-mandal-users.ts` (ACTUAL DELETION)

**Purpose:** Actually delete users from the database.

**What it does:**
- ⚠️ Shows preview of users to delete
- ⚠️ Asks for confirmation (type "yes" to proceed)
- ⚠️ Deletes users from the database
- ⚠️ Logs each deletion
- ⚠️ Shows summary of successful/failed deletions

**Usage:**
```bash
npx tsx scripts/delete-mandal-users.ts
```

**When to use:**
- **ONLY AFTER** reviewing the preview script output
- When you're absolutely sure you want to delete the users
- When you have a database backup (recommended)

---

## Step-by-Step Guide

### Step 1: Preview (DRY RUN)

```bash
cd chittoor-health-system
npx tsx scripts/preview-mandal-users-deletion.ts
```

**Expected Output:**
```
🔍 DRY RUN - Preview Mode (No deletions will occur)

Target Mandals: Kuppam, Santhipuram, Ramakuppam, Gudipalle
════════════════════════════════════════════════════════════

📊 Database Statistics:
   Total users (excluding ADMIN): 45
   Panchayat Secretaries: 15
   Field Officers: 30

════════════════════════════════════════════════════════════

📈 IMPACT ANALYSIS:
   🗑️  Users to be DELETED: 12
   ✅ Users to be KEPT: 33
   📊 Deletion Rate: 26.7%

════════════════════════════════════════════════════════════

📋 DETAILED PREVIEW OF USERS TO BE DELETED:

📍 KUPPAM (5 users)
────────────────────────────────────────────────────────────

  👤 Panchayat Secretaries (1):
     1. John Doe
        Username: @john.kuppam
        Email: john@example.com
        Status: 🟢 Active
        Created: 1/15/2025

  👥 Field Officers (4):
     1. Jane Smith
        Username: @jane.fo
        Email: jane@example.com
        Secretariats: Kuppam -> Secretariat1, Kuppam -> Secretariat2
        Status: 🟢 Active
        Created: 1/20/2025
     ...

[More details for other mandals...]

════════════════════════════════════════════════════════════

📊 SUMMARY BY ROLE:
   👤 Panchayat Secretaries: 4
   👥 Field Officers: 8
   📝 Total: 12

════════════════════════════════════════════════════════════

💡 NEXT STEPS:
   1. Review the list above carefully
   2. If everything looks correct, run the actual deletion script:
      npx tsx scripts/delete-mandal-users.ts
   3. The deletion script will ask for confirmation before proceeding

⚠️  Remember: This is a DRY RUN - no data has been deleted!
```

### Step 2: Review the Output

**Check the following:**
- ✅ Are the correct users listed?
- ✅ Are the mandals correct?
- ✅ Is the count reasonable?
- ✅ Are any important users accidentally included?

### Step 3: (Optional) Create Database Backup

```bash
# If using PostgreSQL
pg_dump -U your_username -d chittoor_health_db > backup_before_deletion.sql

# If using MySQL
mysqldump -u your_username -p chittoor_health_db > backup_before_deletion.sql
```

### Step 4: Run Actual Deletion

```bash
npx tsx scripts/delete-mandal-users.ts
```

**Expected Output:**
```
🔍 Scanning for users to delete...

Target Mandals: Kuppam, Santhipuram, Ramakuppam, Gudipalle
────────────────────────────────────────────────────────────

📊 Total users in database (excluding ADMIN): 45

🎯 Users to be DELETED: 12
✅ Users to be KEPT: 33
────────────────────────────────────────────────────────────

📋 PREVIEW OF USERS TO BE DELETED:

👤 PANCHAYAT SECRETARIES (4):
────────────────────────────────────────────────────────────
1. John Doe (@john.kuppam)
   Mandal: Kuppam
   Status: Active

[More users listed...]

────────────────────────────────────────────────────────────

⚠️  WARNING: This action cannot be undone!
⚠️  All data associated with these users will be permanently deleted.

Are you sure you want to delete 12 user(s)? (yes/no): yes

🗑️  Starting deletion process...

✅ Deleted: John Doe (@john.kuppam) - PANCHAYAT_SECRETARY
✅ Deleted: Jane Smith (@jane.fo) - FIELD_OFFICER
...

────────────────────────────────────────────────────────────

📊 DELETION SUMMARY:
   ✅ Successfully deleted: 12 user(s)
   ❌ Failed to delete: 0 user(s)
   📝 Total processed: 12 user(s)

✨ Deletion process completed!
```

---

## Deletion Logic

### Panchayat Secretaries
**Deleted if:**
- `role` = "PANCHAYAT_SECRETARY"
- `mandalName` matches any of: Kuppam, Santhipuram, Ramakuppam, Gudipalle (case-insensitive)

**Example:**
```typescript
{
  username: "john.kuppam",
  role: "PANCHAYAT_SECRETARY",
  mandalName: "Kuppam"  // ❌ WILL BE DELETED
}
```

### Field Officers
**Deleted if:**
- `role` = "FIELD_OFFICER"
- `assignedSecretariats` contains ANY secretariat from target mandals

**Example:**
```typescript
{
  username: "jane.fo",
  role: "FIELD_OFFICER",
  assignedSecretariats: [
    { mandalName: "Kuppam", secName: "Secretariat1" },      // ❌ Target mandal
    { mandalName: "Tirupati", secName: "Secretariat2" }     // ✅ Other mandal
  ]
  // ❌ WILL BE DELETED (has at least one target mandal)
}
```

### Users That Will NOT Be Deleted
- ✅ All ADMIN users
- ✅ Panchayat Secretaries from other mandals (e.g., Tirupati, Chittoor)
- ✅ Field Officers assigned ONLY to secretariats in other mandals

---

## Safety Features

### 1. Preview Mode
- Dry run script shows exactly what will be deleted
- No database changes in preview mode

### 2. Confirmation Prompt
- Actual deletion script requires typing "yes" to proceed
- Can cancel at any time by typing "no" or pressing Ctrl+C

### 3. Detailed Logging
- Each deletion is logged to console
- Shows success/failure for each user
- Final summary with statistics

### 4. Error Handling
- If a deletion fails, script continues with other users
- Errors are logged but don't stop the process
- Final summary shows which deletions failed

---

## Troubleshooting

### Error: "Cannot find module 'tsx'"

**Solution:**
```bash
npm install -g tsx
# or
npx tsx scripts/preview-mandal-users-deletion.ts
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

### No users found to delete

**Possible reasons:**
- Users might already be deleted
- Mandal names might not match exactly (check case sensitivity)
- Users might be assigned to different mandals

---

## Modifying Target Mandals

To change which mandals to delete users from, edit the `MANDALS_TO_DELETE` array in both scripts:

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

## Important Notes

⚠️ **WARNINGS:**
- Deletion is **PERMANENT** and **CANNOT BE UNDONE**
- Always run the preview script first
- Consider creating a database backup before deletion
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

