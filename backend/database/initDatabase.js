/**
 * Database Initialization Script
 * Creates database schema and inserts default admin user
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bi_platform',
    multipleStatements: true
};

async function initDatabase() {
    let connection;
    
    try {
        // Connect without database first to create it
        const tempConfig = { ...DB_CONFIG };
        delete tempConfig.database;
        connection = await mysql.createConnection(tempConfig);
        
        console.log('Creating database...');
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database}`);
        await connection.query(`USE ${DB_CONFIG.database}`);
        
        console.log('Reading schema file...');
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Executing schema...');
        await connection.query(schema);
        
        console.log('Creating default admin user...');
        const adminPassword = 'Admin123!';
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        
        // Check if admin exists
        const [existing] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            ['admin@biplatform.com']
        );
        
        if (existing.length === 0) {
            await connection.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['admin@biplatform.com', passwordHash, 'System', 'Administrator', 1]
            );
            console.log('✓ Default admin user created');
            console.log('  Email: admin@biplatform.com');
            console.log('  Password: Admin123!');
        } else {
            console.log('✓ Admin user already exists');
        }
        
        console.log('\n✓ Database initialization completed successfully!');
        
    } catch (error) {
        console.error('✗ Database initialization failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run if called directly
if (require.main === module) {
    initDatabase();
}

module.exports = initDatabase;
