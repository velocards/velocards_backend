import { Router } from 'express';
import { CryptoController } from '../controllers/cryptoController';
import { validate } from '../middlewares/validate';
import { webhookPayloadSchema } from '../validators/cryptoValidators';

const router = Router();

// xMoney webhook endpoint (no auth required)
router.post(
  '/xmoney',
  validate(webhookPayloadSchema),
  CryptoController.processWebhook
);

export default router;