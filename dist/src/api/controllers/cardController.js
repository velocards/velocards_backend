"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardController = void 0;
const cardService_1 = require("../../services/cardService");
const responseFormatter_1 = require("../../utils/responseFormatter");
const logger_1 = __importDefault(require("../../utils/logger"));
class CardController {
    /**
     * Get available card programs
     */
    static async getCardPrograms(_req, res, next) {
        try {
            const programs = await cardService_1.CardService.getAvailablePrograms();
            (0, responseFormatter_1.sendSuccess)(res, {
                programs,
                count: programs.length
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Create a new virtual card
     */
    static async createCard(req, res, next) {
        try {
            const userId = req.user.id;
            const cardData = req.body;
            logger_1.default.info('Creating card', {
                userId,
                type: cardData.type,
                amount: cardData.fundingAmount
            });
            const card = await cardService_1.CardService.createCard(userId, cardData);
            res.status(201);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Card created successfully',
                card
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get a specific card
     */
    static async getCard(req, res, next) {
        try {
            const userId = req.user.id;
            const { cardId } = req.params;
            const card = await cardService_1.CardService.getCard(userId, cardId);
            (0, responseFormatter_1.sendSuccess)(res, { card });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get full card details including PAN and CVV
     * ⚠️ SECURITY SENSITIVE: Returns unmasked card data
     */
    static async getFullCardDetails(req, res, next) {
        try {
            const userId = req.user.id;
            const { cardId } = req.params;
            const cardDetails = await cardService_1.CardService.getFullCardDetails(userId, cardId);
            // Add security headers
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            (0, responseFormatter_1.sendSuccess)(res, { cardDetails });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * List user's cards
     */
    static async listCards(req, res, next) {
        try {
            const userId = req.user.id;
            const includeDeleted = req.query['includeDeleted'] === 'true';
            const cards = await cardService_1.CardService.listCards(userId, includeDeleted);
            (0, responseFormatter_1.sendSuccess)(res, {
                cards,
                count: cards.length
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Freeze a card
     */
    static async freezeCard(req, res, next) {
        try {
            const userId = req.user.id;
            const { cardId } = req.params;
            logger_1.default.info('Freezing card', { userId, cardId });
            const card = await cardService_1.CardService.freezeCard(userId, cardId);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Card frozen successfully',
                card
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Unfreeze a card
     */
    static async unfreezeCard(req, res, next) {
        try {
            const userId = req.user.id;
            const { cardId } = req.params;
            logger_1.default.info('Unfreezing card', { userId, cardId });
            const card = await cardService_1.CardService.unfreezeCard(userId, cardId);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Card unfrozen successfully',
                card
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete a card
     */
    static async deleteCard(req, res, next) {
        try {
            const userId = req.user.id;
            const { cardId } = req.params;
            logger_1.default.info('Deleting card', { userId, cardId });
            await cardService_1.CardService.deleteCard(userId, cardId);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Card deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update card spending limits
     */
    static async updateCardLimits(req, res, next) {
        try {
            const userId = req.user.id;
            const { cardId } = req.params;
            const { spendingLimit } = req.body;
            logger_1.default.info('Updating card limits', {
                userId,
                cardId,
                newLimit: spendingLimit
            });
            const card = await cardService_1.CardService.updateCardLimits(userId, cardId, spendingLimit);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Card limits updated successfully',
                card
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get card transactions
     */
    static async getCardTransactions(req, res, next) {
        try {
            const userId = req.user.id;
            const { cardId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const result = await cardService_1.CardService.getCardTransactions(userId, cardId, Number(page), Number(limit));
            (0, responseFormatter_1.sendSuccess)(res, result);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CardController = CardController;
//# sourceMappingURL=cardController.js.map