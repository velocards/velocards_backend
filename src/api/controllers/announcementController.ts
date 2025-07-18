import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import announcementService from '../../services/announcementService';
import { formatResponse } from '../../utils/responseFormatter';
import { AppError } from '../../utils/errors';

class AnnouncementController {
  /**
   * Get announcements for the authenticated user
   */
  async getAnnouncements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const category = req.query['category'] as string;

      const result = await announcementService.getUserAnnouncements(userId, {
        page,
        limit,
        category
      });

      res.json(formatResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a specific announcement as read
   */
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const { id } = req.params;

      if (!id) {
        throw new AppError('INVALID_REQUEST', 'Announcement ID is required');
      }

      await announcementService.markAsRead(userId, id);

      res.json(formatResponse({
        message: 'Announcement marked as read'
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all announcements as read
   */
  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;

      const updatedCount = await announcementService.markAllAsRead(userId);

      res.json(formatResponse({
        updatedCount
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread announcement count
   */
  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;

      const count = await announcementService.getUnreadCount(userId);

      res.json(formatResponse({
        count
      }));
    } catch (error) {
      next(error);
    }
  }

  // Admin endpoints

  /**
   * Get all announcements (admin only)
   */
  async getAllAnnouncements(req: AuthRequest, _res: Response, next: NextFunction) {
    try {
      // TODO: Implement admin check
      if (req.user!.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'Admin access required', 403);
      }

      // const page = parseInt(req.query['page'] as string) || 1;
      // const limit = parseInt(req.query['limit'] as string) || 50;
      // const includeInactive = req.query['includeInactive'] === 'true';

      // For admin, we'll need a separate method that doesn't filter by user
      // For now, throw not implemented
      throw new AppError('NOT_IMPLEMENTED', 'Admin endpoints coming soon', 501);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new announcement (admin only)
   */
  async createAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // TODO: Implement admin check
      if (req.user!.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'Admin access required', 403);
      }

      const announcement = await announcementService.createAnnouncement(req.body);

      res.status(201).json(formatResponse(announcement));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an announcement (admin only)
   */
  async updateAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // TODO: Implement admin check
      if (req.user!.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'Admin access required', 403);
      }

      const { id } = req.params;
      
      if (!id) {
        throw new AppError('INVALID_REQUEST', 'Announcement ID is required');
      }
      
      const announcement = await announcementService.updateAnnouncement(id, req.body);

      res.json(formatResponse(announcement));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an announcement (admin only)
   */
  async deleteAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // TODO: Implement admin check
      if (req.user!.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'Admin access required', 403);
      }

      const { id } = req.params;
      
      if (!id) {
        throw new AppError('INVALID_REQUEST', 'Announcement ID is required');
      }
      
      await announcementService.deleteAnnouncement(id);

      res.json(formatResponse({
        message: 'Announcement deleted successfully'
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Publish a draft announcement (admin only)
   */
  async publishAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // TODO: Implement admin check
      if (req.user!.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'Admin access required', 403);
      }

      const { id } = req.params;
      
      if (!id) {
        throw new AppError('INVALID_REQUEST', 'Announcement ID is required');
      }
      
      const announcement = await announcementService.updateAnnouncement(id, {
        is_active: true,
        published_at: new Date().toISOString()
      });

      res.json(formatResponse(announcement));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unpublish an announcement (admin only)
   */
  async unpublishAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // TODO: Implement admin check
      if (req.user!.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'Admin access required', 403);
      }

      const { id } = req.params;
      
      if (!id) {
        throw new AppError('INVALID_REQUEST', 'Announcement ID is required');
      }
      
      const announcement = await announcementService.updateAnnouncement(id, {
        is_active: false
      });

      res.json(formatResponse(announcement));
    } catch (error) {
      next(error);
    }
  }
}

export default new AnnouncementController();