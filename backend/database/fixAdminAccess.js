/**
 * Fix Admin Access Script
 * Ensures admin user has proper role_id and all necessary permissions
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('./db');

async function fixAdminAccess() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log('🔧 Fixing admin access...\n');

        // 1. Check admin role
        const [adminRoles] = await connection.query(
            `SELECT id, name FROM roles WHERE name = 'admin' OR name = 'Admin' OR name = 'ADMIN'`
        );
        
        if (adminRoles.length === 0) {
            console.log('❌ Admin role not found! Creating...');
            await connection.query(
                `INSERT INTO roles (name, description) VALUES ('admin', 'Administrator with full access')`
            );
            const [newRole] = await connection.query(`SELECT id FROM roles WHERE name = 'admin'`);
            console.log(`✓ Created admin role with ID: ${newRole[0].id}`);
        } else {
            console.log(`✓ Admin role found: ID ${adminRoles[0].id}, Name: ${adminRoles[0].name}`);
        }
        
        const adminRoleId = adminRoles[0]?.id || (await connection.query(`SELECT id FROM roles WHERE name = 'admin'`))[0][0].id;

        // 2. Check admin user
        const [adminUsers] = await connection.query(
            `SELECT id, email, role_id FROM users WHERE email = 'admin@example.com' OR role_id = ?`,
            [adminRoleId]
        );
        
        if (adminUsers.length === 0) {
            console.log('❌ Admin user not found!');
        } else {
            console.log(`✓ Found ${adminUsers.length} admin user(s):`);
            adminUsers.forEach(user => {
                console.log(`   - ${user.email} (ID: ${user.id}, Role ID: ${user.role_id})`);
            });
            
            // Update all admin users to have correct role_id
            for (const user of adminUsers) {
                if (user.role_id !== adminRoleId) {
                    await connection.query(
                        `UPDATE users SET role_id = ? WHERE id = ?`,
                        [adminRoleId, user.id]
                    );
                    console.log(`✓ Updated ${user.email} role_id to ${adminRoleId}`);
                }
            }
        }

        // 3. Ensure api.config permission exists
        const [apiConfigPerms] = await connection.query(
            `SELECT id, name FROM permissions WHERE name = 'api.config'`
        );
        
        if (apiConfigPerms.length === 0) {
            console.log('❌ api.config permission not found! Creating...');
            await connection.query(
                `INSERT INTO permissions (name, description) VALUES ('api.config', 'Configure API data sources')`
            );
            console.log('✓ Created api.config permission');
        } else {
            console.log(`✓ api.config permission found: ID ${apiConfigPerms[0].id}`);
        }
        
        const apiConfigPermId = apiConfigPerms[0]?.id || (await connection.query(`SELECT id FROM permissions WHERE name = 'api.config'`))[0][0].id;

        // 4. Ensure admin role has api.config permission
        const [existingPerms] = await connection.query(
            `SELECT role_id, permission_id FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
            [adminRoleId, apiConfigPermId]
        );
        
        if (existingPerms.length === 0) {
            console.log('❌ Admin role missing api.config permission! Adding...');
            await connection.query(
                `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
                [adminRoleId, apiConfigPermId]
            );
            console.log('✓ Added api.config permission to admin role');
        } else {
            console.log('✓ Admin role already has api.config permission');
        }

        // 5. Add all other important permissions to admin
        const importantPerms = [
            'data.upload',
            'data.read',
            'dashboards.create',
            'dashboards.read',
            'dashboards.update',
            'dashboards.delete',
            'users.create',
            'users.read',
            'users.update',
            'users.delete',
            'audit.read'
        ];
        
        for (const permName of importantPerms) {
            const [perm] = await connection.query(`SELECT id FROM permissions WHERE name = ?`, [permName]);
            if (perm.length > 0) {
                const [existing] = await connection.query(
                    `SELECT role_id FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
                    [adminRoleId, perm[0].id]
                );
                if (existing.length === 0) {
                    await connection.query(
                        `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
                        [adminRoleId, perm[0].id]
                    );
                    console.log(`✓ Added ${permName} permission to admin role`);
                }
            }
        }

        await connection.commit();
        console.log('\n✅ Admin access fixed successfully!');
        console.log('\nAdmin users should now have full access to all API configurations.');
        
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ Error fixing admin access:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
        await pool.end();
        process.exit(0);
    }
}

// Run fix
fixAdminAccess().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
