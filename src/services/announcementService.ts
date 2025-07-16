import { supabase } from '../config/database';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: 'news' | 'updates' | 'maintenance' | 'features' | 'promotions';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  icon?: string;
  image_url?: string;
  action_url?: string;
  action_label?: string;
  published_at: string;
  expires_at?: string;
  target_audience?: {
    tiers?: number[];
    regions?: string[];
    userIds?: string[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
  read?: boolean; // Added by query when fetching for a user
}

export interface AnnouncementFilters {
  page?: number;
  limit?: number;
  category?: string;
}

class AnnouncementService {
  /**
   * Get announcements for a specific user with read status
   */
  async getUserAnnouncements(
    userId: string,
    filters: AnnouncementFilters = {}
  ): Promise<{
    announcements: Announcement[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    unreadCount: number;
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      // Get user profile to check tier
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('tier_id')
        .eq('id', userId)
        .single();

      if (userError) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }

      // Get tier level
      let tierLevel = 0; // Default to unverified
      if (userProfile.tier_id) {
        const { data: tierData } = await supabase
          .from('user_tiers')
          .select('level')
          .eq('id', userProfile.tier_id)
          .single();
        
        if (tierData) {
          tierLevel = tierData.level;
        }
      }

      // Build the query
      let query = supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });

      // Apply category filter
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      // Get all announcements first for filtering and counting
      const { data: allAnnouncements, error: fetchError } = await query;

      if (fetchError) {
        logger.error('Failed to fetch announcements', { error: fetchError, userId });
        throw new AppError('FETCH_ERROR', 'Failed to fetch announcements');
      }

      // Get user's read announcements
      const { data: readRecords } = await supabase
        .from('user_announcement_reads')
        .select('announcement_id, read_at')
        .eq('user_id', userId);
      
      const readAnnouncementIds = new Set(
        (readRecords || []).map(r => r.announcement_id)
      );

      // Filter announcements based on target audience and expiry
      const now = new Date();
      const filteredAnnouncements = (allAnnouncements || []).filter(announcement => {
        // Check if expired
        if (announcement.expires_at && new Date(announcement.expires_at) < now) {
          return false;
        }

        // Check target audience
        if (announcement.target_audience) {
          const audience = announcement.target_audience as any;
          
          // Check tier restrictions
          if (audience.tiers && !audience.tiers.includes(tierLevel)) {
            return false;
          }
          
          // Check user ID restrictions
          if (audience.userIds && !audience.userIds.includes(userId)) {
            return false;
          }
        }

        return true;
      });

      // Map announcements with read status
      const mappedAnnouncements = filteredAnnouncements.map(announcement => {
        return {
          ...announcement,
          read: readAnnouncementIds.has(announcement.id)
        };
      });

      // Sort by priority and read status
      const sortedAnnouncements = mappedAnnouncements.sort((a, b) => {
        // Unread first
        if (a.read !== b.read) {
          return a.read ? 1 : -1;
        }
        
        // Then by priority
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.priority] ?? 3; // Default to low if undefined
        const bPriority = priorityOrder[b.priority] ?? 3;
        const priorityDiff = aPriority - bPriority;
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        // Then by date
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      });

      // Apply pagination
      const paginatedAnnouncements = sortedAnnouncements.slice(offset, offset + limit);
      const unreadCount = sortedAnnouncements.filter(a => !a.read).length;
      const total = sortedAnnouncements.length;
      const totalPages = Math.ceil(total / limit);

      return {
        announcements: paginatedAnnouncements,
        pagination: {
          total,
          page,
          limit,
          totalPages
        },
        unreadCount
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get user announcements', { error, userId });
      throw new AppError('INTERNAL_ERROR', 'Failed to fetch announcements');
    }
  }

  /**
   * Mark an announcement as read by a user
   */
  async markAsRead(userId: string, announcementId: string): Promise<void> {
    try {
      // Check if announcement exists
      const { data: announcement, error: fetchError } = await supabase
        .from('announcements')
        .select('id')
        .eq('id', announcementId)
        .single();

      if (fetchError || !announcement) {
        throw new AppError('NOT_FOUND', 'Announcement not found', 404);
      }

      // Insert or update read record
      const { error } = await supabase
        .from('user_announcement_reads')
        .upsert({
          user_id: userId,
          announcement_id: announcementId,
          read_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,announcement_id'
        });

      if (error) {
        logger.error('Failed to mark announcement as read', { error, userId, announcementId });
        throw new AppError('UPDATE_ERROR', 'Failed to mark announcement as read');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to mark announcement as read', { error, userId, announcementId });
      throw new AppError('INTERNAL_ERROR', 'Failed to update read status');
    }
  }

  /**
   * Mark all announcements as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      // Get all active announcements
      const { data: announcements, error: fetchError } = await supabase
        .from('announcements')
        .select('id')
        .eq('is_active', true);

      if (fetchError) {
        logger.error('Failed to fetch announcements for mark all', { error: fetchError });
        throw new AppError('FETCH_ERROR', 'Failed to fetch announcements');
      }

      if (!announcements || announcements.length === 0) {
        return 0;
      }

      // Get existing read records
      const { data: existingReads, error: readError } = await supabase
        .from('user_announcement_reads')
        .select('announcement_id')
        .eq('user_id', userId);

      if (readError) {
        logger.error('Failed to fetch existing reads', { error: readError });
        throw new AppError('FETCH_ERROR', 'Failed to fetch read status');
      }

      const readAnnouncementIds = new Set(
        (existingReads || []).map(r => r.announcement_id)
      );

      // Filter unread announcements
      const unreadAnnouncements = announcements.filter(
        a => !readAnnouncementIds.has(a.id)
      );

      if (unreadAnnouncements.length === 0) {
        return 0;
      }

      // Insert read records for unread announcements
      const readRecords = unreadAnnouncements.map(a => ({
        user_id: userId,
        announcement_id: a.id,
        read_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('user_announcement_reads')
        .insert(readRecords);

      if (insertError) {
        logger.error('Failed to mark all as read', { error: insertError });
        throw new AppError('UPDATE_ERROR', 'Failed to mark announcements as read');
      }

      return unreadAnnouncements.length;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to mark all as read', { error, userId });
      throw new AppError('INTERNAL_ERROR', 'Failed to update read status');
    }
  }

  /**
   * Get unread announcement count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { unreadCount } = await this.getUserAnnouncements(userId, { limit: 1 });
      return unreadCount;
    } catch (error) {
      logger.error('Failed to get unread count', { error, userId });
      return 0; // Return 0 on error to not break the UI
    }
  }

  /**
   * Create a new announcement (admin only)
   */
  async createAnnouncement(data: Partial<Announcement>): Promise<Announcement> {
    try {
      const { data: announcement, error } = await supabase
        .from('announcements')
        .insert({
          title: data.title,
          message: data.message,
          category: data.category,
          priority: data.priority || 'medium',
          icon: data.icon,
          image_url: data.image_url,
          action_url: data.action_url,
          action_label: data.action_label,
          published_at: data.published_at || new Date().toISOString(),
          expires_at: data.expires_at,
          target_audience: data.target_audience,
          is_active: data.is_active !== false
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create announcement', { error, data });
        throw new AppError('CREATE_ERROR', 'Failed to create announcement');
      }

      return announcement;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create announcement', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to create announcement');
    }
  }

  /**
   * Update an announcement (admin only)
   */
  async updateAnnouncement(id: string, data: Partial<Announcement>): Promise<Announcement> {
    try {
      const { data: announcement, error } = await supabase
        .from('announcements')
        .update({
          title: data.title,
          message: data.message,
          category: data.category,
          priority: data.priority,
          icon: data.icon,
          image_url: data.image_url,
          action_url: data.action_url,
          action_label: data.action_label,
          published_at: data.published_at,
          expires_at: data.expires_at,
          target_audience: data.target_audience,
          is_active: data.is_active
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update announcement', { error, id, data });
        throw new AppError('UPDATE_ERROR', 'Failed to update announcement');
      }

      return announcement;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update announcement', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to update announcement');
    }
  }

  /**
   * Delete an announcement (admin only)
   */
  async deleteAnnouncement(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete announcement', { error, id });
        throw new AppError('DELETE_ERROR', 'Failed to delete announcement');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete announcement', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to delete announcement');
    }
  }
}

export default new AnnouncementService();