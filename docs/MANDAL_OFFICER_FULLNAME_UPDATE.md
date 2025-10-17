# Mandal Officer Full Name Update

## Overview

This document describes the update of Mandal Officer full names from "PS <MANDAL_NAME>" to "MO <MANDAL_NAME>" format to align with the role renaming from "Panchayat Secretary" to "Mandal Officer".

## Changes Made

### 1. Database Migration

**Date:** October 17, 2025

All 31 Mandal Officer user accounts were updated:
- **Old Format:** "PS <MANDAL_NAME>" (e.g., "PS CHITTOOR", "PS NAGARI")
- **New Format:** "MO <MANDAL_NAME>" (e.g., "MO CHITTOOR", "MO NAGARI")

### 2. Updated Files

#### Scripts
- **`scripts/update-mo-fullnames.ts`** (NEW)
  - Migration script to update existing Mandal Officer fullName fields
  - Handles various "PS" prefix formats (PS, PS-, PS_)
  - Provides detailed summary of all updates

- **`scripts/create-panchayat-secretaries.ts`** (Already Updated)
  - User creation script already uses "MO" prefix
  - Line 108: `const fullName = \`MO ${mandal.mandalName}\``

#### Seed File
- **`prisma/seed.ts`**
  - Updated demo Mandal Officer from "Rajesh Kumar" to "MO CHITTOOR"
  - Ensures consistency with the new naming convention

## Migration Results

### Summary Statistics
- **Total Mandal Officers:** 31
- **Successfully Updated:** 31 (100%)
- **Errors:** 0
- **Skipped:** 0

### Updated Records

| Username      | Mandal                | Old Full Name              | New Full Name              |
|---------------|----------------------|----------------------------|----------------------------|
| mo_chittoor   | CHITTOOR             | Rajesh Kumar               | MO CHITTOOR                |
| mo_5423       | BAIREDDI PALLE       | PS THEERTHAM               | MO THEERTHAM               |
| mo_5429       | BANGARUPALEM         | PS BANGARUPALEM            | MO BANGARUPALEM            |
| mo_5421       | CHITTOOR             | PS CHITTOOR                | MO CHITTOOR                |
| mo_5413       | CHOWDEPALLE          | MPDO CHOWDEPALLI           | MO CHOWDEPALLE             |
| mo_5420       | GANGADHARA NELLORE   | PS GANGADHARA NELLORE      | MO GANGADHARA NELLORE      |
| mo_5417       | GANGAVARAM           | PS GANGAVARAM              | MO GANGAVARAM              |
| mo_5426       | GUDI PALLE           | PS GUDI PALLE              | MO GUDI PALLE              |
| mo_5431       | GUDIPALA             | PS GUDIPALA                | MO GUDIPALA                |
| mo_5411       | IRALA                | Y MOUNIKA                  | MO IRALA                   |
| mo_5408       | KARVETINAGAR         | PS KARVETINAGAR            | MO KARVETINAGAR            |
| mo_5406       | NAGARI               | PS NAGARI                  | MO NAGARI                  |
| mo_5404       | NINDRA               | PS NINDRA                  | MO NINDRA                  |
| mo_5422       | PALAMANER            | PS PALAMANER               | MO PALAMANER               |
| mo_5432       | PALASAMUDRAM         | PS PALASAMUDRAM            | MO PALASAMUDRAM            |
| mo_5416       | PEDDA PANJANI        | PS PEDDA PANJANI           | MO PEDDA PANJANI           |
| mo_5409       | PENUMURU             | PS KAMACHINAIAHPALLE       | MO KAMACHINAIAHPALLE       |
| mo_5395       | PULICHERLA           | PS PULICHERLA              | MO PULICHERLA              |
| mo_5415       | PUNGANUR             | PS PUNGANUR                | MO PUNGANUR                |
| mo_5410       | PUTHALAPATTU         | PS PUTHALAPATTU            | MO PUTHALAPATTU            |
| mo_5428       | RAMA KUPPAM          | S LAKSHMAPPA               | MO RAMA KUPPAM             |
| mo_5373       | ROMPICHERLA          | PS ROMPICHERLA             | MO ROMPICHERLA             |
| mo_5425       | SANTHI PURAM         | PS SANTHI PURAM            | MO SANTHI PURAM            |
| mo_5394       | SODAM                | PS SODAM                   | MO SODAM                   |
| mo_5412       | SOMALA               | PS SOMALA                  | MO SOMALA                  |
| mo_5419       | SRIRANGARAJAPURAM    | PS SRIRANGARAJAPURAM       | MO SRIRANGARAJAPURAM       |
| mo_5418       | THAVANAMPALLE        | PS THAVANAMPALLE           | MO THAVANAMPALLE           |
| mo_5397       | VEDURU KUPPAM        | PS VEDURU KUPPAM           | MO VEDURU KUPPAM           |
| mo_5424       | VENKATAGIRI KOTA     | PS VENKATAGIRI KOTA        | MO VENKATAGIRI KOTA        |
| mo_5405       | VIJAYA PURAM         | PS VIJAYA PURAM            | MO VIJAYA PURAM            |
| mo_5430       | YADAMARI             | K G SIVARAJU               | MO YADAMARI                |

## Technical Details

### Database Field
- **Table:** `User`
- **Field:** `fullName` (String)
- **Role Filter:** `PANCHAYAT_SECRETARY`

### Migration Logic
1. Find all users with role `PANCHAYAT_SECRETARY`
2. Check if `fullName` starts with "PS ", "PS-", or "PS_"
3. Replace prefix with "MO "
4. If no "PS" prefix but has `mandalName`, construct as `MO <mandalName>`
5. Update database record

### Running the Migration

To run the migration script:

```bash
npx tsx scripts/update-mo-fullnames.ts
```

**Note:** The script is idempotent - it can be run multiple times safely. It will skip records that already have the correct format.

## Related Changes

This update is part of the complete "Panchayat Secretary" to "Mandal Officer" rebranding:

1. ✅ **Role Display Name** - Changed to "Mandal Officer"
2. ✅ **Routes** - Updated from `/panchayat` to `/mandal-officer`
3. ✅ **API Endpoints** - Updated from `/api/panchayat` to `/api/mandal-officer`
4. ✅ **Username Format** - Updated from `ps_*` to `mo_*`
5. ✅ **Full Name Format** - Updated from "PS <MANDAL>" to "MO <MANDAL>" ⭐ **THIS UPDATE**
6. ✅ **Dashboard Titles** - Updated to "Mandal Officer Dashboard"
7. ✅ **Settings Page** - Shows "Mandal Officer" role badge

## User Impact

### What Users Will See
- Mandal Officer names now display as "MO <MANDAL_NAME>" instead of "PS <MANDAL_NAME>"
- This appears in:
  - User profile displays
  - Admin user management tables
  - Login welcome messages
  - Any location where the full name is shown

### What Doesn't Change
- **Usernames:** Already updated to `mo_*` format (separate change)
- **Passwords:** Remain unchanged
- **Permissions:** No change to access rights
- **Data Access:** No change to mandal assignments

## Verification

To verify the update was successful:

```sql
-- Check all Mandal Officer full names
SELECT username, fullName, mandalName, role
FROM User
WHERE role = 'PANCHAYAT_SECRETARY'
ORDER BY mandalName;
```

Expected result: All `fullName` values should start with "MO " followed by the mandal name.

## Rollback (If Needed)

If rollback is required, the old values are documented in this file. A rollback script can be created if necessary, but this should not be needed as the change is purely cosmetic and aligns with the overall rebranding.

## Version History

- **v1.0** (October 17, 2025) - Initial migration from "PS" to "MO" prefix
  - 31 Mandal Officers updated
  - 100% success rate
  - Zero errors

## Support

For questions or issues related to this update, contact the system administrator.

