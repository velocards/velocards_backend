import { Router } from 'express';
import { CryptoController } from '../controllers/cryptoController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createDepositOrderSchema,
  getDepositHistorySchema,
  // createWithdrawalSchema, // Not needed - withdrawals disabled
  // getExchangeRatesSchema, // Not needed - exchange rates disabled
  getOrderStatusSchema
} from '../validators/cryptoValidators';

const router = Router();

// Deposit endpoints
router.post(
  '/deposit/order',
  authenticate,
  validate(createDepositOrderSchema),
  CryptoController.createDepositOrder
);

router.get(
  '/deposit/history',
  authenticate,
  validate(getDepositHistorySchema),
  CryptoController.getDepositHistory
);

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
router.get(
  '/orders/:orderId',
  authenticate,
  validate(getOrderStatusSchema),
  CryptoController.getOrderStatus
);

export default router;