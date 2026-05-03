const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

/** Same roles as staff dashboard (see frontend ROUTE_ACCESS.dashboard). */
const readAnalytics = authorize(
  'super_admin',
  'branch_admin',
  'finance_officer',
  'pastor',
  'content_manager',
  'hr_officer',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor'
);

router.use(authenticate, branchScope);
router.get('/dashboard',         readAnalytics, ctrl.dashboard);
router.get('/giving-trend',      readAnalytics, ctrl.givingTrend);
router.get('/member-growth',     readAnalytics, ctrl.memberGrowth);
router.get('/attendance-trend',  readAnalytics, ctrl.attendanceTrend);
router.get('/branch-comparison', readAnalytics, ctrl.branchComparison);
router.get('/content',           readAnalytics, ctrl.contentAnalytics);

module.exports = router;
