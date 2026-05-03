const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/projectController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const projectManage = authorize(
  'super_admin',
  'branch_admin',
  'finance_officer',
  'dept_head',
  'pastor'
);

const deptBudgetApprovers = authorize(
  'super_admin',
  'branch_admin',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor'
);

const deptBudgetRejectors = authorize(
  'super_admin',
  'branch_admin',
  'finance_officer',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor'
);

/** Anyone who may create/edit drafts or submit (controller enforces ownership where needed). */
const deptBudgetActors = authorize(
  'super_admin',
  'branch_admin',
  'finance_officer',
  'dept_head',
  'pastor',
  'coordinating_elder',
  'coordinating_pastor'
);

router.use(authenticate, branchScope);

router.get('/department-budgets', ctrl.listDeptBudgets);
router.post('/department-budgets', deptBudgetActors, ctrl.createDeptBudget);
router.post('/department-budgets/:bid/submit', deptBudgetActors, ctrl.submitDeptBudget);
router.post('/department-budgets/:bid/approve', deptBudgetApprovers, ctrl.approveDeptBudget);
router.post('/department-budgets/:bid/reject', deptBudgetRejectors, ctrl.rejectDeptBudget);
router.get('/department-budgets/:bid', ctrl.getDeptBudget);
router.put('/department-budgets/:bid', deptBudgetActors, ctrl.updateDeptBudget);
router.delete('/department-budgets/:bid', deptBudgetActors, ctrl.deleteDeptBudget);

router.get('/', ctrl.listProjects);
router.post('/', projectManage, ctrl.createProject);
router.get('/:id', ctrl.getProject);
router.put('/:id', projectManage, ctrl.updateProject);
router.delete('/:id', projectManage, ctrl.deleteProject);

module.exports = router;
