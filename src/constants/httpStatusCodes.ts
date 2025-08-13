/**
 * HTTP Status Code Constants
 * Provides consistent status code usage across the application
 */

export enum HttpStatusCode {
  // 2xx Success
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  RESET_CONTENT = 205,
  PARTIAL_CONTENT = 206,

  // 3xx Redirection
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  SEE_OTHER = 303,
  NOT_MODIFIED = 304,
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,

  // 4xx Client Errors
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYMENT_REQUIRED = 402,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  NOT_ACCEPTABLE = 406,
  PROXY_AUTH_REQUIRED = 407,
  REQUEST_TIMEOUT = 408,
  CONFLICT = 409,
  GONE = 410,
  LENGTH_REQUIRED = 411,
  PRECONDITION_FAILED = 412,
  PAYLOAD_TOO_LARGE = 413,
  URI_TOO_LONG = 414,
  UNSUPPORTED_MEDIA_TYPE = 415,
  RANGE_NOT_SATISFIABLE = 416,
  EXPECTATION_FAILED = 417,
  IM_A_TEAPOT = 418,
  MISDIRECTED_REQUEST = 421,
  UNPROCESSABLE_ENTITY = 422,
  LOCKED = 423,
  FAILED_DEPENDENCY = 424,
  TOO_EARLY = 425,
  UPGRADE_REQUIRED = 426,
  PRECONDITION_REQUIRED = 428,
  TOO_MANY_REQUESTS = 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
  UNAVAILABLE_FOR_LEGAL_REASONS = 451,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
  HTTP_VERSION_NOT_SUPPORTED = 505,
  VARIANT_ALSO_NEGOTIATES = 506,
  INSUFFICIENT_STORAGE = 507,
  LOOP_DETECTED = 508,
  NOT_EXTENDED = 510,
  NETWORK_AUTH_REQUIRED = 511
}

/**
 * Status code descriptions
 */
export const HttpStatusMessage: Record<HttpStatusCode, string> = {
  // 2xx Success
  [HttpStatusCode.OK]: 'OK',
  [HttpStatusCode.CREATED]: 'Created',
  [HttpStatusCode.ACCEPTED]: 'Accepted',
  [HttpStatusCode.NO_CONTENT]: 'No Content',
  [HttpStatusCode.RESET_CONTENT]: 'Reset Content',
  [HttpStatusCode.PARTIAL_CONTENT]: 'Partial Content',

  // 3xx Redirection
  [HttpStatusCode.MOVED_PERMANENTLY]: 'Moved Permanently',
  [HttpStatusCode.FOUND]: 'Found',
  [HttpStatusCode.SEE_OTHER]: 'See Other',
  [HttpStatusCode.NOT_MODIFIED]: 'Not Modified',
  [HttpStatusCode.TEMPORARY_REDIRECT]: 'Temporary Redirect',
  [HttpStatusCode.PERMANENT_REDIRECT]: 'Permanent Redirect',

  // 4xx Client Errors
  [HttpStatusCode.BAD_REQUEST]: 'Bad Request',
  [HttpStatusCode.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatusCode.PAYMENT_REQUIRED]: 'Payment Required',
  [HttpStatusCode.FORBIDDEN]: 'Forbidden',
  [HttpStatusCode.NOT_FOUND]: 'Not Found',
  [HttpStatusCode.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
  [HttpStatusCode.NOT_ACCEPTABLE]: 'Not Acceptable',
  [HttpStatusCode.PROXY_AUTH_REQUIRED]: 'Proxy Authentication Required',
  [HttpStatusCode.REQUEST_TIMEOUT]: 'Request Timeout',
  [HttpStatusCode.CONFLICT]: 'Conflict',
  [HttpStatusCode.GONE]: 'Gone',
  [HttpStatusCode.LENGTH_REQUIRED]: 'Length Required',
  [HttpStatusCode.PRECONDITION_FAILED]: 'Precondition Failed',
  [HttpStatusCode.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
  [HttpStatusCode.URI_TOO_LONG]: 'URI Too Long',
  [HttpStatusCode.UNSUPPORTED_MEDIA_TYPE]: 'Unsupported Media Type',
  [HttpStatusCode.RANGE_NOT_SATISFIABLE]: 'Range Not Satisfiable',
  [HttpStatusCode.EXPECTATION_FAILED]: 'Expectation Failed',
  [HttpStatusCode.IM_A_TEAPOT]: "I'm a teapot",
  [HttpStatusCode.MISDIRECTED_REQUEST]: 'Misdirected Request',
  [HttpStatusCode.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatusCode.LOCKED]: 'Locked',
  [HttpStatusCode.FAILED_DEPENDENCY]: 'Failed Dependency',
  [HttpStatusCode.TOO_EARLY]: 'Too Early',
  [HttpStatusCode.UPGRADE_REQUIRED]: 'Upgrade Required',
  [HttpStatusCode.PRECONDITION_REQUIRED]: 'Precondition Required',
  [HttpStatusCode.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatusCode.REQUEST_HEADER_FIELDS_TOO_LARGE]: 'Request Header Fields Too Large',
  [HttpStatusCode.UNAVAILABLE_FOR_LEGAL_REASONS]: 'Unavailable For Legal Reasons',

  // 5xx Server Errors
  [HttpStatusCode.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatusCode.NOT_IMPLEMENTED]: 'Not Implemented',
  [HttpStatusCode.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatusCode.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [HttpStatusCode.GATEWAY_TIMEOUT]: 'Gateway Timeout',
  [HttpStatusCode.HTTP_VERSION_NOT_SUPPORTED]: 'HTTP Version Not Supported',
  [HttpStatusCode.VARIANT_ALSO_NEGOTIATES]: 'Variant Also Negotiates',
  [HttpStatusCode.INSUFFICIENT_STORAGE]: 'Insufficient Storage',
  [HttpStatusCode.LOOP_DETECTED]: 'Loop Detected',
  [HttpStatusCode.NOT_EXTENDED]: 'Not Extended',
  [HttpStatusCode.NETWORK_AUTH_REQUIRED]: 'Network Authentication Required'
};

/**
 * Operation-specific status code conventions
 */
export const OperationStatusCodes = {
  // GET operations
  GET_SUCCESS: HttpStatusCode.OK,
  GET_NOT_FOUND: HttpStatusCode.NOT_FOUND,
  
  // POST operations
  POST_SUCCESS: HttpStatusCode.CREATED,
  POST_ACCEPTED: HttpStatusCode.ACCEPTED,
  POST_VALIDATION_ERROR: HttpStatusCode.BAD_REQUEST,
  POST_CONFLICT: HttpStatusCode.CONFLICT,
  
  // PUT operations
  PUT_SUCCESS: HttpStatusCode.OK,
  PUT_CREATED: HttpStatusCode.CREATED,
  PUT_NO_CONTENT: HttpStatusCode.NO_CONTENT,
  
  // PATCH operations
  PATCH_SUCCESS: HttpStatusCode.OK,
  PATCH_NO_CONTENT: HttpStatusCode.NO_CONTENT,
  
  // DELETE operations
  DELETE_SUCCESS: HttpStatusCode.OK,
  DELETE_NO_CONTENT: HttpStatusCode.NO_CONTENT,
  DELETE_ACCEPTED: HttpStatusCode.ACCEPTED,
  
  // Authentication
  AUTH_REQUIRED: HttpStatusCode.UNAUTHORIZED,
  AUTH_FORBIDDEN: HttpStatusCode.FORBIDDEN,
  
  // Validation
  VALIDATION_ERROR: HttpStatusCode.BAD_REQUEST,
  UNPROCESSABLE: HttpStatusCode.UNPROCESSABLE_ENTITY,
  
  // Rate limiting
  RATE_LIMITED: HttpStatusCode.TOO_MANY_REQUESTS,
  
  // Server errors
  SERVER_ERROR: HttpStatusCode.INTERNAL_SERVER_ERROR,
  SERVICE_UNAVAILABLE: HttpStatusCode.SERVICE_UNAVAILABLE,
  GATEWAY_TIMEOUT: HttpStatusCode.GATEWAY_TIMEOUT
};

/**
 * Check if status code indicates success
 */
export function isSuccessStatusCode(code: number): boolean {
  return code >= 200 && code < 300;
}

/**
 * Check if status code indicates client error
 */
export function isClientErrorStatusCode(code: number): boolean {
  return code >= 400 && code < 500;
}

/**
 * Check if status code indicates server error
 */
export function isServerErrorStatusCode(code: number): boolean {
  return code >= 500 && code < 600;
}

/**
 * Get status message by code
 */
export function getStatusMessage(code: HttpStatusCode): string {
  return HttpStatusMessage[code] || 'Unknown Status';
}