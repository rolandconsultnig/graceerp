const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/facilityController');
const { authenticate, authorize, branchScope } = require('../middleware/auth');

const manage = authorize('super_admin', 'branch_admin');

router.use(authenticate, branchScope);

router.get('/bookings', ctrl.listBookings);
router.post('/bookings', manage, ctrl.createBooking);
router.put('/bookings/:bookingId', manage, ctrl.updateBooking);
router.delete('/bookings/:bookingId', manage, ctrl.deleteBooking);

router.get('/', ctrl.listFacilities);
router.post('/', manage, ctrl.createFacility);
router.get('/:id', ctrl.getFacility);
router.put('/:id', manage, ctrl.updateFacility);
router.delete('/:id', manage, ctrl.deleteFacility);

module.exports = router;
