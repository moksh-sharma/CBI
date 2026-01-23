/**
 * Role-Based Access Control Middleware
 * Checks if user has required permissions
 */

const pool = require('../database/db');

/**
 * Check if user has a specific permission
 */
const hasPermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            // Admin has all permissions - check by role_id (1) or role_name (case-insensitive)
            // Make the check more robust to handle edge cases
            const isAdmin = 
                req.user.role_id === 1 || 
                req.user.role_id === '1' ||
                (req.user.role_name && String(req.user.role_name).toLowerCase() === 'admin') ||
                (req.user.role && String(req.user.role).toLowerCase() === 'admin');
            
            if (isAdmin) {
                console.log('Admin access granted for permission:', permissionName);
                return next();
            }
            
            // Check if user's role has the required permission
            const [permissions] = await pool.query(
                `SELECT p.name 
                 FROM permissions p
                 JOIN role_permissions rp ON p.id = rp.permission_id
                 JOIN roles r ON rp.role_id = r.id
                 WHERE r.id = ? AND p.name = ?`,
                [req.user.role_id, permissionName]
            );
            
            if (permissions.length === 0) {
                return res.status(403).json({ 
                    success: false, 
                    message: `Access denied. Required permission: ${permissionName}` 
                });
            }
            
            next();
        } catch (error) {
            console.error('RBAC Error:', error);
            console.error('User object:', req.user);
            return res.status(500).json({ 
                success: false, 
                message: 'Error checking permissions' 
            });
        }
    };
};

/**
 * Check if user has one of the specified roles
 */
const hasRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        if (allowedRoles.includes(req.user.role_name)) {
            return next();
        }
        
        return res.status(403).json({ 
            success: false, 
            message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
        });
    };
};

/**
 * Check if user owns the resource or has admin/developer role
 */
const ownsResourceOrCanEdit = (resourceType) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            // Admin and Developer can edit any resource
            if (['admin', 'developer'].includes(req.user.role_name)) {
                return next();
            }
            
            // For dashboards, check if user has edit permission via assignment
            if (resourceType === 'dashboard') {
                const dashboardId = req.params.id || req.body.dashboard_id;
                if (dashboardId) {
                    const [assignments] = await pool.query(
                        `SELECT permission_type 
                         FROM dashboard_assignments 
                         WHERE dashboard_id = ? AND user_id = ?`,
                        [dashboardId, req.user.id]
                    );
                    
                    if (assignments.length > 0 && assignments[0].permission_type === 'edit') {
                        return next();
                    }
                }
            }
            
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. You do not have permission to modify this resource.' 
            });
        } catch (error) {
            console.error('Resource ownership check error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error checking resource ownership' 
            });
        }
    };
};

module.exports = { hasPermission, hasRole, ownsResourceOrCanEdit };
