/**
 * User Controller
 * Handles user management operations
 */

const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const pool = require('../database/db');

/**
 * Get all users (filtered by role)
 */
const getUsers = async (req, res) => {
    try {
        // Viewers can only see their own info
        if (req.user.role_name === 'viewer') {
            const [users] = await pool.query(
                `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, u.is_active, u.created_at 
                 FROM users u 
                 JOIN roles r ON u.role_id = r.id 
                 WHERE u.id = ?`,
                [req.user.id]
            );
            return res.json({ success: true, data: users });
        }
        
        // Admin and Developer can see all users
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, u.is_active, u.created_at 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             ORDER BY u.created_at DESC`
        );
        
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Viewers can only see their own info
        if (req.user.role_name === 'viewer' && parseInt(id) !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }
        
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, u.is_active, u.created_at 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        res.json({ success: true, data: users[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Error fetching user' });
    }
};

/**
 * Create user
 */
const createUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }));
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: errorMessages 
            });
        }
        
        const { email, password, first_name, last_name, role_id } = req.body;
        
        // Check if user exists
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'User with this email already exists' 
            });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Create user
        const [result] = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [email, passwordHash, first_name, last_name, role_id]
        );
        
        // Fetch created user
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, u.is_active, u.created_at 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [result.insertId]
        );
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: users[0]
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Error creating user' });
    }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
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
        const { email, password, first_name, last_name, role_id, is_active } = req.body;
        
        // Viewers can only update their own info (limited fields)
        if (req.user.role_name === 'viewer' && parseInt(id) !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (email) {
            // Check if email is already taken
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );
            if (existing.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Email already in use' 
                });
            }
            updates.push('email = ?');
            values.push(email);
        }
        
        if (first_name) {
            updates.push('first_name = ?');
            values.push(first_name);
        }
        
        if (last_name) {
            updates.push('last_name = ?');
            values.push(last_name);
        }
        
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            values.push(passwordHash);
        }
        
        // Only admin can change role and active status
        if (req.user.role_name === 'admin') {
            if (role_id !== undefined) {
                updates.push('role_id = ?');
                values.push(role_id);
            }
            if (is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(is_active);
            }
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No fields to update' 
            });
        }
        
        values.push(id);
        
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Fetch updated user
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, u.is_active, u.created_at 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [id]
        );
        
        res.json({
            success: true,
            message: 'User updated successfully',
            data: users[0]
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Error updating user' });
    }
};

/**
 * Delete user (Admin only)
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Prevent self-deletion
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot delete your own account' 
            });
        }
        
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
};

/**
 * Get all roles
 */
const getRoles = async (req, res) => {
    try {
        const [roles] = await pool.query('SELECT * FROM roles ORDER BY id');
        res.json({ success: true, data: roles });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ success: false, message: 'Error fetching roles' });
    }
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getRoles
};
