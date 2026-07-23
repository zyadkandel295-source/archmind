import { describe, expect, test } from "vitest";
import { sanitizeUserInput, sanitizeLLMResponse, validateMessageLength } from "./lib/sanitization";

describe("Chat Message Sanitization", () => {
  test("Blocks script tags in user input", () => {
    const malicious = "<script>alert('XSS')</script>Hello";
    const result = sanitizeUserInput(malicious);
    expect(result).not.toContain("<script>");
    expect(result).toBe("Hello");
  });

  test("Blocks event handlers", () => {
    const malicious = "<img src=x onerror=\"alert('XSS')\">";
    const result = sanitizeUserInput(malicious);
    expect(result).not.toContain("onerror");
  });

  test("Blocks iframe injection", () => {
    const malicious = "<iframe src='https://evil.com'></iframe>";
    const result = sanitizeUserInput(malicious);
    expect(result).not.toContain("<iframe>");
  });

  test("Allows plain text", () => {
    const clean = "Hello world, this is a message";
    const result = sanitizeUserInput(clean);
    expect(result).toBe(clean);
  });

  test("Sanitizes LLM response with allowed tags", () => {
    const response = "<p>This is <strong>bold</strong> text</p>";
    const result = sanitizeLLMResponse(response);
    expect(result).toContain("<strong>");
    expect(result).toContain("</strong>");
  });

  test("Removes script tags from LLM response", () => {
    const malicious = "<p>Hello</p><script>alert('XSS')</script>";
    const result = sanitizeLLMResponse(malicious);
    expect(result).not.toContain("<script>");
  });

  test("Rejects messages over length limit", () => {
    const longMessage = "a".repeat(10001);
    expect(validateMessageLength(longMessage)).toBe(false);
  });
});
