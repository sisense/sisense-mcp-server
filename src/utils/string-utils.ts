/**
 * Convert a string to kebab-case
 * Example: "My Chart Title" -> "my-chart-title"
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Sanitizes user input for safe use in text content.
 * Prevents injection attacks, format breaking, and DoS through:
 * - Truncating extremely long strings
 * - Escaping control characters and newlines
 * - Normalizing whitespace
 * - Removing characters that could break JSON/text formatting
 *
 * @param input - The user-provided string to sanitize
 * @param maxLength - Maximum allowed length (default: 500 characters)
 * @returns Sanitized string safe for use in text content
 */
export function sanitizeForText(input: string, maxLength: number = 500): string {
  if (typeof input !== 'string') {
    return '';
  }

  const sanitized = input
    // Truncate first to prevent processing extremely long strings
    .slice(0, maxLength)
    // Replace control characters (except newlines/tabs which we'll handle separately)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize newlines to spaces (prevents format breaking)
    .replace(/\r\n|\r|\n/g, ' ')
    // Normalize tabs to spaces
    .replace(/\t/g, ' ')
    // Collapse multiple spaces into single space
    .replace(/\s+/g, ' ')
    // Trim leading/trailing whitespace
    .trim();

  return sanitized;
}

/**
 * Sanitizes user input for safe use in prompt descriptions.
 * Uses stricter limits than sanitizeForText() since descriptions are typically shorter.
 *
 * @param input - The user-provided string to sanitize
 * @param maxLength - Maximum allowed length (default: 200 characters)
 * @returns Sanitized string safe for use in descriptions
 */
export function sanitizeForDescription(input: string, maxLength: number = 200): string {
  return sanitizeForText(input, maxLength);
}

/**
 * Sanitizes error objects and messages to prevent token/credential exposure in logs.
 * Removes sensitive information like URLs with query parameters, tokens, and credentials.
 *
 * @param error - Error object, string, or unknown value to sanitize
 * @param includeStack - Whether to include stack trace (default: false for security)
 * @returns Sanitized error object safe for logging
 */
export function sanitizeError(
  error: unknown,
  includeStack: boolean = false,
): { message: string; stack?: string } {
  let errorMessage = 'Unknown error';
  let errorStack: string | undefined;

  // Extract error message
  if (error instanceof Error) {
    errorMessage = error.message;
    errorStack = error.stack;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error !== null && typeof error === 'object') {
    // Try to extract message from error-like objects
    if ('message' in error && typeof error.message === 'string') {
      errorMessage = error.message;
    } else if ('error' in error && typeof error.error === 'string') {
      errorMessage = error.error;
    } else {
      // Fallback: stringify but sanitize it
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }
  } else {
    errorMessage = String(error);
  }

  // Sanitize the error message
  const sanitized = errorMessage
    // First, remove URLs with credentials embedded (user:pass@host)
    .replace(/https?:\/\/[^/\s]+:[^@/\s]+@[^\s"']+/g, (match) => {
      try {
        const url = new URL(match);
        return `${url.protocol}//${url.hostname}${url.pathname}[REDACTED]`;
      } catch {
        return '[REDACTED]';
      }
    })
    // Remove sensitive query parameters from URLs (e.g., ?sisenseUrl=...&sisenseToken=...)
    .replace(
      /(https?:\/\/[^\s"']*?)[?&](sisenseUrl|sisenseToken|token|apiKey|apikey|password|secret)=[^&\s"']+/gi,
      '$1[REDACTED]',
    )
    // Remove standalone URLs and strip their query parameters
    .replace(/https?:\/\/[^\s"']+/g, (match) => {
      // Skip if already contains [REDACTED] (already sanitized)
      if (match.includes('[REDACTED]')) {
        return match;
      }
      try {
        const url = new URL(match);
        // Remove query parameters but keep path
        return `${url.protocol}//${url.hostname}${url.pathname}`;
      } catch {
        // If URL parsing fails, just remove query-like patterns
        return match.split('?')[0].split('&')[0];
      }
    })
    // Replace long alphanumeric strings that look like tokens (32+ chars)
    // Includes dots (.) for JWTs, and base64 chars (+ / =) for base64 tokens
    .replace(/[a-zA-Z0-9_.+/-]{32,}/g, (match) => {
      // Don't redact if it's part of a common non-token pattern
      if (
        match.includes('-') && // UUIDs have dashes
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match)
      ) {
        return match; // Keep UUIDs
      }
      // Redact long token-like strings
      return '[REDACTED]';
    })
    // Remove common credential patterns
    // Includes dots (.) for JWTs, and base64 chars (+ / =) for base64 tokens
    .replace(
      /(token|api[_-]?key|password|secret|credential)[\s:=]+['"]?[a-zA-Z0-9_.+/-]{20,}['"]?/gi,
      '[REDACTED]',
    );

  // Sanitize stack trace if included
  let sanitizedStack: string | undefined;
  if (includeStack && errorStack) {
    sanitizedStack = sanitizeError(errorStack, false).message;
  }

  return {
    message: sanitized,
    ...(sanitizedStack && { stack: sanitizedStack }),
  };
}

/**
 * Validates a URL string with security constraints.
 * Prevents DoS attacks through length limits and ensures proper URL format.
 *
 * @param url - The URL string to validate
 * @param options - Validation options
 * @param options.maxLength - Maximum URL length (default: 2048)
 * @param options.requireHttps - Whether to enforce HTTPS protocol (default: false)
 * @returns Validated URL string
 * @throws Error if URL is invalid
 */
export function validateUrl(
  url: string,
  options: { maxLength?: number; requireHttps?: boolean } = {},
): string {
  const { maxLength = 2048, requireHttps = false } = options;

  if (typeof url !== 'string') {
    throw new Error('URL must be a string');
  }

  const trimmed = url.trim();

  if (!trimmed) {
    throw new Error('URL cannot be empty');
  }

  if (trimmed.length > maxLength) {
    throw new Error(`URL exceeds maximum length of ${maxLength} characters`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch (error) {
    throw new Error(
      `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Validate protocol
  if (requireHttps && parsedUrl.protocol !== 'https:') {
    throw new Error('URL must use HTTPS protocol');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('URL must use HTTP or HTTPS protocol');
  }

  // Validate hostname (basic check)
  if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
    throw new Error('URL must have a valid hostname');
  }

  return trimmed;
}

/**
 * Generates a short, unique ID for an artifact (chart, query, dashboard, etc.).
 * Uses the first segment of a UUID (8 hex chars) to keep IDs readable for LLMs.
 * Example: generateArtifactId('chart') → 'chart-3f2504e0'
 */
export function generateArtifactId(type: string): string {
  return `${type}-${crypto.randomUUID().split('-')[0]}`;
}

/**
 * Validates a token string with security constraints.
 * Prevents DoS attacks through length limits and ensures non-empty value.
 *
 * @param token - The token string to validate
 * @param options - Validation options
 * @param options.maxLength - Maximum token length (default: 2048)
 * @param options.minLength - Minimum token length (default: 1)
 * @returns Validated token string (trimmed)
 * @throws Error if token is invalid
 */
export function validateToken(
  token: string,
  options: { maxLength?: number; minLength?: number } = {},
): string {
  const { maxLength = 2048, minLength = 1 } = options;

  if (typeof token !== 'string') {
    throw new Error('Token must be a string');
  }

  const trimmed = token.trim();

  if (trimmed.length < minLength) {
    throw new Error(`Token must be at least ${minLength} character(s) long`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`Token exceeds maximum length of ${maxLength} characters`);
  }

  return trimmed;
}
