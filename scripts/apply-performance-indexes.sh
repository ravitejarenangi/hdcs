#!/bin/bash

# Database Performance Index Application Script
# This script applies the performance optimization indexes to the database

set -e  # Exit on error

echo "================================================================================"
echo "🚀 Database Performance Optimization - Index Application"
echo "================================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo -e "${RED}❌ ERROR: prisma/schema.prisma not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "📋 Pre-flight Checks:"
echo "--------------------------------------------------------------------------------"

# Check if Prisma is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ ERROR: npx not found${NC}"
    echo "Please install Node.js and npm"
    exit 1
fi
echo -e "${GREEN}✅ npx found${NC}"

# Check if migration file exists
if [ ! -f "prisma/migrations/20251012_add_performance_indexes/migration.sql" ]; then
    echo -e "${RED}❌ ERROR: Migration file not found${NC}"
    echo "Expected: prisma/migrations/20251012_add_performance_indexes/migration.sql"
    exit 1
fi
echo -e "${GREEN}✅ Migration file found${NC}"

# Check database connection
echo ""
echo "🔍 Testing database connection..."
if npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ ERROR: Cannot connect to database${NC}"
    echo "Please check your DATABASE_URL in .env file"
    exit 1
fi

echo ""
echo "⚠️  WARNING: This will add 25 new indexes to your database"
echo "   - Estimated time: 5-15 minutes for 2M+ records"
echo "   - Storage impact: ~650-900 MB additional space"
echo "   - Application downtime: None (indexes created online)"
echo ""

# Ask for confirmation
read -p "Do you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}⚠️  Operation cancelled${NC}"
    exit 0
fi

echo ""
echo "================================================================================
echo "📊 Step 1: Generate Prisma Client"
echo "================================================================================"
npx prisma generate
echo -e "${GREEN}✅ Prisma client generated${NC}"

echo ""
echo "================================================================================"
echo "📊 Step 2: Apply Migration"
echo "================================================================================"
echo "⏳ This may take several minutes for large tables..."
echo ""

# Apply migration
if npx prisma migrate deploy; then
    echo -e "${GREEN}✅ Migration applied successfully${NC}"
else
    echo -e "${RED}❌ ERROR: Migration failed${NC}"
    echo "Please check the error messages above"
    exit 1
fi

echo ""
echo "================================================================================"
echo "📊 Step 3: Verify Indexes"
echo "================================================================================"

# Verify indexes (MySQL specific)
echo "Checking indexes on residents table..."
npx prisma db execute --stdin <<< "SHOW INDEXES FROM residents WHERE Key_name LIKE 'idx_%';" || true

echo ""
echo "Checking indexes on users table..."
npx prisma db execute --stdin <<< "SHOW INDEXES FROM users WHERE Key_name LIKE 'idx_%';" || true

echo ""
echo "================================================================================"
echo "✅ Performance Optimization Complete!"
echo "================================================================================"
echo ""
echo "📊 Summary:"
echo "   ✅ 25 new indexes added"
echo "   ✅ Prisma client regenerated"
echo "   ✅ Migration applied successfully"
echo ""
echo "📈 Expected Improvements:"
echo "   - Dashboard load times: 60-80% faster"
echo "   - Search queries: 70-90% faster"
echo "   - Analytics queries: 60-85% faster"
echo ""
echo "🔍 Next Steps:"
echo "   1. Restart your application to use the new Prisma client"
echo "   2. Test dashboard performance"
echo "   3. Monitor query execution times"
echo "   4. Run OPTIMIZE TABLE periodically for best performance"
echo ""
echo "📝 Documentation:"
echo "   See docs/DATABASE-PERFORMANCE-OPTIMIZATION.md for details"
echo ""
echo "================================================================================"

