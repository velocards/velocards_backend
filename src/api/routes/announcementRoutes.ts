import { Router } from 'express';
import announcementController from '../controllers/announcementController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { PERMISSIONS } from '../../config/roles';
import {
  getAnnouncementsSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  announcementIdSchema,
  getAdminAnnouncementsSchema
} from '../validators/announcementValidators';

const router = Router();

// User endpoints (require authentication)
router.get(
  '/',
  authenticate,
  validate(getAnnouncementsSchema),
  announcementController.getAnnouncements
);

router.get(
  '/unread-count',
  authenticate,
  announcementController.getUnreadCount
);

router.post(
  '/:id/read',
  authenticate,
  validate(announcementIdSchema),
  announcementController.markAsRead
);

router.post(
  '/read-all',
  authenticate,
  announcementController.markAllAsRead
);

// Admin endpoints (require announcements:manage permission)
router.get(
  '/admin',
  authenticate,
  authorize(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validate(getAdminAnnouncementsSchema),
  announcementController.getAllAnnouncements
);

router.post(
  '/admin',
  authenticate,
  authorize(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validate(createAnnouncementSchema),
  announcementController.createAnnouncement
);

router.put(
  '/admin/:id',
  authenticate,
  authorize(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validate(updateAnnouncementSchema),
  announcementController.updateAnnouncement
);

router.delete(
  '/admin/:id',
  authenticate,
  authorize(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validate(announcementIdSchema),
  announcementController.deleteAnnouncement
);

router.post(
  '/admin/:id/publish',
  authenticate,
  authorize(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validate(announcementIdSchema),
  announcementController.publishAnnouncement
);

router.post(
  '/admin/:id/unpublish',
  authenticate,
  authorize(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validate(announcementIdSchema),
  announcementController.unpublishAnnouncement
);

export default router;