import { Router } from 'express';
import { CardController } from '../controllers/cardController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { requireRequestSignature } from '../middlewares/requestSigning';
import { 
  createCardSchema, 
  updateCardLimitsSchema,
  cardIdParamSchema,
  cardTransactionsQuerySchema,
  createCardSessionSchema,
  getSecureCardDetailsSchema
} from '../validators/cardValidators';
import { PERMISSIONS } from '../../config/roles';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get available card programs
router.get(
  '/programs',
  authorize(PERMISSIONS.CARDS_READ),
  CardController.getCardPrograms
);

// Create card
router.post(
  '/',
  authorize(PERMISSIONS.CARDS_CREATE),
  validate(createCardSchema),
  CardController.createCard
);

// List cards
router.get(
  '/',
  authorize(PERMISSIONS.CARDS_READ),
  CardController.listCards
);

// Get specific card
router.get(
  '/:cardId',
  authorize(PERMISSIONS.CARDS_READ),
  validate(cardIdParamSchema),
  CardController.getCard
);

// Create secure session for viewing sensitive card details
router.post(
  '/:cardId/create-session',
  authorize(PERMISSIONS.CARDS_READ),
  validate(createCardSessionSchema),
  CardController.createCardSession
);

// Get secure card details using session token
router.post(
  '/secure/details',
  authorize(PERMISSIONS.CARDS_READ),
  validate(getSecureCardDetailsSchema),
  CardController.getSecureCardDetails
);

// Get full card details (PAN, CVV) - DEPRECATED
router.get(
  '/:cardId/full-details',
  authorize(PERMISSIONS.CARDS_READ),
  validate(cardIdParamSchema),
  CardController.getFullCardDetails
);

// Freeze card (requires request signature)
router.put(
  '/:cardId/freeze',
  authorize(PERMISSIONS.CARDS_FREEZE),
  requireRequestSignature,
  validate(cardIdParamSchema),
  CardController.freezeCard
);

// Unfreeze card (requires request signature)
router.put(
  '/:cardId/unfreeze',
  authorize(PERMISSIONS.CARDS_UNFREEZE),
  requireRequestSignature,
  validate(cardIdParamSchema),
  CardController.unfreezeCard
);

// Delete card (requires request signature)
router.delete(
  '/:cardId',
  authorize(PERMISSIONS.CARDS_DELETE),
  requireRequestSignature,
  validate(cardIdParamSchema),
  CardController.deleteCard
);

// Update card limits
router.put(
  '/:cardId/limits',
  authorize(PERMISSIONS.CARDS_UPDATE),
  validate(updateCardLimitsSchema),
  CardController.updateCardLimits
);

// Get card transactions
router.get(
  '/:cardId/transactions',
  authorize(PERMISSIONS.TRANSACTIONS_READ),
  validate(cardTransactionsQuerySchema),
  CardController.getCardTransactions
);

export default router;