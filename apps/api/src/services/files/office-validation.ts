import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
const execute = promisify(execFile);

// Office clients paginate editable text. Validate that pagination in an actual
// Office engine before production delivery, using an isolated process/profile.
export async function validateOfficePagination(
  bytes: Buffer,
  format: "docx" | "pptx",
  expected: number,
) {
  const executable = process.env.FILE_GENERATION_SOFFICE;
  if (!executable) {
    if (process.env.NODE_ENV === "production" && format === "docx")
      throw new Error(
        "The document worker requires FILE_GENERATION_SOFFICE for Office layout validation.",
      );
    return false;
  }
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "agentia-office-"));
  try {
    const input = path.join(temporary, `document.${format}`);
    await fs.writeFile(input, bytes, { mode: 0o600 });
    await execute(
      executable,
      [
        `-env:UserInstallation=${pathToFileURL(path.join(temporary, "profile")).href}`,
        "--headless",
        "--nologo",
        "--nodefault",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        temporary,
        input,
      ],
      { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const pdf = await PDFDocument.load(
      await fs.readFile(path.join(temporary, "document.pdf")),
    );
    if (pdf.getPageCount() !== expected)
      throw new Error(
        `Office layout produced ${pdf.getPageCount()} pages instead of ${expected}. Reduce page content and retry.`,
      );
    return true;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
