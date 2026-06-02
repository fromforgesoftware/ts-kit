// Core error class
export { ForgeError, setErrorMonitorHook, type ErrorMonitorHook } from './ForgeError';

// Validation errors
export { ValidationError, type IValidationError } from './ValidationError';

// Error mapping utilities
export { mapAxiosError, extractValidationErrors } from './mapAxiosError';

// Status helpers
export { isForbidden } from './isForbidden';

// Error handler
export {
	createErrorHandler,
	toErrorInfo,
	type ErrorInfo,
	type ErrorHandlerOptions,
} from './handleError';

// Types & constants
export { ErrorCodes } from './types';
export type { ErrorCode, ForgeErrorOptions } from './types';
