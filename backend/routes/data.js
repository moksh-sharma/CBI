/**
 * Data Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dataController = require('../controllers/dataController');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// All routes require authentication
router.use(authenticate);

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'excel-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
        }
    }
});

// Routes - All authenticated users (admin, developer, viewer) can access data
// No permission checks needed - all authenticated users can view/fetch data
router.post('/upload',
    upload.single('file'),
    auditLog('data.upload', 'dataset'),
    dataController.uploadExcel
);

router.get('/datasets',
    dataController.getDatasets
);

router.get('/datasets/:id',
    dataController.getDatasetById
);

router.put('/datasets/:id',
    auditLog('data.update', 'dataset'),
    dataController.updateDataset
);

router.delete('/datasets/:id',
    auditLog('data.delete', 'dataset'),
    dataController.deleteDataset
);

// Fetch API data - available to all authenticated users (admin, developer, viewer)
router.post('/fetch-api',
    auditLog('data.fetch_api', 'dataset'),
    dataController.fetchApiData
);

// Refresh dataset - available to all authenticated users (admin, developer, viewer)
router.post('/datasets/:id/refresh',
    auditLog('data.refresh', 'dataset'),
    dataController.refreshApiDataset
);

// Clear cache for a specific dataset
router.post('/datasets/:id/clear-cache',
    dataController.clearDataCache
);

// Clear all dataset caches
router.post('/clear-cache',
    dataController.clearDataCache
);

router.get('/used-api-configs',
    dataController.getUsedApiConfigs
);

module.exports = router;
