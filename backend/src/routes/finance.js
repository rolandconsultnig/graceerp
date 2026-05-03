const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financeController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

router.use(authenticate, branchScope);
router.get('/summary',        authorize('super_admin','branch_admin','finance_officer'), ctrl.summary);
router.get('/ledger',         authorize('super_admin','branch_admin','finance_officer'), ctrl.getLedger);
router.get('/giving',         authorize('super_admin','branch_admin','finance_officer'), ctrl.getAllGiving);
router.get('/giving/:id',     authorize('super_admin','branch_admin','finance_officer'), ctrl.getGiving);
router.post('/giving',        authorize('super_admin','branch_admin','finance_officer'), ctrl.recordGiving);

module.exports = router;
