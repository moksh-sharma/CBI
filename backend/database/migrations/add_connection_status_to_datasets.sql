-- Migration: Add connection_status and last_error columns to datasets table
-- Run this if your datasets table doesn't have these columns

ALTER TABLE datasets 
ADD COLUMN IF NOT EXISTS connection_status ENUM('connected', 'error', 'disconnected') DEFAULT NULL COMMENT 'Connection status for API data sources',
ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT NULL COMMENT 'Last error message if connection failed';
