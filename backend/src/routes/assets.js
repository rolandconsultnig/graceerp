const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/assetController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const manage = authorize('super_admin', 'branch_admin', 'finance_officer');

router.use(authenticate, branchScope);

router.get('/maintenance/upcoming', ctrl.listUpcomingMaintenance);
router.get('/maintenance/history', ctrl.listMaintenanceHistory);

router.get('/', ctrl.list);
router.post('/', manage, ctrl.create);

router.get('/:id/maintenance', ctrl.listMaintenance);
router.post('/:id/maintenance', manage, ctrl.addMaintenance);
router.put('/:id/maintenance/:mid', manage, ctrl.updateMaintenance);
router.delete('/:id/maintenance/:mid', manage, ctrl.deleteMaintenance);

router.get('/:id', ctrl.getOne);
router.put('/:id', manage, ctrl.update);
router.delete('/:id', manage, ctrl.remove);

module.exports = router;
