import { Controller, Get, Route, Tags, Security, Response, SuccessResponse } from 'tsoa';

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  balance: number;
  currency: string;
  tier_level: number;
  created_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

@Route('users')
@Tags('Users')
export class UsersDocsController extends Controller {
  /**
   * Get authenticated user's profile
   * @summary Get user profile
   * @returns User profile information
   */
  @Get('profile')
  @Security('Bearer')
  @Response<{ success: false; error: { code: string; message: string } }>(401, 'Unauthorized')
  @Response<{ success: false; error: { code: string; message: string } }>(404, 'User not found')
  @SuccessResponse('200', 'Success')
  public async getProfile(): Promise<ApiResponse<UserProfile>> {
    // This is just for documentation - actual implementation is in userController.ts
    return {
      success: true,
      data: {} as UserProfile
    };
  }
}

// Example for Cards endpoint
interface Card {
  id: string;
  user_id: string;
  card_number_masked: string;
  card_type: 'MASTERCARD' | 'VISA';
  status: 'ACTIVE' | 'FROZEN' | 'DISABLED';
  balance: number;
  spending_limit: number;
  created_at: string;
}

@Route('cards')
@Tags('Cards')
export class CardsDocsController extends Controller {
  /**
   * Get all cards for authenticated user
   * @summary List user cards
   * @returns List of user's virtual cards
   */
  @Get()
  @Security('Bearer')
  @Response<{ success: false; error: { code: string; message: string } }>(401, 'Unauthorized')
  @SuccessResponse('200', 'Success')
  public async getUserCards(): Promise<ApiResponse<Card[]>> {
    return {
      success: true,
      data: []
    };
  }

  /**
   * Create a new virtual card
   * @summary Create virtual card
   * @param requestBody Card creation parameters
   */
  @Post()
  @Security('Bearer')
  @Response<{ success: false; error: { code: string; message: string } }>(400, 'Bad Request')
  @Response<{ success: false; error: { code: string; message: string } }>(401, 'Unauthorized')
  @Response<{ success: false; error: { code: string; message: string } }>(429, 'Rate limit exceeded')
  @SuccessResponse('201', 'Card created')
  public async createCard(@Body() _requestBody: {
    card_type: 'MASTERCARD' | 'VISA';
    spending_limit?: number;
    name?: string;
  }): Promise<ApiResponse<Card>> {
    return {
      success: true,
      data: {} as Card
    };
  }
}

// Add this import at the top
import { Body, Post } from 'tsoa';