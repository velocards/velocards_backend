"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cardController_1 = require("../controllers/cardController");
const auth_1 = require("../middlewares/auth");
const authorize_1 = require("../middlewares/authorize");
const validate_1 = require("../middlewares/validate");
const cardValidators_1 = require("../validators/cardValidators");
const roles_1 = require("../../config/roles");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Get available card programs
router.get('/programs', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_READ), cardController_1.CardController.getCardPrograms);
// Create card
router.post('/', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_CREATE), (0, validate_1.validate)(cardValidators_1.createCardSchema), cardController_1.CardController.createCard);
// List cards
router.get('/', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_READ), cardController_1.CardController.listCards);
// Get specific card
router.get('/:cardId', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_READ), (0, validate_1.validate)(cardValidators_1.cardIdParamSchema), cardController_1.CardController.getCard);
// Get full card details (PAN, CVV) - SECURITY SENSITIVE
router.get('/:cardId/full-details', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_READ), // TODO: Consider adding a more restrictive permission
(0, validate_1.validate)(cardValidators_1.cardIdParamSchema), cardController_1.CardController.getFullCardDetails);
// Freeze card
router.put('/:cardId/freeze', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_FREEZE), (0, validate_1.validate)(cardValidators_1.cardIdParamSchema), cardController_1.CardController.freezeCard);
// Unfreeze card
router.put('/:cardId/unfreeze', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_UNFREEZE), (0, validate_1.validate)(cardValidators_1.cardIdParamSchema), cardController_1.CardController.unfreezeCard);
// Delete card
router.delete('/:cardId', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_DELETE), (0, validate_1.validate)(cardValidators_1.cardIdParamSchema), cardController_1.CardController.deleteCard);
// Update card limits
router.put('/:cardId/limits', (0, authorize_1.authorize)(roles_1.PERMISSIONS.CARDS_UPDATE), (0, validate_1.validate)(cardValidators_1.updateCardLimitsSchema), cardController_1.CardController.updateCardLimits);
// Get card transactions
router.get('/:cardId/transactions', (0, authorize_1.authorize)(roles_1.PERMISSIONS.TRANSACTIONS_READ), (0, validate_1.validate)(cardValidators_1.cardTransactionsQuerySchema), cardController_1.CardController.getCardTransactions);
exports.default = router;
//# sourceMappingURL=cardRoutes.js.map