"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cryptoController_1 = require("../controllers/cryptoController");
const validate_1 = require("../middlewares/validate");
const cryptoValidators_1 = require("../validators/cryptoValidators");
const router = (0, express_1.Router)();
// xMoney webhook endpoint (no auth required)
router.post('/xmoney', (0, validate_1.validate)(cryptoValidators_1.webhookPayloadSchema), cryptoController_1.CryptoController.processWebhook);
exports.default = router;
//# sourceMappingURL=webhookRoutes.js.map