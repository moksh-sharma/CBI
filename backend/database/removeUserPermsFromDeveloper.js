/**
 * Remove user management permissions from Developer role
 * Run this script to restrict user management to Admin only
 */

const pool = require('./db');

async function removeUserPermsFromDeveloper() {
    try {
        // Remove user management permissions from Developer role (role_id = 2)
        const [result] = await pool.query(
            `DELETE FROM role_permissions 
             WHERE role_id = 2 
             AND permission_id IN (
                 SELECT id FROM permissions 
                 WHERE name IN ('users.create', 'users.read', 'users.update', 'users.delete')
             )`
        );
        
        console.log(`✓ Removed user management permissions from Developer role`);
        console.log(`  Affected rows: ${result.affectedRows}`);
        
        process.exit(0);
    } catch (error) {
        console.error('✗ Error removing permissions:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    removeUserPermsFromDeveloper();
}

module.exports = removeUserPermsFromDeveloper;
