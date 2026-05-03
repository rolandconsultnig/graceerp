const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/memberController');
const photoUpload = require('../middleware/memberPhotoUpload');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const readMembers = authorize(
  'super_admin',
  'branch_admin',
  'pastor',
  'finance_officer',
  'hr_officer',
  'content_manager',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor'
);

router.use(authenticate, branchScope);
router.get('/stats',  readMembers, ctrl.stats);
router.get('/',       readMembers, ctrl.getAll);
router.post('/',      authorize('super_admin','branch_admin','pastor'), ctrl.create);
router.post(
  '/:id/photo',
  authorize('super_admin', 'branch_admin', 'pastor'),
  (req, res, next) => {
    photoUpload.single('photo')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
      next();
    });
  },
  ctrl.uploadMemberPhoto
);
router.get('/:id',    readMembers, ctrl.getOne);
router.put('/:id',    authorize('super_admin','branch_admin','pastor'), ctrl.update);
router.delete('/:id', authorize('super_admin','branch_admin'), ctrl.remove);

module.exports = router;
