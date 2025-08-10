import logger from '../../utils/logger';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

/**
 * Circuit Breaker implementation for email providers
 * Prevents repeated calls to failing providers
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private halfOpenAttempts = 0;
  private lastFailureTime: Date | undefined;
  private nextRetryTime: Date | undefined;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  /**
   * Check if the circuit breaker allows a request
   */
  canAttempt(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        // Check if enough time has passed to retry
        if (this.nextRetryTime && Date.now() >= this.nextRetryTime.getTime()) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        // Allow limited attempts in half-open state
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
      
      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      
      // If we've had enough successful attempts, close the circuit
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.transitionToClosed();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
      this.lastFailureTime = undefined;
    }

    logger.debug(`Circuit breaker ${this.name}: Success recorded`, {
      state: this.state,
      failureCount: this.failureCount
    });
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we've exceeded the failure threshold
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    }

    logger.debug(`Circuit breaker ${this.name}: Failure recorded`, {
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold
    });
  }

  /**
   * Get the current state of the circuit breaker
   */
  getState(): CircuitState {
    // Check if we should transition from open to half-open
    if (this.state === CircuitState.OPEN && 
        this.nextRetryTime && 
        Date.now() >= this.nextRetryTime.getTime()) {
      this.transitionToHalfOpen();
    }

    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
      halfOpenAttempts: this.halfOpenAttempts
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
    
    logger.info(`Circuit breaker ${this.name}: Reset to closed state`);
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.config.resetTimeout);
    
    logger.warn(`Circuit breaker ${this.name}: Opened`, {
      failureCount: this.failureCount,
      nextRetryTime: this.nextRetryTime
    });
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenAttempts = 0;
    
    logger.info(`Circuit breaker ${this.name}: Transitioned to half-open`);
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
    
    logger.info(`Circuit breaker ${this.name}: Closed after successful recovery`);
  }
}