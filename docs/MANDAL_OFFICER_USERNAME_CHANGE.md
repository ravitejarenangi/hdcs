# Mandal Officer Username Format Change

## Overview

As part of the rebranding from "Panchayat Secretary" to "Mandal Officer", we have updated the username format for all Mandal Officer accounts in the Chittoor Health System.

## What Changed?

### Username Format
- **Old Format:** `ps_<mandalcode>` (e.g., `ps_chittoor`, `ps_5373`)
- **New Format:** `mo_<mandalcode>` (e.g., `mo_chittoor`, `mo_5373`)

### Password Change (for seed user only)
- **Old Password:** `Panchayat@123`
- **New Password:** `MandalOfficer@123`
- **Note:** This only applies to the default seed user (`mo_chittoor`). Existing user passwords remain unchanged.

## Migration Summary

✅ **Successfully Completed:** December 2024

- **Total Mandal Officers Migrated:** 31
- **Success Rate:** 100% (31/31)
- **Failed Updates:** 0
- **Conflicts Detected:** 0

## Updated Usernames

All Mandal Officer usernames have been automatically updated:

| Old Username | New Username | Mandal Name |
|--------------|--------------|-------------|
| ps_chittoor | mo_chittoor | CHITTOOR |
| ps_5373 | mo_5373 | ROMPICHERLA |
| ps_5394 | mo_5394 | SODAM |
| ps_5395 | mo_5395 | PULICHERLA |
| ps_5397 | mo_5397 | VEDURU KUPPAM |
| ps_5404 | mo_5404 | NINDRA |
| ps_5405 | mo_5405 | VIJAYA PURAM |
| ps_5406 | mo_5406 | NAGARI |
| ps_5408 | mo_5408 | KARVETINAGAR |
| ps_5409 | mo_5409 | PENUMURU |
| ps_5410 | mo_5410 | PUTHALAPATTU |
| ps_5411 | mo_5411 | IRALA |
| ps_5412 | mo_5412 | SOMALA |
| ps_5413 | mo_5413 | CHOWDEPALLE |
| ps_5415 | mo_5415 | PUNGANUR |
| ps_5416 | mo_5416 | PEDDA PANJANI |
| ps_5417 | mo_5417 | GANGAVARAM |
| ps_5418 | mo_5418 | THAVANAMPALLE |
| ps_5419 | mo_5419 | SRIRANGARAJAPURAM |
| ps_5420 | mo_5420 | GANGADHARA NELLORE |
| ps_5421 | mo_5421 | CHITTOOR |
| ps_5422 | mo_5422 | PALAMANER |
| ps_5423 | mo_5423 | BAIREDDI PALLE |
| ps_5424 | mo_5424 | VENKATAGIRI KOTA |
| ps_5425 | mo_5425 | SANTHI PURAM |
| ps_5426 | mo_5426 | GUDI PALLE |
| ps_5428 | mo_5428 | RAMA KUPPAM |
| ps_5429 | mo_5429 | BANGARUPALEM |
| ps_5430 | mo_5430 | YADAMARI |
| ps_5431 | mo_5431 | GUDIPALA |
| ps_5432 | mo_5432 | PALASAMUDRAM |

## Action Required for Users

### For Mandal Officers

**IMPORTANT:** You must use your new username to login.

1. **Old Login Credentials:**
   - Username: `ps_<your_mandal_code>`
   - Password: `<your_existing_password>`

2. **New Login Credentials:**
   - Username: `mo_<your_mandal_code>` ⭐ **CHANGED**
   - Password: `<your_existing_password>` (unchanged)

### Example

If you previously logged in with:
- Username: `ps_5373`
- Password: `MyPassword123`

You should now login with:
- Username: `mo_5373` ⭐ **NEW**
- Password: `MyPassword123` (same as before)

### What Stays the Same?

✅ Your password remains unchanged  
✅ Your role and permissions remain unchanged  
✅ Your assigned mandal remains unchanged  
✅ All your data and settings remain unchanged  
✅ Only the username format has changed

## Technical Details

### Database Changes
- Updated `User` table: `username` field for all PANCHAYAT_SECRETARY role users
- No changes to passwords, roles, or permissions
- No changes to data access or functionality

### Code Changes
- Updated seed script to use `mo_` prefix
- Updated user creation scripts to use `mo_` prefix
- Updated test scripts to use new username format
- Updated documentation and comments

### Routes Updated
- Dashboard: `/mandal-officer` (previously `/panchayat`)
- Field Officers: `/mandal-officer/officers` (previously `/panchayat/officers`)
- API endpoints: `/api/mandal-officer/*` (previously `/api/panchayat/*`)

## Troubleshooting

### "Invalid username or password" Error

**Problem:** You're trying to login with your old username.

**Solution:** Use your new username with the `mo_` prefix instead of `ps_`.

**Example:**
- ❌ Wrong: `ps_chittoor`
- ✅ Correct: `mo_chittoor`

### "User not found" Error

**Problem:** You might be using an incorrect mandal code.

**Solution:** Check the table above for your correct new username, or contact your administrator.

### Password Issues

**Problem:** Your password doesn't work.

**Solution:** 
1. Make sure you're using your existing password (passwords were NOT changed)
2. If you forgot your password, contact your administrator for a password reset
3. For the default seed user (`mo_chittoor`), the new password is `MandalOfficer@123`

## Support

If you encounter any issues with the username change:

1. **Verify** you're using the correct new username format (`mo_<code>`)
2. **Check** the table above for your specific username
3. **Contact** your system administrator if problems persist

## Migration Script

For administrators who need to run the migration again or on a different environment:

```bash
npx tsx scripts/migrate-mo-usernames.ts
```

This script will:
1. Find all Mandal Officers with `ps_` prefix
2. Check for username conflicts
3. Update usernames from `ps_*` to `mo_*`
4. Provide a detailed summary of changes

## Related Changes

This username format change is part of a larger rebranding effort:

1. ✅ Role display name changed from "Panchayat Secretary" to "Mandal Officer"
2. ✅ Routes updated from `/panchayat` to `/mandal-officer`
3. ✅ API endpoints updated from `/api/panchayat` to `/api/mandal-officer`
4. ✅ Username format updated from `ps_*` to `mo_*`

## Version History

- **v1.0** - December 2024: Initial username format change from `ps_*` to `mo_*`

---

**Last Updated:** December 2024  
**Applies To:** All Mandal Officer users in Chittoor Health System

