/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

const jwt = require('jsonwebtoken');
const pool = require('../database/db');

const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided. Access denied.' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production');
        
        // Fetch user from database with role information
        const [users] = await pool.query(
            `SELECT u.*, r.id as role_id, r.name as role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ? AND u.is_active = TRUE`,
            [decoded.userId]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token. User not found or inactive.' 
            });
        }
        
        const user = users[0];
        // Ensure role_id and role_name are properly set
        req.user = {
            ...user,
            role_id: user.role_id || user.role_id,
            role_name: user.role_name || user.role_name
        };
        
        // Log for debugging (remove in production if needed)
        if (process.env.NODE_ENV === 'development') {
            console.log('Authenticated user:', { 
                id: req.user.id, 
                email: req.user.email, 
                role_id: req.user.role_id, 
                role_name: req.user.role_name 
            });
        }
        
        // Ensure all authenticated users (admin, developer, viewer) can access data endpoints
        // This is already handled by the routes, but we log it for clarity
        console.log(`[AUTH] User ${req.user.email} (${req.user.role_name}) accessing ${req.method} ${req.path}`);
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired. Please login again.' 
            });
        }
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token. Access denied.' 
        });
    }
};

module.exports = { authenticate };
