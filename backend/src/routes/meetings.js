const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/meetingController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const manage = authorize('super_admin', 'branch_admin', 'pastor', 'content_manager');

router.use(authenticate, branchScope);

router.get('/', ctrl.list);
router.post('/', manage, ctrl.create);

router.get('/:id/attendance', ctrl.listAttendance);
router.post('/:id/attendance', ctrl.recordAttendance);

router.get('/:id', ctrl.getOne);
router.put('/:id', manage, ctrl.update);
router.delete('/:id', manage, ctrl.remove);

module.exports = router;
