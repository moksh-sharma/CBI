/**
 * Authentication Controller
 * Handles user registration, login, and token management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../database/db');

/**
 * Register a new user
 * Only Admin and Developer can register users
 */
const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }
        
        const { email, password, first_name, last_name, role_id } = req.body;
        
        // Check if user already exists
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
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [result.insertId]
        );
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: users[0]
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error registering user' 
        });
    }
};

/**
 * Login user
 */
const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }
        
        const { email, password } = req.body;
        
        // Find user
        const [users] = await pool.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ?`,
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        const user = users[0];
        
        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({ 
                success: false, 
                message: 'Account is inactive. Please contact administrator.' 
            });
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role_name },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );
        
        // Remove sensitive data
        delete user.password_hash;
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error during login' 
        });
    }
};

/**
 * Get current user
 */
const getMe = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, u.created_at 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [req.user.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        res.json({
            success: true,
            data: users[0]
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching user data' 
        });
    }
};

module.exports = { register, login, getMe };
