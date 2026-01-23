/**
 * Admin Controller
 * Handles API configuration management
 */

const { validationResult } = require('express-validator');
const pool = require('../database/db');

/**
 * Get all API configurations
 */
const getApiConfigs = async (req, res) => {
    try {
        const [configs] = await pool.query(
            `SELECT ac.*, u.email as created_by_email
             FROM api_configurations ac
             JOIN users u ON ac.created_by = u.id
             ORDER BY ac.created_at DESC`
        );
        
        // Mask sensitive auth data and ensure headers/auth_config are strings
        const safeConfigs = configs.map(config => {
            const safe = { ...config };
            
            // Handle headers - ensure it's a string
            if (safe.headers) {
                try {
                    if (typeof safe.headers === 'string') {
                        if (safe.headers === '[object Object]' || safe.headers.trim() === '') {
                            safe.headers = '{}';
                        }
                        // Already a string, keep it
                    } else if (typeof safe.headers === 'object' && safe.headers !== null) {
                        // Convert object to string
                        safe.headers = JSON.stringify(safe.headers);
                    } else {
                        safe.headers = '{}';
                    }
                } catch (e) {
                    console.error('Error handling headers for config', safe.id, ':', e);
                    safe.headers = '{}';
                }
            } else {
                safe.headers = '{}';
            }
            
            // Handle auth_config - mask sensitive data and ensure it's a string
            if (safe.auth_config) {
                try {
                    const authConfig = typeof safe.auth_config === 'string' 
                        ? JSON.parse(safe.auth_config) 
                        : safe.auth_config;
                    // Mask tokens/keys
                    if (authConfig && typeof authConfig === 'object') {
                        if (authConfig.token) authConfig.token = '***masked***';
                        if (authConfig.key) authConfig.key = '***masked***';
                        safe.auth_config = JSON.stringify(authConfig);
                    } else {
                        safe.auth_config = '{}';
                    }
                } catch (e) {
                    console.error('Error parsing auth_config for config', safe.id, ':', e);
                    safe.auth_config = '{}';
                }
            } else {
                safe.auth_config = '{}';
            }
            
            return safe;
        });
        
        res.json({ success: true, data: safeConfigs });
    } catch (error) {
        console.error('Get API configs error:', error);
        res.status(500).json({ success: false, message: 'Error fetching API configurations' });
    }
};

/**
 * Get API configuration by ID
 */
const getApiConfigById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [configs] = await pool.query(
            `SELECT ac.*, u.email as created_by_email
             FROM api_configurations ac
             JOIN users u ON ac.created_by = u.id
             WHERE ac.id = ?`,
            [id]
        );
        
        if (configs.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'API configuration not found' 
            });
        }
        
        // Mask sensitive auth data and ensure headers/auth_config are strings
        const config = configs[0];
        
        // Handle headers - ensure it's a string
        if (config.headers) {
            try {
                if (typeof config.headers === 'string') {
                    if (config.headers === '[object Object]' || config.headers.trim() === '') {
                        config.headers = '{}';
                    }
                    // Already a string, keep it
                } else if (typeof config.headers === 'object' && config.headers !== null) {
                    // Convert object to string
                    config.headers = JSON.stringify(config.headers);
                } else {
                    config.headers = '{}';
                }
            } catch (e) {
                console.error('Error handling headers:', e);
                config.headers = '{}';
            }
        } else {
            config.headers = '{}';
        }
        
        // Handle auth_config - mask sensitive data and ensure it's a string
        if (config.auth_config) {
            try {
                const authConfig = typeof config.auth_config === 'string' 
                    ? JSON.parse(config.auth_config) 
                    : config.auth_config;
                if (authConfig && typeof authConfig === 'object') {
                    if (authConfig.token) authConfig.token = '***masked***';
                    if (authConfig.key) authConfig.key = '***masked***';
                    config.auth_config = JSON.stringify(authConfig);
                } else {
                    config.auth_config = '{}';
                }
            } catch (e) {
                console.error('Error parsing auth_config:', e);
                config.auth_config = '{}';
            }
        } else {
            config.auth_config = '{}';
        }
        
        res.json({ success: true, data: config });
    } catch (error) {
        console.error('Get API config error:', error);
        res.status(500).json({ success: false, message: 'Error fetching API configuration' });
    }
};

/**
 * Create API configuration
 */
const createApiConfig = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }
        
        const {
            name,
            base_url,
            endpoint,
            method,
            headers,
            auth_type,
            auth_config,
            rate_limit_per_minute,
            timeout_ms
        } = req.body;
        
        // Validate JSON fields
        let headersJson = null;
        if (headers) {
            try {
                headersJson = typeof headers === 'string' ? JSON.parse(headers) : headers;
            } catch (e) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid headers JSON' 
                });
            }
        }
        
        let authConfigJson = null;
        if (auth_config) {
            try {
                authConfigJson = typeof auth_config === 'string' ? JSON.parse(auth_config) : auth_config;
            } catch (e) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid auth_config JSON' 
                });
            }
        }
        
        const [result] = await pool.query(
            `INSERT INTO api_configurations 
             (name, base_url, endpoint, method, headers, auth_type, auth_config, rate_limit_per_minute, timeout_ms, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                base_url,
                endpoint || null,
                method || null, // Use EXACT method from form
                headersJson ? JSON.stringify(headersJson) : null,
                auth_type || 'none',
                authConfigJson ? JSON.stringify(authConfigJson) : null,
                rate_limit_per_minute || 60, // Default for database only
                timeout_ms || 30000, // Default for database only
                req.user.id
            ]
        );
        
        // Fetch created config
        const [configs] = await pool.query(
            `SELECT ac.*, u.email as created_by_email
             FROM api_configurations ac
             JOIN users u ON ac.created_by = u.id
             WHERE ac.id = ?`,
            [result.insertId]
        );
        
        res.status(201).json({
            success: true,
            message: 'API configuration created successfully',
            data: configs[0]
        });
    } catch (error) {
        console.error('Create API config error:', error);
        res.status(500).json({ success: false, message: 'Error creating API configuration' });
    }
};

/**
 * Update API configuration
 */
const updateApiConfig = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }
        
        const { id } = req.params;
        const {
            name,
            base_url,
            endpoint,
            method,
            headers,
            auth_type,
            auth_config,
            is_active,
            rate_limit_per_minute,
            timeout_ms
        } = req.body;
        
        const updates = [];
        const values = [];
        
        if (name) {
            updates.push('name = ?');
            values.push(name);
        }
        
        if (base_url) {
            updates.push('base_url = ?');
            values.push(base_url);
        }
        
        if (endpoint !== undefined) {
            updates.push('endpoint = ?');
            values.push(endpoint);
        }
        
        if (method) {
            updates.push('method = ?');
            values.push(method);
        }
        
        if (headers !== undefined) {
            let headersJson;
            try {
                headersJson = typeof headers === 'string' ? JSON.parse(headers) : headers;
            } catch (e) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid headers JSON' 
                });
            }
            updates.push('headers = ?');
            values.push(JSON.stringify(headersJson));
        }
        
        if (auth_type !== undefined) {
            updates.push('auth_type = ?');
            values.push(auth_type);
        }
        
        if (auth_config !== undefined) {
            let authConfigJson;
            try {
                authConfigJson = typeof auth_config === 'string' ? JSON.parse(auth_config) : auth_config;
            } catch (e) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid auth_config JSON' 
                });
            }
            updates.push('auth_config = ?');
            values.push(JSON.stringify(authConfigJson));
        }
        
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(is_active);
        }
        
        if (rate_limit_per_minute !== undefined) {
            updates.push('rate_limit_per_minute = ?');
            values.push(rate_limit_per_minute);
        }
        
        if (timeout_ms !== undefined) {
            updates.push('timeout_ms = ?');
            values.push(timeout_ms);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No fields to update' 
            });
        }
        
        values.push(id);
        
        await pool.query(
            `UPDATE api_configurations SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        );
        
        // Fetch updated config
        const [configs] = await pool.query(
            `SELECT ac.*, u.email as created_by_email
             FROM api_configurations ac
             JOIN users u ON ac.created_by = u.id
             WHERE ac.id = ?`,
            [id]
        );
        
        res.json({
            success: true,
            message: 'API configuration updated successfully',
            data: configs[0]
        });
    } catch (error) {
        console.error('Update API config error:', error);
        res.status(500).json({ success: false, message: 'Error updating API configuration' });
    }
};

/**
 * Delete API configuration
 */
const deleteApiConfig = async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.query('DELETE FROM api_configurations WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'API configuration deleted successfully'
        });
    } catch (error) {
        console.error('Delete API config error:', error);
        res.status(500).json({ success: false, message: 'Error deleting API configuration' });
    }
};

/**
 * Test API connection directly (without saving)
 */
const testApiConnection = async (req, res) => {
    try {
        const {
            base_url,
            endpoint,
            method,
            headers,
            auth_type,
            auth_config,
            timeout_ms
        } = req.body;
        
        console.log('Test API connection request:', { 
            base_url, 
            endpoint, 
            method, 
            auth_type, 
            hasHeaders: !!headers, 
            hasAuthConfig: !!auth_config,
            auth_config: auth_config // Log actual auth config (will be masked in final request log)
        });
        
        if (!base_url || typeof base_url !== 'string' || base_url.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Base URL is required'
            });
        }
        
        const axios = require('axios');
        
        // Use EXACT URL as provided - NO normalization, NO validation, NO modification
        // If URL is invalid, axios will return the exact error
        let url = base_url.trim();
        if (endpoint && typeof endpoint === 'string' && endpoint.trim() !== '') {
            // Simple concatenation - user is responsible for correct format
            url = url + endpoint.trim();
        }
        
        // Parse headers - use EXACTLY what user provided
        let headersObj = {};
        if (headers) {
            try {
                if (typeof headers === 'string') {
                    if (headers.trim() === '' || headers === 'null' || headers === '{}') {
                        headersObj = {};
                    } else {
                        headersObj = JSON.parse(headers);
                    }
                } else if (typeof headers === 'object' && headers !== null) {
                    headersObj = headers;
                }
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid headers JSON format'
                });
            }
        }
        
        // NO auto-added headers (Content-Type, etc.) - use ONLY user-provided headers
        
        // Add authentication - use EXACT values (NO defaults)
        // Only process auth if auth_type is provided and not 'none', and auth_config exists
        if (auth_type && auth_type !== 'none' && auth_config && typeof auth_config === 'object' && Object.keys(auth_config).length > 0) {
            try {
                let authConfigObj;
                if (typeof auth_config === 'string') {
                    if (auth_config.trim() === '' || auth_config === 'null' || auth_config === '{}') {
                        authConfigObj = {};
                    } else {
                        authConfigObj = JSON.parse(auth_config);
                    }
                } else if (typeof auth_config === 'object' && auth_config !== null) {
                    authConfigObj = auth_config;
                } else {
                    authConfigObj = {};
                }
                
                // Use EXACT header name - require it for API key (NO defaults)
                if (authConfigObj && typeof authConfigObj === 'object' && Object.keys(authConfigObj).length > 0) {
                    console.log('Processing auth config:', { 
                        auth_type, 
                        hasToken: !!authConfigObj.token,
                        hasKey: !!authConfigObj.key,
                        hasHeaderName: !!authConfigObj.header_name,
                        headerName: authConfigObj.header_name,
                        hasUsername: !!authConfigObj.username,
                        hasPassword: !!authConfigObj.password
                    });
                    
                    if (auth_type === 'bearer' && authConfigObj.token) {
                        headersObj['Authorization'] = `Bearer ${authConfigObj.token}`;
                        console.log('Added Bearer token to headers');
                    } else if (auth_type === 'api_key' && authConfigObj.key) {
                        if (!authConfigObj.header_name || authConfigObj.header_name.trim() === '') {
                            console.error('API key auth failed: header_name is missing');
                            return res.status(400).json({
                                success: false,
                                message: 'Header name is required for API key authentication'
                            });
                        }
                        const headerName = authConfigObj.header_name.trim();
                        headersObj[headerName] = authConfigObj.key;
                        console.log(`Added API key to header "${headerName}"`);
                    } else if (auth_type === 'basic' && authConfigObj.username && authConfigObj.password) {
                        const credentials = Buffer.from(`${authConfigObj.username}:${authConfigObj.password}`).toString('base64');
                        headersObj['Authorization'] = `Basic ${credentials}`;
                        console.log('Added Basic auth to headers');
                    } else {
                        console.warn('Auth config provided but conditions not met:', {
                            auth_type,
                            hasToken: !!authConfigObj.token,
                            hasKey: !!authConfigObj.key,
                            hasUsername: !!authConfigObj.username,
                            hasPassword: !!authConfigObj.password
                        });
                    }
                } else {
                    console.warn('Auth config is empty or invalid');
                }
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid authentication configuration'
                });
            }
        }
        
        // Log request (mask sensitive values for logging only)
        const logHeaders = { ...headersObj };
        Object.keys(logHeaders).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('auth') || lowerKey.includes('token') || lowerKey.includes('key') || lowerKey.includes('password')) {
                logHeaders[key] = '***MASKED***';
            }
        });
        // Log will show requestMethod after validation
        
        // Use EXACT method from user - NO default fallback
        const requestMethod = method && method.trim() !== '' ? method.trim().toUpperCase() : null;
        if (!requestMethod) {
            return res.status(400).json({
                success: false,
                message: 'HTTP method is required'
            });
        }
        
        // Use EXACT timeout from user - NO default fallback
        const requestTimeout = timeout_ms && timeout_ms > 0 ? timeout_ms : null;
        if (!requestTimeout) {
            return res.status(400).json({
                success: false,
                message: 'Timeout is required'
            });
        }
        
        try {
            const response = await axios({
                method: requestMethod,
                url: url,
                headers: headersObj,
                timeout: requestTimeout,
                validateStatus: () => true // Return exact status
            });
            
            // Return EXACT response - no masking
            return res.json({
                success: response.status >= 200 && response.status < 300,
                message: response.status >= 200 && response.status < 300 
                    ? `Connection successful! API returned ${response.status}` 
                    : `API returned ${response.status}: ${response.statusText || 'Error'}`,
                data: {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    method: requestMethod,
                    headers: Object.keys(headersObj),
                    responseData: response.data
                }
            });
        } catch (error) {
            // Return EXACT error details
            let errorMessage = 'Failed to connect to API';
            let errorDetails = {
                code: error.code,
                message: error.message
            };
            
            if (error.response) {
                errorMessage = `API returned ${error.response.status}: ${error.response.statusText || error.message}`;
                errorDetails = {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    url: url,
                    method: requestMethod,
                    headers: Object.keys(headersObj),
                    responseData: error.response.data
                };
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused';
            } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                errorMessage = 'Connection timeout';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Host not found';
            } else if (error.code === 'EINVAL') {
                errorMessage = 'Invalid URL format';
            }
            
            return res.json({
                success: false,
                message: errorMessage,
                error: error.code || 'UNKNOWN_ERROR',
                details: errorDetails
            });
        }
    } catch (error) {
        console.error('Test API connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing API connection',
            error: error.message
        });
    }
};

/**
 * Get audit logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, action, resource_type, user_id } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT al.*, u.email as user_email, u.first_name, u.last_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        
        if (action) {
            query += ' AND al.action = ?';
            params.push(action);
        }
        
        if (resource_type) {
            query += ' AND al.resource_type = ?';
            params.push(resource_type);
        }
        
        if (user_id) {
            query += ' AND al.user_id = ?';
            params.push(user_id);
        }
        
        query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const [logs] = await pool.query(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
        const countParams = [];
        
        if (action) {
            countQuery += ' AND action = ?';
            countParams.push(action);
        }
        if (resource_type) {
            countQuery += ' AND resource_type = ?';
            countParams.push(resource_type);
        }
        if (user_id) {
            countQuery += ' AND user_id = ?';
            countParams.push(user_id);
        }
        
        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            data: logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ success: false, message: 'Error fetching audit logs' });
    }
};

module.exports = {
    getApiConfigs,
    getApiConfigById,
    createApiConfig,
    updateApiConfig,
    deleteApiConfig,
    testApiConnection,
    getAuditLogs
};
