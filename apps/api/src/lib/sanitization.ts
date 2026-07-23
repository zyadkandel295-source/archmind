/**
 * Lightweight server-side sanitization utilities.
 *
 * Replaces isomorphic-dompurify (which pulls jsdom → @exodus/bytes ESM)
 * with simple, dependency-free HTML stripping for the API layer.
 * The frontend already runs DOMPurify in the browser where it belongs.
 */

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const SCRIPT_RE = /<script[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_RE = /\s+on\w+="[^"]*"/gi;
const STYLE_RE = /<style[\s\S]*?<\/style>/gi;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

/** Strip every HTML tag, keeping inner text. */
function stripAllTags(html: string): string {
  return html
    .replace(HTML_COMMENT_RE, "")
    .replace(SCRIPT_RE, "")
    .replace(STYLE_RE, "")
    .replace(HTML_TAG_RE, "");
}

/** Allow only a whitelist of simple formatting tags. */
function stripUnsafeTags(html: string, allowedTags: string[]): string {
  const cleaned = html
    .replace(HTML_COMMENT_RE, "")
    .replace(SCRIPT_RE, "")
    .replace(STYLE_RE, "")
    .replace(EVENT_HANDLER_RE, "");

  // Build a regex that keeps only the allowed tags
  const allowed = allowedTags.map((t) => t.toLowerCase());
  return cleaned.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
    return allowed.includes(tag.toLowerCase()) ? match : "";
  });
}

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

  return stripAllTags(input).trim();
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

  return stripUnsafeTags(response, [
    "b", "i", "em", "strong", "p", "br", "a", "code", "pre",
  ]).trim();
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
