import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { CardService } from '../../services/cardService';
import { sendSuccess } from '../../utils/responseFormatter';
import logger from '../../utils/logger';

export class CardController {
  /**
   * Get available card programs
   */
  static async getCardPrograms(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const programs = await CardService.getAvailablePrograms();
      
      sendSuccess(res, { 
        programs,
        count: programs.length 
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new virtual card
   */
  static async createCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const cardData = req.body;
      
      logger.info('Creating card', { 
        userId, 
        type: cardData.type,
        amount: cardData.fundingAmount 
      });
      
      const card = await CardService.createCard(userId, cardData);
      
      res.status(201);
      sendSuccess(res, {
        message: 'Card created successfully',
        card
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific card
   */
  static async getCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      
      const card = await CardService.getCard(userId, cardId!);
      
      sendSuccess(res, { card });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get full card details including PAN and CVV
   * ⚠️ SECURITY SENSITIVE: Returns unmasked card data
   */
  static async getFullCardDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      
      const cardDetails = await CardService.getFullCardDetails(userId, cardId!);
      
      // Add security headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      sendSuccess(res, { cardDetails });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List user's cards
   */
  static async listCards(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const includeDeleted = req.query['includeDeleted'] === 'true';
      
      const cards = await CardService.listCards(userId, includeDeleted);
      
      sendSuccess(res, { 
        cards,
        count: cards.length 
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Freeze a card
   */
  static async freezeCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      
      logger.info('Freezing card', { userId, cardId });
      
      const card = await CardService.freezeCard(userId, cardId!);
      
      sendSuccess(res, {
        message: 'Card frozen successfully',
        card
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unfreeze a card
   */
  static async unfreezeCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      
      logger.info('Unfreezing card', { userId, cardId });
      
      const card = await CardService.unfreezeCard(userId, cardId!);
      
      sendSuccess(res, {
        message: 'Card unfrozen successfully',
        card
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a card
   */
  static async deleteCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      
      logger.info('Deleting card', { userId, cardId });
      
      await CardService.deleteCard(userId, cardId!);
      
      sendSuccess(res, {
        message: 'Card deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update card spending limits
   */
  static async updateCardLimits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      const { spendingLimit } = req.body;
      
      logger.info('Updating card limits', { 
        userId, 
        cardId, 
        newLimit: spendingLimit 
      });
      
      const card = await CardService.updateCardLimits(userId, cardId!, spendingLimit);
      
      sendSuccess(res, {
        message: 'Card limits updated successfully',
        card
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get card transactions
   */
  static async getCardTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      const { page = 1, limit = 20 } = req.query as any;
      
      const result = await CardService.getCardTransactions(
        userId, 
        cardId!, 
        Number(page), 
        Number(limit)
      );
      
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}