const pool = require('../database/db');

pool.query('SHOW TABLES')
    .then(([rows]) => {
        console.log('✓ Tables created:', rows.length);
        if (rows.length > 0) {
            console.log('\nTables:');
            rows.forEach(r => console.log('  -', Object.values(r)[0]));
        } else {
            console.log('⚠️  No tables found - database needs initialization');
        }
        process.exit(0);
    })
    .catch(err => {
        console.error('✗ Error:', err.message);
        process.exit(1);
    });
