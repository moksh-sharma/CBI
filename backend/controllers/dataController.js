/**
 * Data Controller
 * Handles Excel upload, parsing, and dataset management
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const pool = require('../database/db');
const { validationResult } = require('express-validator');

/**
 * Upload and parse Excel file
 */
const uploadExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No file uploaded' 
            });
        }
        
        const { name, description } = req.body;
        const file = req.file;
        
        // Read Excel file
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        if (data.length === 0) {
            // Clean up uploaded file
            await fs.unlink(file.path);
            return res.status(400).json({ 
                success: false, 
                message: 'Excel file is empty or has no data rows' 
            });
        }
        
        // Get column names and infer types
        const columns = Object.keys(data[0]);
        const schemaDefinition = columns.map(col => {
            // Sample first few rows to infer type
            const sampleValues = data.slice(0, 10).map(row => row[col]).filter(v => v !== null && v !== undefined);
            let type = 'string';
            
            if (sampleValues.length > 0) {
                const firstValue = sampleValues[0];
                if (!isNaN(firstValue) && firstValue !== '') {
                    type = 'number';
                } else if (firstValue.match(/^\d{4}-\d{2}-\d{2}/) || firstValue.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                    type = 'date';
                }
            }
            
            return {
                name: col,
                type: type
            };
        });
        
        // Create dataset record
        const [datasetResult] = await pool.query(
            `INSERT INTO datasets (name, description, source_type, source_config, schema_definition, row_count, created_by) 
             VALUES (?, ?, 'excel', ?, ?, ?, ?)`,
            [
                name || file.originalname,
                description || null,
                JSON.stringify({ file_path: file.path, original_filename: file.originalname }),
                JSON.stringify(schemaDefinition),
                data.length,
                req.user.id
            ]
        );
        
        const datasetId = datasetResult.insertId;
        
        // Store Excel upload metadata
        await pool.query(
            `INSERT INTO excel_upload_metadata 
             (dataset_id, original_filename, file_path, file_size, mime_type, uploaded_by) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                datasetId,
                file.originalname,
                file.path,
                file.size,
                file.mimetype,
                req.user.id
            ]
        );
        
        // Store data rows in batches
        const batchSize = 1000;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const values = batch.map(row => [datasetId, JSON.stringify(row)]);
            
            await pool.query(
                `INSERT INTO dataset_data (dataset_id, row_data) VALUES ?`,
                [values]
            );
        }
        
        // Fetch created dataset
        const [datasets] = await pool.query(
            `SELECT d.*, u.email as created_by_email
             FROM datasets d
             JOIN users u ON d.created_by = u.id
             WHERE d.id = ?`,
            [datasetId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Excel file uploaded and parsed successfully',
            data: {
                ...datasets[0],
                preview: data.slice(0, 10) // Return first 10 rows as preview
            }
        });
    } catch (error) {
        console.error('Upload Excel error:', error);
        
        // Clean up uploaded file on error
        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (e) {
                console.error('Error cleaning up file:', e);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error uploading and parsing Excel file' 
        });
    }
};

/**
 * Get all datasets
 */
const getDatasets = async (req, res) => {
    try {
        const [datasets] = await pool.query(
            `SELECT d.*, u.email as created_by_email
             FROM datasets d
             JOIN users u ON d.created_by = u.id
             ORDER BY d.created_at DESC`
        );
        
        res.json({ success: true, data: datasets });
    } catch (error) {
        console.error('Get datasets error:', error);
        res.status(500).json({ success: false, message: 'Error fetching datasets' });
    }
};

/**
 * Get dataset by ID
 * For API sources: Fetches live data from API
 * For Excel sources: Fetches from database
 */
const getDatasetById = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;
        
        // Get dataset metadata - include connection_status and last_error
        const [datasets] = await pool.query(
            `SELECT d.*, u.email as created_by_email
             FROM datasets d
             JOIN users u ON d.created_by = u.id
             WHERE d.id = ?`,
            [id]
        );
        
        if (datasets.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Dataset not found' 
            });
        }
        
        const dataset = datasets[0];
        
        // If source is API, fetch live data from API
        if (dataset.source_type === 'api') {
            try {
                const axios = require('axios');
                const sourceConfig = typeof dataset.source_config === 'string'
                    ? JSON.parse(dataset.source_config)
                    : dataset.source_config;
                
                // Get API configuration
                const [apiConfigs] = await pool.query(
                    'SELECT * FROM api_configurations WHERE id = ? AND is_active = TRUE',
                    [sourceConfig.api_config_id]
                );
                
                if (apiConfigs.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'API configuration not found or inactive'
                    });
                }
                
                const apiConfig = apiConfigs[0];
                
                // Build request
                const url = `${apiConfig.base_url}${apiConfig.endpoint || ''}`;
                
                // Parse headers - MySQL JSON columns might already be objects
                let headers = {};
                if (apiConfig.headers) {
                    try {
                        if (typeof apiConfig.headers === 'string') {
                            if (apiConfig.headers === '[object Object]' || apiConfig.headers.trim() === '') {
                                headers = {};
                            } else {
                                headers = JSON.parse(apiConfig.headers);
                            }
                        } else if (typeof apiConfig.headers === 'object' && apiConfig.headers !== null) {
                            headers = apiConfig.headers;
                        }
                    } catch (e) {
                        console.error('Error parsing headers in getDatasetById:', e);
                        headers = {};
                    }
                }
                
                // Add authentication
                if (apiConfig.auth_type !== 'none' && apiConfig.auth_config) {
                    try {
                        let authConfig;
                        if (typeof apiConfig.auth_config === 'string') {
                            if (apiConfig.auth_config === '[object Object]' || apiConfig.auth_config.trim() === '') {
                                authConfig = {};
                            } else {
                                authConfig = JSON.parse(apiConfig.auth_config);
                            }
                        } else if (typeof apiConfig.auth_config === 'object' && apiConfig.auth_config !== null) {
                            authConfig = apiConfig.auth_config;
                        } else {
                            authConfig = {};
                        }
                        
                        if (authConfig && typeof authConfig === 'object') {
                            if (apiConfig.auth_type === 'bearer' && authConfig.token) {
                                headers['Authorization'] = `Bearer ${authConfig.token}`;
                            } else if (apiConfig.auth_type === 'api_key' && authConfig.key) {
                                headers[authConfig.header_name || 'X-API-Key'] = authConfig.key;
                            } else if (apiConfig.auth_type === 'basic' && authConfig.username && authConfig.password) {
                                const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
                                headers['Authorization'] = `Basic ${credentials}`;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing auth_config in getDatasetById:', e);
                    }
                }
                
                // Use EXACT method and timeout from config - NO defaults
                if (!apiConfig.method || apiConfig.method.trim() === '') {
                    return res.status(400).json({
                        success: false,
                        message: 'HTTP method is required in API configuration'
                    });
                }
                if (!apiConfig.timeout_ms || apiConfig.timeout_ms <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Timeout is required in API configuration'
                    });
                }
                
                // Make live API request - use EXACT config values
                const response = await axios({
                    method: apiConfig.method.trim().toUpperCase(),
                    url: url,
                    headers: headers,
                    timeout: apiConfig.timeout_ms
                });
                
                let allData = response.data;
                
                // Handle different response formats
                if (!Array.isArray(allData)) {
                    if (allData.data && Array.isArray(allData.data)) {
                        allData = allData.data;
                    } else if (allData.meta && allData.data) {
                        // Handle paginated response
                        allData = allData.data;
                    } else {
                        allData = [allData];
                    }
                }
                
                // For API sources, return ALL data (no pagination limit)
                // This ensures users can see all entries from the API
                const total = allData.length;
                
                console.log(`Fetched ${total} records from API for dataset ${id}`);
                
                return res.json({
                    success: true,
                    data: {
                        ...dataset,
                        data: allData, // Return all data, not paginated
                        is_live: true,
                        pagination: {
                            page: 1,
                            limit: total, // Set limit to total to show all
                            total: total,
                            totalPages: 1 // All data on one "page"
                        }
                    }
                });
            } catch (apiError) {
                console.error('Error fetching live API data:', apiError);
                return res.status(500).json({
                    success: false,
                    message: `Error fetching live data from API: ${apiError.message}`
                });
            }
        }
        
        // For Excel sources, fetch from database
        // Get data rows (paginated)
        const [rows] = await pool.query(
            `SELECT row_data FROM dataset_data 
             WHERE dataset_id = ? 
             ORDER BY id 
             LIMIT ? OFFSET ?`,
            [id, parseInt(limit), offset]
        );
        
        // Parse row_data - it might be a string or already an object (MySQL JSON type)
        const data = rows.map(row => {
            if (typeof row.row_data === 'string') {
                try {
                    return JSON.parse(row.row_data);
                } catch (e) {
                    console.error('Error parsing row_data:', e);
                    return {};
                }
            }
            return row.row_data; // Already an object
        });
        
        // Get total count
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM dataset_data WHERE dataset_id = ?',
            [id]
        );
        const total = countResult[0].total;
        
        res.json({
            success: true,
            data: {
                ...dataset,
                data: data,
                is_live: false,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get dataset error:', error);
        res.status(500).json({ success: false, message: 'Error fetching dataset' });
    }
};

/**
 * Delete dataset
 */
const deleteDataset = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get dataset to find file path from multiple sources
        const [datasets] = await pool.query(
            'SELECT source_type, source_config FROM datasets WHERE id = ?',
            [id]
        );
        
        if (datasets.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Dataset not found' 
            });
        }
        
        const dataset = datasets[0];
        let filePath = null;
        
        // Try to get file path from source_config
        if (dataset.source_config) {
            try {
                const sourceConfig = typeof dataset.source_config === 'string' 
                    ? JSON.parse(dataset.source_config) 
                    : dataset.source_config;
                
                if (sourceConfig && sourceConfig.file_path) {
                    filePath = sourceConfig.file_path;
                }
            } catch (e) {
                console.error('Error parsing source_config:', e);
            }
        }
        
        // Also check excel_upload_metadata table for file path
        if (!filePath && dataset.source_type === 'excel') {
            try {
                const [metadata] = await pool.query(
                    'SELECT file_path FROM excel_upload_metadata WHERE dataset_id = ?',
                    [id]
                );
                if (metadata.length > 0 && metadata[0].file_path) {
                    filePath = metadata[0].file_path;
                }
            } catch (e) {
                console.error('Error fetching metadata:', e);
            }
        }
        
        // Delete the physical file if it exists
        if (filePath) {
            try {
                // Resolve absolute path if relative
                const absolutePath = path.isAbsolute(filePath) 
                    ? filePath 
                    : path.join(__dirname, '..', filePath);
                
                // Check if file exists before trying to delete
                if (fsSync.existsSync(absolutePath)) {
                    await fs.unlink(absolutePath);
                    console.log(`✓ Deleted file: ${absolutePath}`);
                } else {
                    // Try original path as well
                    if (fsSync.existsSync(filePath)) {
                        await fs.unlink(filePath);
                        console.log(`✓ Deleted file: ${filePath}`);
                    } else {
                        console.log(`⚠ File not found (may already be deleted): ${absolutePath}`);
                        console.log(`⚠ Also tried: ${filePath}`);
                    }
                }
            } catch (fileError) {
                console.error('Error deleting file:', fileError);
                console.error('File path attempted:', filePath);
                // Don't fail the request if file deletion fails
                // File might not exist or be locked
            }
        } else {
            console.log('⚠ No file path found for dataset deletion');
        }
        
        // Delete dataset (cascade will delete data rows and metadata)
        await pool.query('DELETE FROM datasets WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Dataset and associated file deleted successfully'
        });
    } catch (error) {
        console.error('Delete dataset error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting dataset',
            error: error.message 
        });
    }
};

/**
 * Fetch data from API source (LIVE - no database storage)
 * Only saves the API configuration reference, not the actual data
 */
const fetchApiData = async (req, res) => {
    try {
        const { api_config_id, dataset_name, description } = req.body;
        
        console.log('Fetching API data - Request:', { api_config_id, dataset_name });
        
        if (!api_config_id || !dataset_name) {
            return res.status(400).json({
                success: false,
                message: 'API configuration ID and dataset name are required'
            });
        }
        
        // Get API configuration
        const [configs] = await pool.query(
            'SELECT * FROM api_configurations WHERE id = ? AND is_active = TRUE',
            [api_config_id]
        );
        
        if (configs.length === 0) {
            console.error('API configuration not found or inactive:', api_config_id);
            return res.status(404).json({ 
                success: false, 
                message: 'API configuration not found or inactive' 
            });
        }
        
        const apiConfig = configs[0];
        console.log('API Config found:', { id: apiConfig.id, name: apiConfig.name, base_url: apiConfig.base_url });
        
        const axios = require('axios');
        
        // Build request - use EXACT values from config (NO normalization)
        const url = `${apiConfig.base_url}${apiConfig.endpoint || ''}`;
        
        // Parse headers - use EXACTLY what user configured
        let headers = {};
        if (apiConfig.headers) {
            try {
                if (typeof apiConfig.headers === 'string') {
                    if (apiConfig.headers === '[object Object]' || apiConfig.headers.trim() === '') {
                        headers = {};
                    } else {
                        headers = JSON.parse(apiConfig.headers);
                    }
                } else if (typeof apiConfig.headers === 'object' && apiConfig.headers !== null) {
                    headers = apiConfig.headers;
                }
            } catch (e) {
                console.error('Error parsing headers:', e);
                headers = {};
            }
        }
        
        // NO auto-added headers (like Content-Type)
        
        // Add authentication - use EXACT values from config
        if (apiConfig.auth_type !== 'none' && apiConfig.auth_config) {
            try {
                let authConfig;
                if (typeof apiConfig.auth_config === 'string') {
                    if (apiConfig.auth_config === '[object Object]' || apiConfig.auth_config.trim() === '') {
                        authConfig = {};
                    } else {
                        authConfig = JSON.parse(apiConfig.auth_config);
                    }
                } else if (typeof apiConfig.auth_config === 'object' && apiConfig.auth_config !== null) {
                    authConfig = apiConfig.auth_config;
                } else {
                    authConfig = {};
                }
                
                // Use EXACT header name - NO defaults
                if (authConfig && typeof authConfig === 'object') {
                    if (apiConfig.auth_type === 'bearer' && authConfig.token) {
                        headers['Authorization'] = `Bearer ${authConfig.token}`;
                    } else if (apiConfig.auth_type === 'api_key' && authConfig.key) {
                        // Require header_name - fail if not provided
                        if (!authConfig.header_name) {
                            return res.status(400).json({
                                success: false,
                                message: 'Header name is required for API key authentication. Please update the configuration.'
                            });
                        }
                        headers[authConfig.header_name] = authConfig.key;
                    } else if (apiConfig.auth_type === 'basic' && authConfig.username && authConfig.password) {
                        const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
                        headers['Authorization'] = `Basic ${credentials}`;
                    }
                }
            } catch (e) {
                console.error('Error parsing auth_config:', e);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid authentication configuration'
                });
            }
        }
        
        // Make API request - use EXACT config values (NO defaults)
        console.log('Making API request (EXACT config values, NO defaults):', { 
            method: requestMethod, 
            url, 
            headers: Object.keys(headers),
            timeout: requestTimeout
        });
        
        const response = await axios({
            method: requestMethod,
            url: url,
            headers: headers,
            timeout: requestTimeout,
            validateStatus: () => true // Return exact status - don't throw
        });
        
        // Return EXACT error from external API - no masking
        if (response.status === 401) {
            console.error('External API returned 401 Unauthorized:', {
                url,
                method: requestMethod,
                headers: Object.keys(headers),
                responseStatus: response.status,
                responseData: response.data
            });
            return res.json({
                success: false,
                message: `External API returned 401 Unauthorized`,
                error: 'EXTERNAL_API_UNAUTHORIZED',
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    method: requestMethod,
                    headers: Object.keys(headers),
                    responseData: response.data
                }
            });
        }
        
        if (response.status === 404) {
            console.error('External API returned 404 Not Found:', {
                url,
                method: apiConfig.method || 'GET'
            });
            return res.json({
                success: false,
                message: `External API returned 404 Not Found`,
                error: 'EXTERNAL_API_NOT_FOUND',
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    method: requestMethod,
                    responseData: response.data
                }
            });
        }
        
        if (response.status >= 400) {
            console.error('External API returned error:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            });
            return res.json({
                success: false,
                message: `External API returned ${response.status}: ${response.statusText || 'Error'}`,
                error: 'EXTERNAL_API_ERROR',
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    method: requestMethod,
                    responseData: response.data
                }
            });
        }
        
        console.log('API response received:', { status: response.status, dataLength: Array.isArray(response.data) ? response.data.length : 'not array' });
        
        let data = response.data;
        
        // Handle array response
        if (!Array.isArray(data)) {
            if (data.data && Array.isArray(data.data)) {
                data = data.data;
            } else if (data.meta && data.data) {
                // Handle paginated response like the example API
                data = data.data;
            } else {
                data = [data];
            }
        }
        
        if (data.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'API returned no data' 
            });
        }
        
        // Infer schema from first row
        const columns = Object.keys(data[0]);
        const schemaDefinition = columns.map(col => {
            const sampleValue = data[0][col];
            let type = 'string';
            if (sampleValue !== null && sampleValue !== undefined) {
                if (typeof sampleValue === 'number') {
                    type = 'number';
                } else if (sampleValue instanceof Date || (typeof sampleValue === 'string' && sampleValue.match(/^\d{4}-\d{2}-\d{2}/))) {
                    type = 'date';
                }
            }
            return { name: col, type: type };
        });
        
        // Only save the API configuration reference, NOT the actual data
        // Check if dataset already exists for this API config
        // Handle both JSON string and JSON object types
        console.log('Checking for existing dataset with API config:', apiConfig.id);
        const [existing] = await pool.query(
            `SELECT id FROM datasets 
             WHERE source_type = 'api' 
             AND CAST(JSON_EXTRACT(COALESCE(source_config, '{}'), '$.api_config_id') AS UNSIGNED) = ?`,
            [apiConfig.id]
        );
        
        let datasetId;
        if (existing.length > 0) {
            // Update existing dataset metadata
            datasetId = existing[0].id;
            console.log('Updating existing dataset:', datasetId);
            await pool.query(
                `UPDATE datasets 
                 SET name = ?, description = ?, schema_definition = ?, row_count = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    dataset_name,
                    description || null,
                    JSON.stringify(schemaDefinition),
                    data.length,
                    datasetId
                ]
            );
        } else {
            // Create new dataset record (metadata only, no data storage)
            console.log('Creating new dataset for API config:', apiConfig.id);
            const sourceConfigJson = JSON.stringify({ api_config_id: apiConfig.id });
            const [datasetResult] = await pool.query(
                `INSERT INTO datasets (name, description, source_type, source_config, schema_definition, row_count, created_by) 
                 VALUES (?, ?, 'api', ?, ?, ?, ?)`,
                [
                    dataset_name,
                    description || null,
                    sourceConfigJson,
                    JSON.stringify(schemaDefinition),
                    data.length,
                    req.user.id
                ]
            );
            datasetId = datasetResult.insertId;
            console.log('Dataset created with ID:', datasetId);
        }
        
        // Fetch created/updated dataset
        const [datasets] = await pool.query(
            `SELECT d.*, u.email as created_by_email
             FROM datasets d
             JOIN users u ON d.created_by = u.id
             WHERE d.id = ?`,
            [datasetId]
        );
        
        if (datasets.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Dataset created but could not be retrieved'
            });
        }

        res.status(201).json({
            success: true,
            message: 'API dataset configured successfully (live data, not stored)',
            data: {
                ...datasets[0],
                preview: data.slice(0, 10), // Return preview for immediate display
                is_live: true // Flag to indicate this is live data
            }
        });
    } catch (error) {
        console.error('Fetch API data error:', error);
        console.error('Error stack:', error.stack);
        
        // Provide more helpful error messages
        let errorMessage = 'Error fetching data from API';
        
        if (error.message && error.message.includes('not valid JSON')) {
            errorMessage = 'Invalid JSON configuration in API settings. Please check your API configuration in Admin Panel.';
        } else if (error.response) {
            // Axios error with response
            errorMessage = error.response.data?.message || error.response.statusText || error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            success: false, 
            message: errorMessage
        });
    }
};

/**
 * Refresh API dataset - Test connection and update row count
 */
const refreshApiDataset = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get dataset
        const [datasets] = await pool.query(
            'SELECT * FROM datasets WHERE id = ?',
            [id]
        );
        
        if (datasets.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dataset not found'
            });
        }
        
        const dataset = datasets[0];
        
        // Only refresh API datasets
        if (dataset.source_type !== 'api') {
            return res.status(400).json({
                success: false,
                message: 'Only API datasets can be refreshed'
            });
        }
        
        // Extract api_config_id from source_config
        let sourceConfig;
        try {
            sourceConfig = typeof dataset.source_config === 'string'
                ? JSON.parse(dataset.source_config)
                : dataset.source_config;
        } catch (e) {
            return res.status(400).json({
                success: false,
                message: 'Invalid source configuration'
            });
        }
        
        if (!sourceConfig.api_config_id) {
            return res.status(400).json({
                success: false,
                message: 'API configuration ID not found in dataset'
            });
        }
        
        // Get API configuration
        const [apiConfigs] = await pool.query(
            'SELECT * FROM api_configurations WHERE id = ? AND is_active = TRUE',
            [sourceConfig.api_config_id]
        );
        
        if (apiConfigs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'API configuration not found or inactive',
                status: 'disconnected'
            });
        }
        
        const apiConfig = apiConfigs[0];
        const axios = require('axios');
        
        // Build request - use EXACT values (NO normalization)
        const url = `${apiConfig.base_url}${apiConfig.endpoint || ''}`;
        
        // Parse headers - use EXACTLY what user configured
        let headers = {};
        if (apiConfig.headers) {
            try {
                if (typeof apiConfig.headers === 'string') {
                    if (apiConfig.headers === '[object Object]' || apiConfig.headers.trim() === '') {
                        headers = {};
                    } else {
                        headers = JSON.parse(apiConfig.headers);
                    }
                } else if (typeof apiConfig.headers === 'object' && apiConfig.headers !== null) {
                    headers = apiConfig.headers;
                }
            } catch (e) {
                console.error('Error parsing headers:', e);
                headers = {};
            }
        }
        
        // NO auto-added headers
        
        // Add authentication - use EXACT values (NO defaults)
        if (apiConfig.auth_type !== 'none' && apiConfig.auth_config) {
            try {
                let authConfig;
                if (typeof apiConfig.auth_config === 'string') {
                    if (apiConfig.auth_config === '[object Object]' || apiConfig.auth_config.trim() === '') {
                        authConfig = {};
                    } else {
                        authConfig = JSON.parse(apiConfig.auth_config);
                    }
                } else if (typeof apiConfig.auth_config === 'object' && apiConfig.auth_config !== null) {
                    authConfig = apiConfig.auth_config;
                } else {
                    authConfig = {};
                }
                
                // Use EXACT header name - require it for API key
                if (authConfig && typeof authConfig === 'object') {
                    if (apiConfig.auth_type === 'bearer' && authConfig.token) {
                        headers['Authorization'] = `Bearer ${authConfig.token}`;
                    } else if (apiConfig.auth_type === 'api_key' && authConfig.key) {
                        if (!authConfig.header_name) {
                            return res.json({
                                success: false,
                                message: 'Header name is required for API key authentication. Please update the configuration.',
                                data: {
                                    status: 'error',
                                    error: 'MISSING_HEADER_NAME'
                                }
                            });
                        }
                        headers[authConfig.header_name] = authConfig.key;
                    } else if (apiConfig.auth_type === 'basic' && authConfig.username && authConfig.password) {
                        const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
                        headers['Authorization'] = `Basic ${credentials}`;
                    }
                }
            } catch (e) {
                console.error('Error parsing auth_config:', e);
                return res.json({
                    success: false,
                    message: 'Invalid authentication configuration',
                    data: {
                        status: 'error',
                        error: 'INVALID_AUTH_CONFIG'
                    }
                });
            }
        }
        
        // Use EXACT method from config - NO default fallback
        if (!apiConfig.method || apiConfig.method.trim() === '') {
            return res.json({
                success: false,
                message: 'HTTP method is required in API configuration',
                data: {
                    status: 'error',
                    error: 'MISSING_METHOD'
                }
            });
        }
        const requestMethod = apiConfig.method.trim().toUpperCase();
        
        // Use EXACT timeout from config - NO default fallback
        if (!apiConfig.timeout_ms || apiConfig.timeout_ms <= 0) {
            return res.json({
                success: false,
                message: 'Timeout is required in API configuration',
                data: {
                    status: 'error',
                    error: 'MISSING_TIMEOUT'
                }
            });
        }
        const requestTimeout = apiConfig.timeout_ms;
        
        // Make API request to test connection and get data - use EXACT values (NO defaults)
        let data = [];
        let rowCount = 0;
        let errorMessage = null;
        
        console.log('Refreshing API dataset - Making request (EXACT values, NO defaults):', { 
            method: requestMethod, 
            url, 
            headers: Object.keys(headers),
            timeout: requestTimeout,
            hasAuth: !!headers['Authorization'] || Object.keys(headers).some(k => k.toLowerCase().includes('api') || k.toLowerCase().includes('key'))
        });
        
        try {
            const response = await axios({
                method: requestMethod,
                url: url,
                headers: headers,
                timeout: requestTimeout,
                validateStatus: () => true // Don't throw on any status
            });
            
            console.log('Refresh API response:', { 
                status: response.status, 
                statusText: response.statusText 
            });
            
            // Check for authentication errors from external API
            if (response.status === 401) {
                errorMessage = 'External API returned 401 Unauthorized. Please verify your API credentials (token, API key, or username/password) are correct in the configuration.';
                console.error('External API 401:', { url, method: requestMethod, headers: Object.keys(headers) });
                throw new Error(errorMessage);
            } else if (response.status === 404) {
                errorMessage = 'External API returned 404 Not Found. Please check that the API endpoint URL is correct.';
                console.error('External API 404:', { url });
                throw new Error(errorMessage);
            } else if (response.status >= 400) {
                errorMessage = `External API returned ${response.status}: ${response.statusText || 'Error'}. Please check your API configuration.`;
                console.error('External API error:', { status: response.status, statusText: response.statusText });
                throw new Error(errorMessage);
            }
            
            // Only process data if response is successful (2xx)
            // Handle response data
            let responseData = response.data;
            if (!Array.isArray(responseData)) {
                if (responseData.data && Array.isArray(responseData.data)) {
                    responseData = responseData.data;
                } else if (responseData.meta && responseData.data) {
                    responseData = responseData.data;
                } else {
                    responseData = [responseData];
                }
            }
            
            data = Array.isArray(responseData) ? responseData : [];
            rowCount = data.length;
            
            // Update dataset row_count, connection_status, and updated_at
            // Clear last_error on successful refresh
            await pool.query(
                'UPDATE datasets SET row_count = ?, connection_status = ?, last_error = NULL, updated_at = NOW() WHERE id = ?',
                [rowCount, 'connected', id]
            );
            
            res.json({
                success: true,
                message: 'Dataset refreshed successfully',
                data: {
                    status: 'connected',
                    row_count: rowCount,
                    last_refreshed: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('API refresh error:', error);
            
            // Determine error message
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'External API returned 401 Unauthorized. Please verify your API credentials (token, API key, or username/password) are correct in the configuration.';
                } else if (error.response.status === 404) {
                    errorMessage = 'External API returned 404 Not Found. Please check that the API endpoint URL is correct.';
                } else {
                    errorMessage = `External API returned ${error.response.status}: ${error.response.statusText || error.message}`;
                }
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused - API server may be down or URL is incorrect';
            } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                errorMessage = 'Connection timeout - API server did not respond within the timeout period';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Host not found - Please check the base URL';
            } else if (error.message) {
                errorMessage = error.message;
            } else {
                errorMessage = 'Failed to connect to API';
            }
            
            // Update dataset to reflect error - save connection_status and last_error to database
            await pool.query(
                'UPDATE datasets SET connection_status = ?, last_error = ?, updated_at = NOW() WHERE id = ?',
                ['error', errorMessage, id]
            );
            
            res.json({
                success: false,
                message: errorMessage,
                data: {
                    status: 'error',
                    error: errorMessage
                }
            });
        }
    } catch (error) {
        console.error('Refresh API dataset error:', error);
        res.status(500).json({
            success: false,
            message: 'Error refreshing dataset',
            error: error.message
        });
    }
};

/**
 * Update dataset (name, description only - for developers)
 */
const updateDataset = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Dataset name is required'
            });
        }
        
        // Check if dataset exists
        const [datasets] = await pool.query(
            'SELECT * FROM datasets WHERE id = ?',
            [id]
        );
        
        if (datasets.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dataset not found'
            });
        }
        
        // Update dataset (only name and description - developers can't change source config)
        await pool.query(
            'UPDATE datasets SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, description || null, id]
        );
        
        // Fetch updated dataset
        const [updated] = await pool.query(
            `SELECT d.*, u.email as created_by_email
             FROM datasets d
             JOIN users u ON d.created_by = u.id
             WHERE d.id = ?`,
            [id]
        );
        
        res.json({
            success: true,
            message: 'Dataset updated successfully',
            data: updated[0]
        });
    } catch (error) {
        console.error('Update dataset error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating dataset'
        });
    }
};

/**
 * Get API configurations that have been used to fetch data (have associated datasets)
 */
const getUsedApiConfigs = async (req, res) => {
    try {
        // Get API configurations that have datasets associated with them
        // Handle both string and JSON types for source_config
        const [configs] = await pool.query(
            `SELECT 
                ac.id,
                ac.name,
                ac.base_url,
                ac.endpoint,
                ac.method,
                ac.headers,
                ac.auth_type,
                ac.auth_config,
                ac.is_active,
                ac.rate_limit_per_minute,
                ac.timeout_ms,
                ac.created_by,
                ac.created_at,
                ac.updated_at,
                u.email as created_by_email,
                COUNT(DISTINCT d.id) as dataset_count,
                MAX(d.created_at) as last_used_at
             FROM api_configurations ac
             INNER JOIN datasets d ON (
                 d.source_type = 'api' 
                 AND CAST(JSON_EXTRACT(COALESCE(d.source_config, '{}'), '$.api_config_id') AS UNSIGNED) = ac.id
             )
             JOIN users u ON ac.created_by = u.id
             GROUP BY ac.id, ac.name, ac.base_url, ac.endpoint, ac.method, ac.headers, 
                      ac.auth_type, ac.auth_config, ac.is_active, ac.rate_limit_per_minute, 
                      ac.timeout_ms, ac.created_by, ac.created_at, ac.updated_at, u.email
             ORDER BY last_used_at DESC`
        );
        
        // Mask sensitive auth data
        const safeConfigs = configs.map(config => {
            const safe = { ...config };
            if (safe.auth_config) {
                try {
                    const authConfig = typeof safe.auth_config === 'string' 
                        ? JSON.parse(safe.auth_config) 
                        : safe.auth_config;
                    // Mask tokens/keys
                    if (authConfig.token) authConfig.token = '***masked***';
                    if (authConfig.key) authConfig.key = '***masked***';
                    safe.auth_config = JSON.stringify(authConfig);
                } catch (e) {
                    console.error('Error parsing auth_config:', e);
                }
            }
            return safe;
        });
        
        res.json({ success: true, data: safeConfigs });
    } catch (error) {
        console.error('Get used API configs error:', error);
        res.status(500).json({ success: false, message: 'Error fetching used API configurations' });
    }
};

module.exports = {
    uploadExcel,
    getDatasets,
    getDatasetById,
    deleteDataset,
    updateDataset,
    fetchApiData,
    refreshApiDataset,
    getUsedApiConfigs
};
