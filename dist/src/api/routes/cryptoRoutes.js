"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cryptoController_1 = require("../controllers/cryptoController");
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const cryptoValidators_1 = require("../validators/cryptoValidators");
const router = (0, express_1.Router)();
// Deposit endpoints
router.post('/deposit/order', auth_1.authenticate, (0, validate_1.validate)(cryptoValidators_1.createDepositOrderSchema), cryptoController_1.CryptoController.createDepositOrder);
router.get('/deposit/history', auth_1.authenticate, (0, validate_1.validate)(cryptoValidators_1.getDepositHistorySchema), cryptoController_1.CryptoController.getDepositHistory);
// Withdrawal endpoint - DISABLED (not supported)
// router.post(
//   '/withdraw',
//   authenticate,
//   validate(createWithdrawalSchema),
//   CryptoController.createWithdrawal
// );
// Exchange rates - DISABLED (not needed without withdrawals)
// router.get(
//   '/rates',
//   authenticate,
//   validate(getExchangeRatesSchema),
//   CryptoController.getExchangeRates
// );
// Specific exchange rate - DISABLED (not needed without withdrawals)
// router.get(
//   '/rates/:from/:to',
//   authenticate,
//   CryptoController.getSpecificExchangeRate
// );
// Order status
router.get('/orders/:orderId', auth_1.authenticate, (0, validate_1.validate)(cryptoValidators_1.getOrderStatusSchema), cryptoController_1.CryptoController.getOrderStatus);
exports.default = router;
//# sourceMappingURL=cryptoRoutes.js.map