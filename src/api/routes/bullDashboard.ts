import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queues } from '../../config/queue';
import { authenticate } from '../middlewares/auth';
import { env } from '../../config/env';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Create Bull Board with all queues
createBullBoard({
  queues: Object.values(queues).map(queue => new BullMQAdapter(queue as any)),
  serverAdapter: serverAdapter,
});

const router = Router();

// Protect the dashboard with authentication and admin check
router.use(
  '/',
  authenticate,
  (req: any, res, next) => {
    // Get admin emails from environment
    const adminEmails = env.ADMIN_EMAILS 
      ? env.ADMIN_EMAILS.split(',').map(email => email.trim())
      : [];
    
    if (!adminEmails.includes(req.user.email)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required'
        }
      });
      return;
    }
    next();
  },
  serverAdapter.getRouter()
);

export default router;