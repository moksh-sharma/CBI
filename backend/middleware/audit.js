/**
 * Audit Logging Middleware
 * Logs user actions for compliance and security
 */

const pool = require('../database/db');

const auditLog = (action, resourceType) => {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json;
        
        // Override json method to capture response
        res.json = function(data) {
            // Log after response is sent
            setImmediate(async () => {
                try {
                    const userId = req.user?.id || null;
                    const resourceId = req.params.id || req.body.id || null;
                    const ipAddress = req.ip || req.connection.remoteAddress || null;
                    const userAgent = req.get('user-agent') || null;
                    
                    const details = {
                        method: req.method,
                        path: req.path,
                        body: req.body,
                        query: req.query,
                        statusCode: res.statusCode,
                        success: data.success !== false
                    };
                    
                    await pool.query(
                        `INSERT INTO audit_logs 
                         (user_id, action, resource_type, resource_id, details, ip_address, user_agent) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            userId,
                            action,
                            resourceType,
                            resourceId,
                            JSON.stringify(details),
                            ipAddress,
                            userAgent
                        ]
                    );
                } catch (error) {
                    console.error('Audit logging error:', error);
                    // Don't fail the request if audit logging fails
                }
            });
            
            // Call original json method
            return originalJson.call(this, data);
        };
        
        next();
    };
};

module.exports = { auditLog };
