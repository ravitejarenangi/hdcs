#!/bin/bash

# Test Export Functionality
# This script tests both Excel and CSV export endpoints

echo "=========================================="
echo "Testing Export Functionality"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Login as admin
echo "Test 1: Login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123"}' \
  -c cookies.txt)

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
else
  echo -e "${RED}✗ Login failed${NC}"
  exit 1
fi

echo ""

# Test 2: Test Excel Export (without authentication - should fail)
echo "Test 2: Test Excel Export without authentication (should fail with 401)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/export/excel)

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly returned 401 Unauthorized${NC}"
else
  echo -e "${RED}✗ Expected 401, got $HTTP_CODE${NC}"
fi

echo ""

# Test 3: Test CSV Export (without authentication - should fail)
echo "Test 3: Test CSV Export without authentication (should fail with 401)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/export/csv)

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly returned 401 Unauthorized${NC}"
else
  echo -e "${RED}✗ Expected 401, got $HTTP_CODE${NC}"
fi

echo ""

# Test 4: Test Excel Export with authentication
echo "Test 4: Test Excel Export with authentication..."
curl -s -b cookies.txt http://localhost:3000/api/admin/export/excel -o test_export.xlsx

if [ -f "test_export.xlsx" ]; then
  FILE_SIZE=$(stat -f%z test_export.xlsx 2>/dev/null || stat -c%s test_export.xlsx 2>/dev/null)
  if [ "$FILE_SIZE" -gt 1000 ]; then
    echo -e "${GREEN}✓ Excel file downloaded successfully (${FILE_SIZE} bytes)${NC}"
    
    # Check if it's a valid Excel file
    FILE_TYPE=$(file test_export.xlsx | grep -o "Microsoft Excel" || echo "Unknown")
    if [ "$FILE_TYPE" = "Microsoft Excel" ]; then
      echo -e "${GREEN}✓ File is a valid Excel file${NC}"
    else
      echo -e "${YELLOW}⚠ File type: $(file test_export.xlsx)${NC}"
    fi
  else
    echo -e "${RED}✗ File too small (${FILE_SIZE} bytes)${NC}"
  fi
else
  echo -e "${RED}✗ Excel file not downloaded${NC}"
fi

echo ""

# Test 5: Test CSV Export with authentication
echo "Test 5: Test CSV Export with authentication..."
curl -s -b cookies.txt http://localhost:3000/api/admin/export/csv -o test_export.csv

if [ -f "test_export.csv" ]; then
  FILE_SIZE=$(stat -f%z test_export.csv 2>/dev/null || stat -c%s test_export.csv 2>/dev/null)
  if [ "$FILE_SIZE" -gt 100 ]; then
    echo -e "${GREEN}✓ CSV file downloaded successfully (${FILE_SIZE} bytes)${NC}"
    
    # Check first few lines
    echo -e "${YELLOW}First 3 lines of CSV:${NC}"
    head -3 test_export.csv
    
    # Count rows
    ROW_COUNT=$(wc -l < test_export.csv)
    echo -e "${GREEN}✓ CSV has ${ROW_COUNT} rows (including header)${NC}"
  else
    echo -e "${RED}✗ File too small (${FILE_SIZE} bytes)${NC}"
  fi
else
  echo -e "${RED}✗ CSV file not downloaded${NC}"
fi

echo ""

# Test 6: Test with Field Officer credentials (should fail with 403)
echo "Test 6: Test with Field Officer credentials (should fail with 403)..."
curl -s -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "field_officer_1", "password": "Field@123"}' \
  -c cookies_fo.txt > /dev/null

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b cookies_fo.txt http://localhost:3000/api/admin/export/excel)

if [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}✓ Correctly returned 403 Forbidden for Field Officer${NC}"
else
  echo -e "${RED}✗ Expected 403, got $HTTP_CODE${NC}"
fi

echo ""

# Cleanup
echo "Cleaning up test files..."
rm -f cookies.txt cookies_fo.txt

echo ""
echo "=========================================="
echo "Export Functionality Tests Complete"
echo "=========================================="
echo ""
echo "Downloaded files:"
ls -lh test_export.xlsx test_export.csv 2>/dev/null || echo "No files downloaded"
echo ""
echo "To manually test in browser:"
echo "1. Login as admin at http://localhost:3000/login"
echo "2. Navigate to http://localhost:3000/admin/reports"
echo "3. Click 'Export Excel' or 'Export CSV' buttons"
echo ""

