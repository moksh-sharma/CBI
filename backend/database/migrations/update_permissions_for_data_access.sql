-- Migration: Update permissions to allow all users to fetch data and access APIs
-- This ensures developers and viewers can read API configs and fetch data

-- Give developers api.config permission (for creating/editing API configs)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name = 'api.config'
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Give viewers data.read permission (for viewing datasets and API data in dashboards)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name = 'data.read'
ON DUPLICATE KEY UPDATE role_id=role_id;
