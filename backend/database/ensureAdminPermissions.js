/**
 * Script to ensure admin role has all permissions
 * Run this if admin users are missing permissions
 */

const pool = require('./db');
require('dotenv').config();

async function ensureAdminPermissions() {
    try {
        console.log('Checking admin permissions...');
        
        // Get admin role ID
        const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', ['admin']);
        if (roles.length === 0) {
            console.error('Admin role not found!');
            process.exit(1);
        }
        const adminRoleId = roles[0].id;
        console.log(`Admin role ID: ${adminRoleId}`);
        
        // Get all permissions
        const [permissions] = await pool.query('SELECT id, name FROM permissions');
        console.log(`Found ${permissions.length} permissions`);
        
        // Assign all permissions to admin role
        for (const permission of permissions) {
            await pool.query(
                `INSERT INTO role_permissions (role_id, permission_id) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE role_id=role_id`,
                [adminRoleId, permission.id]
            );
            console.log(`✓ Assigned permission: ${permission.name}`);
        }
        
        // Verify api.config permission
        const [apiConfigPerm] = await pool.query(
            `SELECT rp.*, p.name as permission_name 
             FROM role_permissions rp
             JOIN permissions p ON rp.permission_id = p.id
             WHERE rp.role_id = ? AND p.name = 'api.config'`,
            [adminRoleId]
        );
        
        if (apiConfigPerm.length > 0) {
            console.log('\n✓ Admin role has api.config permission');
        } else {
            console.log('\n✗ Admin role is missing api.config permission');
        }
        
        console.log('\n✓ Admin permissions updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error ensuring admin permissions:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    ensureAdminPermissions().then(() => {
        pool.end();
    });
}

module.exports = ensureAdminPermissions;
