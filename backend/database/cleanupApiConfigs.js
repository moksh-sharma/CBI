/**
 * Cleanup Script: Remove all API configurations and related datasets
 * This will clean up all API-related data so you can start fresh
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('./db');

async function cleanupApiConfigs() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log('🧹 Starting cleanup of API configurations and datasets...\n');

        // 1. Delete all datasets that use API sources
        const [apiDatasets] = await connection.query(
            `SELECT id, name FROM datasets WHERE source_type = 'api'`
        );
        
        if (apiDatasets.length > 0) {
            console.log(`📊 Found ${apiDatasets.length} API dataset(s) to delete:`);
            apiDatasets.forEach(ds => {
                console.log(`   - ${ds.name} (ID: ${ds.id})`);
            });
            
            await connection.query(
                `DELETE FROM datasets WHERE source_type = 'api'`
            );
            console.log(`✓ Deleted ${apiDatasets.length} API dataset(s)\n`);
        } else {
            console.log('✓ No API datasets found\n');
        }

        // 2. Delete all API configurations
        const [apiConfigs] = await connection.query(
            `SELECT id, name FROM api_configurations`
        );
        
        if (apiConfigs.length > 0) {
            console.log(`🔧 Found ${apiConfigs.length} API configuration(s) to delete:`);
            apiConfigs.forEach(config => {
                console.log(`   - ${config.name} (ID: ${config.id})`);
            });
            
            await connection.query(
                `DELETE FROM api_configurations`
            );
            console.log(`✓ Deleted ${apiConfigs.length} API configuration(s)\n`);
        } else {
            console.log('✓ No API configurations found\n');
        }

        await connection.commit();
        console.log('✅ Cleanup completed successfully!');
        console.log('\nYou can now create new API configurations from the Admin Panel.');
        
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
        await pool.end();
        process.exit(0);
    }
}

// Run cleanup
cleanupApiConfigs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
