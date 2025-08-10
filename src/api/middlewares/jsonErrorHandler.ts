import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

/**
 * Middleware to handle JSON parsing errors with better user feedback
 * This should be placed after express.json() middleware
 */
export function jsonErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    const message = err.message || 'JSON parsing error';
    
    // Extract position from error message if available
    const positionMatch = message.match(/position (\d+)/i);
    const position = positionMatch?.[1] ? parseInt(positionMatch[1], 10) : null;
    
    // Common JSON errors and user-friendly messages
    let userMessage = 'Invalid JSON format in request body.';
    
    if (message.includes('Unexpected token')) {
      userMessage = 'Invalid JSON: Unexpected character found. Please check your JSON syntax.';
    } else if (message.includes('Unexpected end')) {
      userMessage = 'Invalid JSON: Incomplete JSON data. Please ensure all brackets and quotes are properly closed.';
    } else if (message.includes('Bad escaped character')) {
      userMessage = 'Invalid JSON: Incorrect escape sequence. Use double backslashes (\\\\) for literal backslashes.';
    } else if (message.includes('Unexpected string')) {
      userMessage = 'Invalid JSON: Missing comma or incorrect structure.';
    }
    
    // Log for debugging
    logger.warn('JSON parsing error', {
      originalMessage: message,
      position,
      endpoint: req.url,
      method: req.method,
      contentType: req.get('content-type'),
      bodySnippet: (err as any).body?.substring(0, 100)
    });
    
    res.status(400).json({
      success: false,
      error: {
        code: 'JSON_PARSE_ERROR',
        message: userMessage,
        ...(position && { position })
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).id
      }
    });
    return;
  }
  
  next(err);
}