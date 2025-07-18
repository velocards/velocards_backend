import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { CardService } from '../../services/cardService';
import { CardSessionService } from '../../services/cardSessionService';
import { SecurityLoggingService } from '../../services/securityLoggingService';
import { sendSuccess, sendError } from '../../utils/responseFormatter';
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
      
      // Log card creation for security monitoring
      SecurityLoggingService.logCardOperation(
        userId,
        req,
        'created',
        card.id,
        true
      );
      
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
      const cardId = req.params['cardId'];
      
      const card = await CardService.getCard(userId, cardId!);
      
      sendSuccess(res, { card });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a secure session for viewing card details
   */
  static async createCardSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const cardId = req.params['cardId'];
      const { purpose } = req.body;
      
      if (!['view_pan', 'view_cvv', 'view_full'].includes(purpose)) {
        sendError(res, 'INVALID_PURPOSE', 'Invalid session purpose', 400);
        return;
      }
      
      const ip = req.ip || req.socket.remoteAddress || '';
      const userAgent = req.get('user-agent');
      
      const session = await CardSessionService.createSession(
        userId,
        cardId!,
        purpose,
        ip,
        userAgent
      );
      
      logger.info('Card session created', {
        userId,
        cardId,
        purpose,
        sessionId: session.sessionId
      });
      
      sendSuccess(res, {
        sessionId: session.sessionId,
        token: session.token,
        expiresIn: 300 // 5 minutes
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get secure card details using session
   */
  static async getSecureCardDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { sessionId, token } = req.body;
      
      if (!sessionId || !token) {
        sendError(res, 'MISSING_SESSION', 'Session ID and token are required', 400);
        return;
      }
      
      const ip = req.ip || req.socket.remoteAddress || '';
      
      // Validate session
      const session = await CardSessionService.validateSession(sessionId, token, userId, ip);
      
      if (!session) {
        sendError(res, 'INVALID_SESSION', 'Invalid or expired session', 403);
        return;
      }
      
      // Get card details based on session purpose
      const cardDetails = await CardService.getFullCardDetails(userId, session.cardId);
      
      let responseData: any = {};
      
      switch (session.purpose) {
        case 'view_pan':
          responseData = { pan: cardDetails.pan };
          break;
        case 'view_cvv':
          responseData = { cvv: cardDetails.cvv };
          break;
        case 'view_full':
          responseData = {
            pan: cardDetails.pan,
            cvv: cardDetails.cvv,
            expiryMonth: cardDetails.expiryMonth,
            expiryYear: cardDetails.expiryYear,
            holderName: cardDetails.holderName
          };
          break;
      }
      
      // Add security headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      // Log card detail viewing for security
      SecurityLoggingService.logCardOperation(
        userId,
        req,
        'viewed',
        session.cardId,
        true
      );
      
      sendSuccess(res, responseData);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get full card details including PAN and CVV
   * @deprecated Use createCardSession and getSecureCardDetails instead
   */
  static async getFullCardDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Log deprecation warning
      logger.warn('Deprecated endpoint accessed: getFullCardDetails', {
        userId: req.user!.id,
        cardId: req.params['cardId'],
        ip: req.ip
      });
      
      const userId = req.user!.id;
      const cardId = req.params['cardId'];
      
      // Get card but only return masked data
      const card = await CardService.getCard(userId, cardId!);
      
      // Add deprecation notice
      res.set({
        'X-Deprecated': 'true',
        'X-Deprecation-Message': 'This endpoint is deprecated. Use /api/v1/cards/:cardId/session instead.',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      sendSuccess(res, {
        message: 'This endpoint is deprecated. Only masked data is returned.',
        cardDetails: {
          id: card.id,
          cardToken: card.cardToken,
          maskedPan: card.maskedPan,
          lastFourDigits: card.maskedPan.slice(-4),
          status: card.status,
          // Do not include sensitive data
          pan: '****', 
          cvv: '***'
        }
      });
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
      const cardId = req.params['cardId'];
      
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
      const cardId = req.params['cardId'];
      
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
      const cardId = req.params['cardId'];
      
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
      const cardId = req.params['cardId'];
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
      const cardId = req.params['cardId'];
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