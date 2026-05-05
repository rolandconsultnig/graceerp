const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/memberPortalController');
const photoUpload = require('../middleware/memberPhotoUpload');
const { authenticate, branchScope } = require('../middleware/auth');
const { requireMemberPortal, authorizeStaffChat } = require('../middleware/memberPortalAuth');

router.use(authenticate, branchScope);

router.get('/profile', requireMemberPortal, ctrl.getProfile);
router.put('/profile', requireMemberPortal, ctrl.updateProfile);
router.post('/profile/photo', requireMemberPortal, (req, res, next) => {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    next();
  });
}, ctrl.uploadPhoto);

router.get('/chat/webrtc-config', ctrl.webrtcConfig);
router.get('/chat/messages', requireMemberPortal, ctrl.listMyChat);
router.post('/chat/messages', requireMemberPortal, ctrl.postMyMessage);

router.get('/staff/inbox', authorizeStaffChat, ctrl.staffInbox);
router.get('/staff/members/:memberId/messages', authorizeStaffChat, ctrl.staffListThread);
router.post('/staff/members/:memberId/messages', authorizeStaffChat, ctrl.staffReply);

module.exports = router;
