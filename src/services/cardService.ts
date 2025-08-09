import { CardRepository, CreateCardData, Card } from '../repositories/cardRepository';
import { UserRepository } from '../repositories/userRepository';
import { 
  NotFoundError, 
  ValidationError, 
  InsufficientBalanceError,
  ForbiddenError,
  AppError 
} from '../utils/errors';
import logger from '../utils/logger';
import { randomBytes } from 'crypto';
import { admediacardsClient, CreateCardRequest } from '../integrations/admediacards';
import supabase from '../config/database';
import { cardConfig } from '../config/env';
import tierService from './tierService';
import pricingService from './pricingService';
import { CreateCardInput } from '../api/validators/cardValidators';

export interface CardDetails {
  id: string;
  cardToken: string;
  maskedPan: string;
  type: string;
  status: string;
  spendingLimit: number;
  spentAmount: number;
  remainingBalance: number;
  currency: string;
  nickname?: string;
  merchantRestrictions?: Card['merchant_restrictions'];
  expiresAt?: Date;
  createdAt: Date;
}

export interface FullCardDetails {
  id: string;
  cardToken: string;
  pan: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  holderName: string;
  status: string;
  spendingLimit: number;
  spentAmount: number;
  remainingBalance: number;
  createdAt: Date;
}

export interface CardTransaction {
  id: string;
  amount: number;
  currency: string;
  merchantName: string;
  merchantCategory: string;
  status: string;
  timestamp: Date;
}

export interface CardProgram {
  programId: number;
  bin: string;
  name: string;
  description?: string;
}

export class CardService {
  /**
   * Get available card programs for selection
   */
  static async getAvailablePrograms(): Promise<CardProgram[]> {
    try {
      const { data: programs, error } = await supabase
        .from('card_programs')
        .select('program_id, bin, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        logger.error('Failed to fetch card programs:', error);
        throw new AppError('DATABASE_ERROR', 'Failed to fetch card programs', 500);
      }

      // Map to frontend-friendly format
      return (programs || []).map(program => ({
        programId: program.program_id,
        bin: program.bin,
        name: program.name,
        description: `Card starting with ${program.bin}`
      }));
    } catch (error) {
      logger.error('Error fetching card programs:', error);
      throw error;
    }
  }

  /**
   * Create a new virtual card
   */
  static async createCard(
    userId: string, 
    input: CreateCardInput
  ): Promise<CardDetails> {
    try {
      // Validate input
      if (input.fundingAmount <= 0) {
        throw new ValidationError('Funding amount must be positive');
      }

      const spendingLimit = input.spendingLimit || input.fundingAmount;
      if (spendingLimit > input.fundingAmount) {
        throw new ValidationError('Spending limit cannot exceed funding amount');
      }

      // Check user balance
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check account status
      if (user.account_status !== 'active') {
        throw new ForbiddenError('Account is not active');
      }

      // Check tier-based card creation permission
      const canCreate = await tierService.canUserCreateCard(userId);
      if (!canCreate.allowed) {
        throw new ValidationError(canCreate.reason || 'Card creation not allowed');
      }

      // Check tier spending limits
      const spendingCheck = await tierService.checkSpendingLimit(userId, input.fundingAmount, 'daily');
      if (!spendingCheck.allowed) {
        throw new ValidationError(spendingCheck.reason || 'Spending limit exceeded');
      }

      // Calculate card creation fee
      const cardFees = await pricingService.calculateCardCreationFee(userId);
      const totalRequired = input.fundingAmount + cardFees.creationFee;

      // Check if user has enough balance including fee
      if (user.virtual_balance < totalRequired) {
        throw new InsufficientBalanceError(
          totalRequired, 
          user.virtual_balance
        );
      }

      // Generate card token (internal reference)
      const cardToken = this.generateCardToken();

      // Validate the provided program ID
      const { data: program } = await supabase
        .from('card_programs')
        .select('program_id, bin, name')
        .eq('program_id', input.programId)
        .eq('is_active', true)
        .single();
      
      if (!program) {
        throw new ValidationError('Invalid or inactive card program');
      }
      
      // Generate expiry date based on user input or default
      const expDate = new Date();
      if (input.expiresIn) {
        expDate.setDate(expDate.getDate() + input.expiresIn);
      } else {
        expDate.setFullYear(expDate.getFullYear() + cardConfig.defaultExpiryYears);
      }
      const expMonth = String(expDate.getMonth() + 1).padStart(2, '0');
      const expYear = String(expDate.getFullYear());
      
      // Call Admediacards API to create actual card
      try {
        const cardRequest: CreateCardRequest = {
          ProgramID: program.program_id,
          Limit: spendingLimit,
          FirstName: input.firstName,
          LastName: input.lastName,
          Address1: input.streetAddress,
          City: input.city,
          State: input.state,
          Zip: input.postalCode,
          CountryIso: input.country,
          ExpMonth: expMonth,
          ExpYear: expYear,
          PhoneNumber: input.phoneNumber
        };
        
        const createResponse = await admediacardsClient.createCard(cardRequest);
        
        logger.info('Card creation response:', createResponse);
        
        if (!createResponse.Result.IsApproved) {
          // Refund the user balance
          await UserRepository.adjustBalance(userId, input.fundingAmount, 'add');
          throw new AppError('CARD_CREATION_DECLINED', 'Card creation was declined', 400);
        }
        
        // Get the created card details
        logger.info('Fetching card details for CardID:', createResponse.Result.CardID);
        const cardDetails = await admediacardsClient.getCard(createResponse.Result.CardID);
        
        // Add a note to link this card to our user
        try {
          await admediacardsClient.addCardNote(createResponse.Result.CardID, {
            Note: `UserId: ${userId} | Email: ${user.email} | Token: ${cardToken}`
          });
          logger.info('Added user identification note to card');
        } catch (noteError) {
          logger.warn('Failed to add user note to card:', noteError);
          // Continue - card is already created
        }
        
        var admediacardsCardId = String(cardDetails.CardID);
        var maskedPan = `****${cardDetails.Last4}`;
        var cardExpMonth = cardDetails.ExpMonth;
        var cardExpYear = cardDetails.ExpYear;
      } catch (apiError) {
        // Don't charge any fees on API error
        logger.error('Admediacards API error:', apiError);
        throw new AppError('EXTERNAL_API_ERROR', 'Failed to create card with provider', 500);
      }

      // Calculate expiration date
      let expiresAt: Date | undefined;
      if (input.expiresIn) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + input.expiresIn);
      }

      // Begin transaction
      // 1. Apply card creation fee first
      let feeApplied = 0;
      if (cardFees.creationFee > 0) {
        const feeResult = await pricingService.applyCardCreationFee(userId);
        feeApplied = feeResult.feeApplied;
      }

      // 2. Deduct funding amount from user
      await UserRepository.adjustBalance(userId, input.fundingAmount, 'subtract');

      // 3. Get user's tier info for card record
      const tierInfo = await tierService.getUserTierInfo(userId);

      // 4. Create card record
      const cardData: CreateCardData = {
        user_id: userId,
        admediacards_card_id: admediacardsCardId,
        card_token: cardToken,
        masked_pan: maskedPan,
        exp_month: cardExpMonth,
        exp_year: cardExpYear,
        program_id: program.program_id,
        bin: program.bin,
        name: `${input.firstName} ${input.lastName}`,
        address: `${input.streetAddress}, ${input.city}, ${input.state} ${input.postalCode}`,
        phone_number: input.phoneNumber,
        card_type: input.type,
        spending_limit: spendingLimit,
        remaining_balance: spendingLimit,
        currency: cardConfig.defaultCurrency,
        creation_fee_amount: feeApplied,
        monthly_fee_amount: cardFees.monthlyFee,
        // New cardholder fields
        first_name: input.firstName,
        last_name: input.lastName,
        street_address: input.streetAddress,
        city: input.city,
        state: input.state,
        postal_code: input.postalCode,
        country: input.country,
        metadata: {
          funding_amount: input.fundingAmount,
          creation_fee: feeApplied,
          tier_level: tierInfo?.tier_level,
          tier_name: tierInfo?.tier_name,
          created_by: userId,
          nickname: input.nickname || null,
          cardholder: {
            firstName: input.firstName,
            lastName: input.lastName,
            streetAddress: input.streetAddress,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            country: input.country
          }
        }
      };
      
      if (input.nickname) {
        cardData.nickname = input.nickname;
      }
      
      if (tierInfo?.tier_id) {
        cardData.tier_id_at_creation = tierInfo.tier_id;
      }
      
      if (input.merchantRestrictions) {
        const restrictions: any = {};
        if (input.merchantRestrictions.allowedCategories) {
          restrictions.allowedCategories = input.merchantRestrictions.allowedCategories;
        }
        if (input.merchantRestrictions.blockedCategories) {
          restrictions.blockedCategories = input.merchantRestrictions.blockedCategories;
        }
        if (input.merchantRestrictions.allowedMerchants) {
          restrictions.allowedMerchants = input.merchantRestrictions.allowedMerchants;
        }
        if (input.merchantRestrictions.blockedMerchants) {
          restrictions.blockedMerchants = input.merchantRestrictions.blockedMerchants;
        }
        if (Object.keys(restrictions).length > 0) {
          cardData.merchant_restrictions = restrictions;
        }
      }
      
      if (expiresAt) {
        cardData.expires_at = expiresAt;
      }

      const card = await CardRepository.create(cardData);

      // Schedule monthly fees if applicable
      if (cardFees.monthlyFee > 0) {
        await pricingService.scheduleMonthlyCardFee(card.id, userId);
      }

      // Log to balance ledger
      await supabase
        .from('user_balance_ledger')
        .insert({
          user_id: userId,
          transaction_type: 'card_funding',
          amount: input.fundingAmount,
          balance_before: user.virtual_balance - feeApplied,
          balance_after: user.virtual_balance - feeApplied - input.fundingAmount,
          reference_type: 'card_creation',
          reference_id: card.id,
          description: `Funded virtual card ${card.masked_pan}`,
          metadata: {
            card_id: card.id,
            card_token: card.card_token,
            tier_name: tierInfo?.tier_display_name
          }
        });

      logger.info('Card created successfully', {
        userId,
        cardId: card.id,
        cardToken: card.card_token,
        fundingAmount: input.fundingAmount,
        creationFee: feeApplied,
        monthlyFee: cardFees.monthlyFee,
        tierName: tierInfo?.tier_display_name
      });

      return this.formatCardResponse(card);
    } catch (error) {
      logger.error('Card creation failed:', error);
      throw error;
    }
  }

  /**
   * Get card details
   */
  static async getCard(
    userId: string, 
    cardId: string
  ): Promise<CardDetails> {
    const card = await CardRepository.findById(cardId);
    
    if (!card) {
      throw new NotFoundError('Card not found');
    }

    // Verify ownership
    if (card.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    return this.formatCardResponse(card);
  }

  /**
   * Get full card details including PAN and CVV
   * ⚠️ SECURITY SENSITIVE: This returns unmasked card data
   */
  static async getFullCardDetails(
    userId: string, 
    cardId: string
  ): Promise<FullCardDetails> {
    const card = await CardRepository.findById(cardId);
    
    if (!card) {
      throw new NotFoundError('Card not found');
    }

    // Verify ownership
    if (card.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    // Only allow for active cards
    if (card.status !== 'active') {
      throw new ValidationError('Can only retrieve details for active cards');
    }

    try {
      // Get full card details from Admediacards
      const cardNumericId = parseInt(card.admediacards_card_id);
      const fullCardDetails = await admediacardsClient.showPAN(cardNumericId);
      
      // Log access for security audit (without sensitive data)
      logger.info('Full card details accessed', {
        userId,
        cardId,
        cardToken: card.card_token,
        timestamp: new Date().toISOString()
      });

      return {
        id: card.id,
        cardToken: card.card_token,
        pan: fullCardDetails.CcNum,
        cvv: fullCardDetails.Cvx2,
        expiryMonth: fullCardDetails.ExpMonth,
        expiryYear: fullCardDetails.ExpYear,
        holderName: `${card.metadata?.['firstName'] || ''} ${card.metadata?.['lastName'] || ''}`.trim(),
        status: card.status,
        spendingLimit: card.spending_limit || 0,
        spentAmount: card.spent_amount || 0,
        remainingBalance: card.remaining_balance || 0,
        createdAt: card.created_at
      };
    } catch (error) {
      logger.error('Failed to retrieve full card details', {
        error,
        userId,
        cardId,
        cardToken: card.card_token
      });
      throw new AppError('EXTERNAL_API_ERROR', 'Failed to retrieve card details', 500);
    }
  }

  /**
   * List user's cards
   */
  static async listCards(
    userId: string,
    includeDeleted: boolean = false
  ): Promise<CardDetails[]> {
    const cards = await CardRepository.findByUserId(userId, includeDeleted);
    return cards.map(card => this.formatCardResponse(card));
  }

  /**
   * Freeze a card
   */
  static async freezeCard(
    userId: string, 
    cardId: string
  ): Promise<CardDetails> {
    const card = await this.verifyCardOwnership(userId, cardId);
    
    if (card.status === 'frozen') {
      throw new ValidationError('Card is already frozen');
    }

    if (card.status !== 'active') {
      throw new ValidationError('Can only freeze active cards');
    }

    // Call Admediacards API to freeze card
    try {
      const cardNumericId = parseInt(card.admediacards_card_id);
      await admediacardsClient.updateCard(cardNumericId, {
        Type: 'Status',
        Status: false // false = inactive/frozen
      });
    } catch (apiError) {
      logger.error('Failed to freeze card in Admediacards:', apiError);
      throw new AppError('EXTERNAL_API_ERROR', 'Failed to freeze card', 500);
    }

    const updatedCard = await CardRepository.update(cardId, {
      status: 'frozen',
      metadata: {
        ...card.metadata,
        frozen_at: new Date().toISOString(),
        frozen_by: userId
      }
    });

    logger.info('Card frozen', { userId, cardId });

    return this.formatCardResponse(updatedCard);
  }

  /**
   * Unfreeze a card
   */
  static async unfreezeCard(
    userId: string, 
    cardId: string
  ): Promise<CardDetails> {
    const card = await this.verifyCardOwnership(userId, cardId);
    
    if (card.status !== 'frozen') {
      throw new ValidationError('Card is not frozen');
    }

    // Call Admediacards API to unfreeze card
    try {
      const cardNumericId = parseInt(card.admediacards_card_id);
      await admediacardsClient.updateCard(cardNumericId, {
        Type: 'Status',
        Status: true // true = active
      });
    } catch (apiError) {
      logger.error('Failed to unfreeze card in Admediacards:', apiError);
      throw new AppError('EXTERNAL_API_ERROR', 'Failed to unfreeze card', 500);
    }

    const updatedCard = await CardRepository.update(cardId, {
      status: 'active',
      metadata: {
        ...card.metadata,
        unfrozen_at: new Date().toISOString(),
        unfrozen_by: userId
      }
    });

    logger.info('Card unfrozen', { userId, cardId });

    return this.formatCardResponse(updatedCard);
  }

  /**
   * Delete a card
   */
  static async deleteCard(
    userId: string, 
    cardId: string
  ): Promise<void> {
    const card = await this.verifyCardOwnership(userId, cardId);
    
    if (card.status === 'deleted') {
      throw new ValidationError('Card is already deleted');
    }

    // Return remaining balance to user if any
    if (card.remaining_balance > 0) {
      await UserRepository.adjustBalance(
        userId, 
        card.remaining_balance, 
        'add'
      );
      
      logger.info('Refunded card balance to user', {
        userId,
        cardId,
        amount: card.remaining_balance
      });
    }

    // Call Admediacards API to delete/disable card
    try {
      const cardNumericId = parseInt(card.admediacards_card_id);
      await admediacardsClient.updateCard(cardNumericId, {
        Type: 'Status',
        Status: false // Disable the card
      });
    } catch (apiError) {
      logger.error('Failed to disable card in Admediacards:', apiError);
      // Continue with deletion even if API call fails
    }

    await CardRepository.update(cardId, {
      status: 'deleted',
      remaining_balance: 0,
      metadata: {
        ...card.metadata,
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        refunded_amount: card.remaining_balance
      }
    });

    logger.info('Card deleted', { userId, cardId });
  }

  /**
   * Update card spending limits
   */
  static async updateCardLimits(
    userId: string,
    cardId: string,
    newLimit: number
  ): Promise<CardDetails> {
    const card = await this.verifyCardOwnership(userId, cardId);
    
    if (card.status !== 'active') {
      throw new ValidationError('Can only update limits for active cards');
    }

    if (newLimit <= 0) {
      throw new ValidationError('Spending limit must be positive');
    }

    if (newLimit < card.spent_amount) {
      throw new ValidationError('New limit cannot be less than already spent amount');
    }

    // Calculate the difference
    const limitDifference = newLimit - card.spending_limit;
    
    if (limitDifference > 0) {
      // Increasing limit - check user balance
      const user = await UserRepository.findById(userId);
      if (!user || user.virtual_balance < limitDifference) {
        throw new InsufficientBalanceError(limitDifference, user?.virtual_balance || 0);
      }
      
      // Deduct from user balance
      await UserRepository.adjustBalance(userId, limitDifference, 'subtract');
    } else if (limitDifference < 0) {
      // Decreasing limit - refund to user
      await UserRepository.adjustBalance(userId, Math.abs(limitDifference), 'add');
    }

    // Update card limit in Admediacards
    try {
      const cardNumericId = parseInt(card.admediacards_card_id);
      await admediacardsClient.updateCard(cardNumericId, {
        Type: 'Limit',
        Limit: newLimit
      });
    } catch (apiError) {
      // Rollback balance changes
      if (limitDifference > 0) {
        await UserRepository.adjustBalance(userId, limitDifference, 'add');
      } else if (limitDifference < 0) {
        await UserRepository.adjustBalance(userId, Math.abs(limitDifference), 'subtract');
      }
      logger.error('Failed to update card limit in Admediacards:', apiError);
      throw new AppError('EXTERNAL_API_ERROR', 'Failed to update card limit', 500);
    }

    // Update card
    const updatedCard = await CardRepository.update(cardId, {
      spending_limit: newLimit,
      remaining_balance: newLimit - card.spent_amount,
      metadata: {
        ...card.metadata,
        limit_updated_at: new Date().toISOString(),
        limit_updated_by: userId,
        previous_limit: card.spending_limit
      }
    });

    logger.info('Card limit updated', {
      userId,
      cardId,
      oldLimit: card.spending_limit,
      newLimit
    });

    return this.formatCardResponse(updatedCard);
  }

  /**
   * Get card transactions
   */
  static async getCardTransactions(
    userId: string,
    cardId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    transactions: CardTransaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    await this.verifyCardOwnership(userId, cardId);

    // TODO: Implement transaction fetching from transactions table
    // For now, return empty array
    return {
      transactions: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };
  }

  /**
   * Helper: Verify card ownership
   */
  private static async verifyCardOwnership(
    userId: string, 
    cardId: string
  ): Promise<Card> {
    const card = await CardRepository.findById(cardId);
    
    if (!card) {
      throw new NotFoundError('Card not found');
    }

    if (card.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    return card;
  }

  /**
   * Helper: Generate unique card token
   */
  private static generateCardToken(): string {
    return `card_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Helper: Format card response
   */
  private static formatCardResponse(card: Card): CardDetails {
    const response: CardDetails = {
      id: card.id,
      cardToken: card.card_token,
      maskedPan: card.masked_pan,
      type: card.card_type,
      status: card.status,
      spendingLimit: card.spending_limit,
      spentAmount: card.spent_amount,
      remainingBalance: card.remaining_balance,
      currency: card.currency,
      createdAt: card.created_at
    };
    
    if (card.nickname) {
      response.nickname = card.nickname;
    }
    
    if (card.merchant_restrictions) {
      response.merchantRestrictions = card.merchant_restrictions;
    }
    
    if (card.expires_at) {
      response.expiresAt = card.expires_at;
    }
    
    return response;
  }
}