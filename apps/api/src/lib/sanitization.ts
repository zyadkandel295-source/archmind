import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize user-provided text content
 * - Removes all HTML tags
 * - Allows plain text and URLs
 * - Prevents XSS attacks
 */
export function sanitizeUserInput(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove any HTML tags completely
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
}

/**
 * Sanitize LLM-generated response
 * - Allows basic markdown-like formatting
 * - Removes script tags and event handlers
 * - Prevents XSS from AI-generated content
 */
export function sanitizeLLMResponse(response: unknown): string {
  if (typeof response !== "string") {
    return "";
  }

  return DOMPurify.sanitize(response, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "a", "code", "pre"],
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_DATA_ATTR: false,
  }).trim();
}

/**
 * Escape text for use in markdown
 * Prevents markdown injection attacks
 */
export function escapeMarkdown(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\\/g, "\\\\") // Backslash
    .replace(/\*/g, "\\*") // Asterisk (bold)
    .replace(/_/g, "\\_") // Underscore (italic)
    .replace(/\[/g, "\\[") // Square bracket
    .replace(/\]/g, "\\]")
    .replace(/`/g, "\\`") // Backtick (code)
    .replace(/~/g, "\\~") // Tilde (strikethrough)
    .replace(/\|/g, "\\|"); // Pipe (tables)
}

/**
 * Validate message length
 * Prevents abuse
 */
export function validateMessageLength(message: string, maxLength = 10000): boolean {
  if (typeof message !== "string") {
    return false;
  }
  return message.length > 0 && message.length <= maxLength;
}
