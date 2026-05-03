const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/hrController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const manage = authorize('super_admin', 'branch_admin', 'hr_officer');
/** Read staff + leave lists (includes finance_officer for payroll visibility; mutations stay `manage`). */
const readHR = authorize('super_admin', 'branch_admin', 'hr_officer', 'finance_officer');

router.use(authenticate, branchScope);

router.get('/leave-requests', readHR, ctrl.listLeaveRequests);
router.post('/leave-requests', manage, ctrl.createLeaveRequest);
router.put('/leave-requests/:id', manage, ctrl.updateLeaveRequest);

router.get('/', readHR, ctrl.listStaff);
router.post('/', manage, ctrl.createStaff);
router.get('/:id', readHR, ctrl.getStaff);
router.put('/:id', manage, ctrl.updateStaff);
router.delete('/:id', manage, ctrl.deleteStaff);

module.exports = router;
