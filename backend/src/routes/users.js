const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

router.use(authenticate, branchScope);

router.get('/', authorize('super_admin', 'branch_admin'), ctrl.list);
router.get('/:id', authorize('super_admin', 'branch_admin'), ctrl.getOne);
router.post('/', authorize('super_admin'), ctrl.create);
router.put('/:id', authorize('super_admin'), ctrl.update);
router.delete('/:id', authorize('super_admin'), ctrl.deactivate);

module.exports = router;
