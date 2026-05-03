const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/documentsController');
const upload = require('../middleware/documentUpload');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const manage = authorize('super_admin', 'branch_admin');

router.use(authenticate, branchScope);

router.get('/', ctrl.list);
router.post('/', manage, ctrl.createJson);
router.post('/upload', manage, upload.single('file'), ctrl.createUploaded);

router.get('/:id', ctrl.getOne);
router.put('/:id', manage, ctrl.update);
router.delete('/:id', manage, ctrl.remove);

module.exports = router;
