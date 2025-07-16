"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const authorize_1 = require("../middlewares/authorize");
const validate_1 = require("../middlewares/validate");
const userValidators_1 = require("../validators/userValidators");
const roles_1 = require("../../config/roles");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Profile routes
router.get('/profile', (0, authorize_1.authorize)(roles_1.PERMISSIONS.PROFILE_READ), userController_1.UserController.getProfile);
router.put('/profile', (0, authorize_1.authorize)(roles_1.PERMISSIONS.PROFILE_UPDATE), (0, validate_1.validate)(userValidators_1.updateProfileSchema), userController_1.UserController.updateProfile);
// Balance routes
router.get('/balance', (0, authorize_1.authorize)(roles_1.PERMISSIONS.BALANCE_READ), userController_1.UserController.getBalance);
router.get('/balance/available', (0, authorize_1.authorize)(roles_1.PERMISSIONS.BALANCE_READ), userController_1.UserController.getAvailableBalance);
router.get('/balance/history', (0, authorize_1.authorize)(roles_1.PERMISSIONS.BALANCE_READ), (0, validate_1.validate)(userValidators_1.balanceHistoryQuerySchema), userController_1.UserController.getBalanceHistory);
// Settings routes
router.put('/settings', (0, authorize_1.authorize)(roles_1.PERMISSIONS.SETTINGS_UPDATE), (0, validate_1.validate)(userValidators_1.updateSettingsSchema), userController_1.UserController.updateSettings);
// Statistics routes
router.get('/statistics', (0, authorize_1.authorize)(roles_1.PERMISSIONS.PROFILE_READ), userController_1.UserController.getUserStatistics);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map