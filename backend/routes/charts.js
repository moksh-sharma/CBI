/**
 * Chart-specific API routes (e.g. Key Influencers, Decomposition Tree).
 * Placeholder endpoints; ML-ready input/output schema for future use.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { hasPermission } = require('../middleware/rbac');

router.use(authenticate);

/**
 * Key Influencers — ML-ready placeholder.
 * Input: { datasetId, targetField, dimensionFields[] }
 * Output: { success, data: { influencers: { factor, impact, rank }[] } }
 */
router.post(
  '/key-influencers',
  hasPermission('data.read'),
  (req, res) => {
    const { datasetId, targetField, dimensionFields } = req.body || {};
    // Placeholder response
    res.json({
      success: true,
      data: {
        influencers: [
          { rank: 1, factor: 'Region', impact: 12.4 },
          { rank: 2, factor: 'Product', impact: 8.1 },
          { rank: 3, factor: 'Segment', impact: -3.2 },
        ],
        meta: { datasetId, targetField, dimensionFields },
      },
    });
  }
);

module.exports = router;
