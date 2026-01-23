/**
 * User Routes
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { hasPermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

// All routes require authentication
router.use(authenticate);

// Validation rules
const createUserValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('first_name').trim().notEmpty().withMessage('First name is required'),
    body('last_name').trim().notEmpty().withMessage('Last name is required'),
    body('role_id').isInt({ min: 1, max: 3 }).withMessage('Invalid role selected').toInt()
];

const updateUserValidation = [
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('first_name').optional().trim().notEmpty(),
    body('last_name').optional().trim().notEmpty()
];

// All user management routes require admin role
const { hasRole } = require('../middleware/rbac');

// Routes
// GET /api/users - Allow admin and developer to fetch users (for dashboard assignment)
router.get('/', 
    (req, res, next) => {
        if (['admin', 'developer'].includes(req.user.role_name)) {
            next();
        } else {
            res.status(403).json({ success: false, message: 'Access denied' });
        }
    },
    userController.getUsers
);

router.get('/roles', 
    hasRole('admin'),
    userController.getRoles
);

router.get('/:id', 
    hasRole('admin'),
    userController.getUserById
);

router.post('/', 
    hasRole('admin'),
    createUserValidation,
    auditLog('user.create', 'user'),
    userController.createUser
);

router.put('/:id', 
    hasRole('admin'),
    updateUserValidation,
    auditLog('user.update', 'user'),
    userController.updateUser
);

router.delete('/:id', 
    hasRole('admin'),
    auditLog('user.delete', 'user'),
    userController.deleteUser
);

module.exports = router;
