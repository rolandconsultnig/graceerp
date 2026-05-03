// ── auth.js ──────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login',           auth.login);
router.post('/refresh',         auth.refresh);
router.post('/logout',          authenticate, auth.logout);
router.get('/me',               authenticate, auth.me);
router.put('/change-password',  authenticate, auth.changePassword);

module.exports = router;
