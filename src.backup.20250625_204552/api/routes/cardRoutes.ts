import { Router } from 'express';
import { CardController } from '../controllers/cardController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { 
  createCardSchema, 
  updateCardLimitsSchema,
  cardIdParamSchema,
  cardTransactionsQuerySchema
} from '../validators/cardValidators';
import { PERMISSIONS } from '../../config/roles';

const router = Router();

// All routes require authentication
router.use(authenticate);

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

// Freeze card
router.put(
  '/:cardId/freeze',
  authorize(PERMISSIONS.CARDS_FREEZE),
  validate(cardIdParamSchema),
  CardController.freezeCard
);

// Unfreeze card
router.put(
  '/:cardId/unfreeze',
  authorize(PERMISSIONS.CARDS_UNFREEZE),
  validate(cardIdParamSchema),
  CardController.unfreezeCard
);

// Delete card
router.delete(
  '/:cardId',
  authorize(PERMISSIONS.CARDS_DELETE),
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