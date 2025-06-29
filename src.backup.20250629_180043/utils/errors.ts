export class AppError extends Error {
    public code: string;
    public statusCode: number;
    public details: any;
    public isOperational: boolean;

    constructor(
      code: string,
      message: string,
      statusCode: number = 400,
      details: any = null
    ) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
      this.details = details;
      this.name = 'AppError';
      this.isOperational = true;
    }
  }

  export class ValidationError extends AppError {
    constructor(details: any) {
      super('VALIDATION_ERROR', 'Validation failed', 400, details);
    }
  }

  export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication failed') {
      super('AUTHENTICATION_ERROR', message, 401);
    }
  }

  export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
      super('AUTHORIZATION_ERROR', message, 403);
    }
  }

  export class ForbiddenError extends AppError {
    constructor(message: string = 'Access forbidden') {
      super('FORBIDDEN', message, 403);
    }
  }

  export class NotFoundError extends AppError {
    constructor(resource: string) {
      super('NOT_FOUND', `${resource} not found`, 404);
    }
  }

  export class ConflictError extends AppError {
    constructor(message: string) {
      super('CONFLICT', message, 409);
    }
  }

  export class InternalError extends AppError {
    constructor(message: string = 'Internal server error') {
      super('INTERNAL_ERROR', message, 500);
    }
  }

  export class InsufficientBalanceError extends AppError {
    constructor(required: number, available: number) {
      super(
        'INSUFFICIENT_BALANCE', 
        `Insufficient balance. Required: $${required}, Available: $${available}`, 
        400
      );
      this.details = { required, available };
    }
  }

  export class DatabaseError extends AppError {
    constructor(message: string, originalError?: any) {
      super('DATABASE_ERROR', message, 500);
      if (originalError) {
        this.details = {
          code: originalError.code,
          detail: originalError.detail,
          hint: originalError.hint
        };
      }
    }
  }