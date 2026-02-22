const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/budget', authMiddleware, userController.getBudget);
router.put('/budget', authMiddleware, userController.updateBudget);

module.exports = router;
