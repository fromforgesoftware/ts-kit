// Core error class
export { ForgeError, setErrorMonitorHook, type ErrorMonitorHook } from './ForgeError.js';

// Validation errors
export { ValidationError, type IValidationError } from './ValidationError.js';

// Error mapping utilities
export { mapAxiosError, extractValidationErrors } from './mapAxiosError.js';

// Status helpers
export { isForbidden } from './isForbidden.js';

// Error handler
export {
	createErrorHandler,
	toErrorInfo,
	type ErrorInfo,
	type ErrorHandlerOptions,
} from './handleError.js';

// Types & constants
export { ErrorCodes } from './types.js';
export type { ErrorCode, ForgeErrorOptions } from './types.js';
