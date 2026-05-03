const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/branchController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

router.use(authenticate, branchScope);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('super_admin'), ctrl.create);
router.put('/:id', authorize('super_admin'), ctrl.update);
router.delete('/:id', authorize('super_admin'), ctrl.archive);

module.exports = router;
