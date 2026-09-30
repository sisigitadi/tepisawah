-- =============================================================================
-- Tepi Sawah — Migration 001: Extensions
--
-- Source: docs/database/DATABASE_MIGRATION_PLAN.md §6
--
-- Only enable extensions actually needed by the schema. pgcrypto provides the
-- gen_random_uuid() default used by every table PK.
-- =============================================================================

create extension if not exists "pgcrypto";
