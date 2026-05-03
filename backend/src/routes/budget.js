const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/budgetController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const manage = authorize('super_admin', 'branch_admin', 'finance_officer');

const expenditureApprovers = authorize(
  'super_admin',
  'branch_admin',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor'
);

const expenditureRejectors = authorize(
  'super_admin',
  'branch_admin',
  'finance_officer',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor'
);

router.use(authenticate, branchScope);

router.get('/expenditure-requests', ctrl.listExpenditure);
router.post('/expenditure-requests', manage, ctrl.createExpenditure);
router.post('/expenditure-requests/:eid/approve', expenditureApprovers, ctrl.approveExpenditure);
router.post('/expenditure-requests/:eid/reject', expenditureRejectors, ctrl.rejectExpenditure);
router.get('/expenditure-requests/:eid', ctrl.getExpenditure);
router.put('/expenditure-requests/:eid', manage, ctrl.updateExpenditure);
router.delete('/expenditure-requests/:eid', manage, ctrl.deleteExpenditure);

router.get('/', ctrl.listBudgets);
router.post('/', manage, ctrl.createBudget);
router.get('/:id', ctrl.getBudget);
router.put('/:id', manage, ctrl.updateBudget);
router.delete('/:id', manage, ctrl.deleteBudget);

module.exports = router;
