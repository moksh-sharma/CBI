-- Remove user management permissions from Developer role
-- This script removes users.read permission from developers

DELETE FROM role_permissions 
WHERE role_id = 2 
AND permission_id IN (
    SELECT id FROM permissions 
    WHERE name IN ('users.create', 'users.read', 'users.update', 'users.delete')
);
