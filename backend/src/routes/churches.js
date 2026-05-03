const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/churchController');
const { authenticate, branchScope, authorize } = require('../middleware/auth');

router.use(authenticate, branchScope);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.put('/:id', authorize('super_admin'), ctrl.update);

module.exports = router;
