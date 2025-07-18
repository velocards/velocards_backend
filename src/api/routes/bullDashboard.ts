import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queues } from '../../config/queue';
import { authenticate } from '../middlewares/auth';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Create Bull Board with all queues
createBullBoard({
  queues: Object.values(queues).map(queue => new BullMQAdapter(queue as any)),
  serverAdapter: serverAdapter,
});

const router = Router();

// Protect the dashboard with authentication
// TODO: Add admin permission check when ready
router.use(
  '/',
  authenticate,
  // authorize(PERMISSIONS.ADMIN_ACCESS), // Uncomment when you have admin users
  serverAdapter.getRouter()
);

export default router;