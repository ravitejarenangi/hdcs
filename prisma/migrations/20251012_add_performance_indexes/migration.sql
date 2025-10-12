-- Migration: Add Performance Indexes
-- Date: 2025-10-12
-- Purpose: Optimize database performance for Chittoor Health System
-- Impact: Improves query performance for dashboards, analytics, and search operations

-- ============================================================================
-- RESIDENT TABLE INDEXES
-- ============================================================================

-- Index on phcName (frequently used in filters, groupBy, and analytics)
-- Used in: PHC-based filtering, PHC distribution analytics, dashboard queries
CREATE INDEX IF NOT EXISTS `idx_residents_phc_name` ON `residents`(`phc_name`);

-- Index on mobileNumber (used in search queries and completion rate calculations)
-- Used in: Mobile number search, duplicate detection, completion analytics
CREATE INDEX IF NOT EXISTS `idx_residents_mobile_number` ON `residents`(`mobile_number`);

-- Index on healthId (used in search queries and completion rate calculations)
-- Used in: Health ID search, duplicate detection, completion analytics
CREATE INDEX IF NOT EXISTS `idx_residents_health_id` ON `residents`(`health_id`);

-- Index on name (used in search queries with startsWith for placeholder detection)
-- Used in: Name search, placeholder filtering (UNKNOWN_NAME_*)
CREATE INDEX IF NOT EXISTS `idx_residents_name` ON `residents`(`name`);

-- Index on gender (used in analytics groupBy for demographic analysis)
-- Used in: Gender distribution analytics, demographic reports
CREATE INDEX IF NOT EXISTS `idx_residents_gender` ON `residents`(`gender`);

-- Index on villageName (if used in filtering - currently not in schema but may be added)
-- Note: This is commented out as villageName is not in current schema
-- CREATE INDEX IF NOT EXISTS `idx_residents_village_name` ON `residents`(`village_name`);

-- Composite index on (mandalName, secName) - very common combination
-- Used in: Mandal-Secretariat filtering, hierarchical analytics, dashboard queries
-- This is the most important composite index as this combination is used extensively
CREATE INDEX IF NOT EXISTS `idx_residents_mandal_sec` ON `residents`(`mandal_name`, `sec_name`);

-- Composite index on (mandalName, phcName) - used in PHC analytics per mandal
-- Used in: PHC distribution by mandal, mandal-level PHC analytics
CREATE INDEX IF NOT EXISTS `idx_residents_mandal_phc` ON `residents`(`mandal_name`, `phc_name`);

-- Composite index on (secName, phcName) - used in secretariat-level PHC analytics
-- Used in: PHC assignment verification, secretariat-level analytics
CREATE INDEX IF NOT EXISTS `idx_residents_sec_phc` ON `residents`(`sec_name`, `phc_name`);

-- Index on hhId (already exists in schema but ensuring it's optimized)
-- Note: This index already exists from schema.prisma @@index([hhId])
-- Used in: Household-based queries, family grouping

-- Index on createdAt (useful for time-based queries and recent records)
-- Used in: Recent additions, time-based analytics, audit queries
CREATE INDEX IF NOT EXISTS `idx_residents_created_at` ON `residents`(`created_at`);

-- Index on updatedAt (useful for tracking recent updates)
-- Used in: Recent updates, change tracking, sync operations
CREATE INDEX IF NOT EXISTS `idx_residents_updated_at` ON `residents`(`updated_at`);

-- ============================================================================
-- USER TABLE INDEXES
-- ============================================================================

-- Index on role (frequently used in filtering users by role)
-- Used in: Role-based filtering, user management, access control
CREATE INDEX IF NOT EXISTS `idx_users_role` ON `users`(`role`);

-- Index on isActive (used in filtering active/inactive users)
-- Used in: Active user filtering, user management, authentication
CREATE INDEX IF NOT EXISTS `idx_users_is_active` ON `users`(`is_active`);

-- Composite index on (role, mandalName) - used for role-based mandal filtering
-- Used in: Finding field officers for a mandal, role-based mandal queries
CREATE INDEX IF NOT EXISTS `idx_users_role_mandal` ON `users`(`role`, `mandal_name`);

-- Composite index on (role, isActive) - used for active users by role
-- Used in: Active field officers, active panchayat secretaries
CREATE INDEX IF NOT EXISTS `idx_users_role_active` ON `users`(`role`, `is_active`);

-- Index on lastLogin (useful for tracking user activity)
-- Used in: Last login tracking, inactive user detection
CREATE INDEX IF NOT EXISTS `idx_users_last_login` ON `users`(`last_login`);

-- ============================================================================
-- UPDATE_LOG TABLE INDEXES
-- ============================================================================

-- Index on residentId (foreign key, frequently used in joins and filters)
-- Used in: Resident update history, audit trails, change tracking
CREATE INDEX IF NOT EXISTS `idx_update_logs_resident_id` ON `update_logs`(`resident_id`);

-- Index on userId (foreign key, frequently used in joins and filters)
-- Used in: User activity tracking, audit by user, change attribution
CREATE INDEX IF NOT EXISTS `idx_update_logs_user_id` ON `update_logs`(`user_id`);

-- Index on fieldUpdated (used in filtering updates by field)
-- Used in: Field-specific update history, tracking specific field changes
CREATE INDEX IF NOT EXISTS `idx_update_logs_field_updated` ON `update_logs`(`field_updated`);

-- Composite index on (residentId, updateTimestamp) - common query pattern
-- Used in: Resident update history ordered by time, recent changes per resident
CREATE INDEX IF NOT EXISTS `idx_update_logs_resident_time` ON `update_logs`(`resident_id`, `update_timestamp`);

-- Composite index on (userId, updateTimestamp) - user activity tracking
-- Used in: User activity history, user productivity tracking
CREATE INDEX IF NOT EXISTS `idx_update_logs_user_time` ON `update_logs`(`user_id`, `update_timestamp`);

-- ============================================================================
-- IMPORT_LOG TABLE INDEXES
-- ============================================================================

-- Index on userId (track imports by user)
-- Used in: User import history, import attribution
CREATE INDEX IF NOT EXISTS `idx_import_logs_user_id` ON `import_logs`(`user_id`);

-- Index on status (filter imports by status)
-- Used in: Failed import tracking, success rate analytics
CREATE INDEX IF NOT EXISTS `idx_import_logs_status` ON `import_logs`(`status`);

-- Index on importMode (filter imports by mode)
-- Used in: Import mode analytics, operation type tracking
CREATE INDEX IF NOT EXISTS `idx_import_logs_import_mode` ON `import_logs`(`import_mode`);

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- Expected Performance Improvements:
-- 1. Dashboard analytics queries: 50-80% faster
-- 2. Search queries (mobile, health ID, name): 70-90% faster
-- 3. Mandal-Secretariat filtering: 60-80% faster
-- 4. PHC-based analytics: 70-85% faster
-- 5. User authentication: Already fast (username is unique)
-- 6. Role-based filtering: 50-70% faster
-- 7. Update log queries: 60-80% faster

-- Index Size Estimates (for 2M+ residents):
-- - Single column indexes: ~20-50 MB each
-- - Composite indexes: ~40-100 MB each
-- - Total additional storage: ~500-800 MB
-- - Trade-off: Slightly slower writes, much faster reads (acceptable for read-heavy app)

-- Maintenance:
-- - MySQL automatically maintains indexes
-- - Consider running OPTIMIZE TABLE periodically for large tables
-- - Monitor index usage with EXPLAIN queries
-- - Remove unused indexes if identified

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- After applying this migration, verify indexes with:
-- SHOW INDEXES FROM residents;
-- SHOW INDEXES FROM users;
-- SHOW INDEXES FROM update_logs;
-- SHOW INDEXES FROM import_logs;

-- Test query performance with EXPLAIN:
-- EXPLAIN SELECT * FROM residents WHERE mandal_name = 'CHITTOOR' AND sec_name = 'LALUGARDEN-01';
-- EXPLAIN SELECT * FROM residents WHERE phc_name = 'G.D.Nellore';
-- EXPLAIN SELECT * FROM residents WHERE mobile_number = '9876543210';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback this migration, drop the indexes:
-- DROP INDEX `idx_residents_phc_name` ON `residents`;
-- DROP INDEX `idx_residents_mobile_number` ON `residents`;
-- DROP INDEX `idx_residents_health_id` ON `residents`;
-- DROP INDEX `idx_residents_name` ON `residents`;
-- DROP INDEX `idx_residents_gender` ON `residents`;
-- DROP INDEX `idx_residents_mandal_sec` ON `residents`;
-- DROP INDEX `idx_residents_mandal_phc` ON `residents`;
-- DROP INDEX `idx_residents_sec_phc` ON `residents`;
-- DROP INDEX `idx_residents_created_at` ON `residents`;
-- DROP INDEX `idx_residents_updated_at` ON `residents`;
-- DROP INDEX `idx_users_role` ON `users`;
-- DROP INDEX `idx_users_is_active` ON `users`;
-- DROP INDEX `idx_users_role_mandal` ON `users`;
-- DROP INDEX `idx_users_role_active` ON `users`;
-- DROP INDEX `idx_users_last_login` ON `users`;
-- DROP INDEX `idx_update_logs_resident_id` ON `update_logs`;
-- DROP INDEX `idx_update_logs_user_id` ON `update_logs`;
-- DROP INDEX `idx_update_logs_field_updated` ON `update_logs`;
-- DROP INDEX `idx_update_logs_resident_time` ON `update_logs`;
-- DROP INDEX `idx_update_logs_user_time` ON `update_logs`;
-- DROP INDEX `idx_import_logs_user_id` ON `import_logs`;
-- DROP INDEX `idx_import_logs_status` ON `import_logs`;
-- DROP INDEX `idx_import_logs_import_mode` ON `import_logs`;

