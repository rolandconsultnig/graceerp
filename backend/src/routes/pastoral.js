const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pastoralController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const manage = authorize('super_admin', 'branch_admin', 'pastor');
const readPastoral = authorize('super_admin', 'branch_admin', 'pastor');

router.use(authenticate, branchScope);

router.get('/summary', readPastoral, ctrl.summary);
router.get('/prayers', readPastoral, ctrl.listPrayers);
router.post('/prayers', manage, ctrl.createPrayer);
router.get('/prayers/:id', readPastoral, ctrl.getPrayer);
router.put('/prayers/:id', manage, ctrl.updatePrayer);
router.delete('/prayers/:id', manage, ctrl.deletePrayer);

router.get('/visits', readPastoral, ctrl.listVisits);
router.post('/visits', manage, ctrl.createVisit);
router.get('/visits/:id', readPastoral, ctrl.getVisit);
router.delete('/visits/:id', manage, ctrl.deleteVisit);

router.get('/welfare', readPastoral, ctrl.listWelfare);
router.post('/welfare', manage, ctrl.createWelfare);
router.get('/welfare/:id', readPastoral, ctrl.getWelfare);
router.put('/welfare/:id', manage, ctrl.updateWelfare);
router.delete('/welfare/:id', manage, ctrl.deleteWelfare);

module.exports = router;
