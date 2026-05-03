const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auditController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const readAudit = authorize('super_admin', 'branch_admin', 'finance_officer');

router.use(authenticate, branchScope);

router.get('/', readAudit, ctrl.list);
router.get('/:id', readAudit, ctrl.getOne);

module.exports = router;
