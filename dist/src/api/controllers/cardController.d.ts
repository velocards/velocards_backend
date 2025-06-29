import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare class CardController {
    /**
     * Get available card programs
     */
    static getCardPrograms(_req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Create a new virtual card
     */
    static createCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get a specific card
     */
    static getCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get full card details including PAN and CVV
     * ⚠️ SECURITY SENSITIVE: Returns unmasked card data
     */
    static getFullCardDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * List user's cards
     */
    static listCards(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Freeze a card
     */
    static freezeCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Unfreeze a card
     */
    static unfreezeCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Delete a card
     */
    static deleteCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update card spending limits
     */
    static updateCardLimits(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get card transactions
     */
    static getCardTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=cardController.d.ts.map