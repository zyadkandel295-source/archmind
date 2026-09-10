import PDFDocument from "pdfkit";
import { PDFDocument as PdfReader } from "pdf-lib";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  LevelFormat,
} from "docx";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import {
  ContentPage,
  DocumentPlan,
  FileFormat,
  MAX_FILE_BYTES,
  pageText,
} from "./types";

const plain = (s: string) => s.replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, "$1$2");
// Static paths are visible to Vercel's output-file tracer.  Supplying a font
// in the constructor also stops PDFKit from lazily loading its optional
// Helvetica module, which is absent from some serverless bundles.
const PDF_FONTS = {
  Body: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf"),
  Bold: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"),
  Italic: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf"),
} as const;
function setupFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont("Body", PDF_FONTS.Body);
  doc.registerFont("Bold", PDF_FONTS.Bold);
  doc.registerFont("Italic", PDF_FONTS.Italic);
}
function pdfFont(name: "Body" | "Bold" | "Italic") {
  return name;
}
function runs(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map(
      (t) =>
        new TextRun({
          text: plain(t),
          bold: t.startsWith("**"),
          italics: t.startsWith("*") && !t.startsWith("**"),
        }),
    );
}
function pdfPage(
  doc: PDFKit.PDFDocument,
  page: ContentPage,
  title: string,
  number: number,
  count: number,
) {
  doc.addPage({
    size: "LETTER",
    margins: { top: 60, bottom: 60, left: 54, right: 54 },
  });
  setupFonts(doc);
  doc
    .font(pdfFont("Body"))
    .fontSize(8)
    .fillColor("#64748b")
    .text(title, 54, 28, { width: 504, lineBreak: false });
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.text(`${number} / ${count}`, 54, 752, {
    width: 504,
    align: "right",
    lineBreak: false,
  });
  doc.page.margins.bottom = bottom;
  doc.y = 66;
  const write = (text: string, size = 11, bold = false, indent = 0) => {
    // Measure every block before drawing: never clip or silently spill into an extra page.
    doc.font(pdfFont(bold ? "Bold" : "Body")).fontSize(size);
    const height = doc.heightOfString(plain(text), {
      width: 504 - indent,
      lineGap: 3,
    });
    if (doc.y + height > 716)
      throw new Error(
        `Page ${number} is too dense. Reduce content or split the section.`,
      );
    doc
      .fillColor(bold ? "#172554" : "#1e293b")
      .text(plain(text), 54 + indent, doc.y, {
        width: 504 - indent,
        lineGap: 3,
      });
    doc.y += 8;
  };
  write(page.title, page.kind === "title" ? 28 : 20, true);
  for (const block of page.blocks) {
    if (block.type === "paragraph") {
      // Rich text runs retain native selectable text.
      const height = doc
        .font(pdfFont("Body"))
        .fontSize(11)
        .heightOfString(plain(block.text), { width: 504, lineGap: 3 });
      if (doc.y + height + 5 > 716)
        throw new Error(`Page ${number} is too dense.`);
      const parts = block.text
        .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
        .filter(Boolean);
      const y = doc.y;
      parts.forEach((t, i) => {
        doc
          .font(pdfFont(t.startsWith("**") ? "Bold" : t.startsWith("*") ? "Italic" : "Body"))
          .fontSize(11)
          .fillColor("#1e293b");
        const options = {
          width: 504,
          lineGap: 3,
          continued: i < parts.length - 1,
        };
        if (i === 0) doc.text(plain(t), 54, y, options);
        else doc.text(plain(t), options);
      });
      if (doc.y > 716) throw new Error(`Page ${number} is too dense.`);
      doc.y += 8;
    } else if (block.type === "heading") write(block.text, 13, true);
    else if (block.type === "list" || block.type === "diagram") {
      const items = block.type === "list" ? block.items : block.steps;
      items.forEach((item, i) =>
        write(
          `${block.type === "diagram" || block.ordered ? `${i + 1}.` : "•"} ${item}`,
          11,
          false,
          10,
        ),
      );
    } else {
      const rows = [block.headers, ...block.rows];
      const width = 504 / block.headers.length;
      rows.forEach((row, index) => {
        doc.font(pdfFont(index === 0 ? "Bold" : "Body")).fontSize(9);
        const height =
          Math.max(
            ...row.map((cell) =>
              doc.heightOfString(plain(cell), { width: width - 16 }),
            ),
          ) + 16;
        if (doc.y + height > 716)
          throw new Error(`Page ${number} table exceeds the page.`);
        const y = doc.y;
        row.forEach((cell, col) => {
          doc
            .rect(54 + col * width, y, width, height)
            .fillAndStroke(index === 0 ? "#e2e8f0" : "#ffffff", "#cbd5e1");
          doc
            .fillColor("#1e293b")
            .text(plain(cell), 62 + col * width, y + 8, { width: width - 16 });
        });
        doc.y = y + height;
      });
      doc.y += 10;
    }
  }
}
export function assertPageFits(
  page: ContentPage,
  plan: DocumentPlan,
  index: number,
) {
  if (plan.format === "pptx") {
    const words = pageText(page).split(/\s+/).length;
    if (words > 120 || page.blocks.length > 5)
      throw new Error(
        "Slide is too dense: use at most 120 words and 5 blocks; put explanation in notes.",
      );
    return;
  }
  const doc = new PDFDocument({ autoFirstPage: false });
  doc.on("data", () => undefined);
  try {
    pdfPage(doc, page, plan.title, index + 1, plan.count);
  } finally {
    doc.end();
  }
}
export async function validateContentPage(
  page: ContentPage,
  plan: DocumentPlan,
  index: number,
) {
  assertPageFits(page, plan, index);
  if (plan.format === "pptx") await powerpoint({ ...plan, count: 1 }, [page]);
}
async function pdf(plan: DocumentPlan, pages: ContentPage[]) {
  const doc = new PDFDocument({
    autoFirstPage: false,
    font: PDF_FONTS.Body,
    info: { Title: plan.title, Author: "AGENTIA", Subject: plan.topic },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  pages.forEach((page, i) =>
    pdfPage(doc, page, plan.title, i + 1, pages.length),
  );
  doc.end();
  return done;
}
async function word(plan: DocumentPlan, pages: ContentPage[]) {
  const children: (Paragraph | Table)[] = [];
  pages.forEach((page, i) => {
    children.push(
      new Paragraph({
        text: page.title,
        heading:
          page.kind === "title" ? HeadingLevel.TITLE : HeadingLevel.HEADING_1,
        pageBreakBefore: i > 0,
        spacing: { after: 200 },
      }),
    );
    page.blocks.forEach((block, bi) => {
      if (block.type === "paragraph" || block.type === "heading")
        children.push(
          new Paragraph({
            children: runs(block.text),
            heading:
              block.type === "heading" ? HeadingLevel.HEADING_2 : undefined,
            spacing: { after: 140 },
          }),
        );
      else if (block.type === "table") {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [block.headers, ...block.rows].map(
              (row, ri) =>
                new TableRow({
                  tableHeader: ri === 0,
                  cantSplit: true,
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        margins: {
                          top: 100,
                          bottom: 100,
                          left: 100,
                          right: 100,
                        },
                        shading: ri === 0 ? { fill: "E2E8F0" } : undefined,
                        children: [new Paragraph({ children: runs(cell) })],
                      }),
                  ),
                }),
            ),
          }),
        );
        children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
      } else {
        const ordered = block.type === "diagram" || block.ordered;
        (block.type === "diagram" ? block.steps : block.items).forEach((item) =>
          children.push(
            new Paragraph({
              children: runs(item),
              numbering: ordered
                ? { reference: "ordered", level: 0, instance: i * 10 + bi }
                : undefined,
              bullet: ordered ? undefined : { level: 0 },
              spacing: { after: 100 },
            }),
          ),
        );
      }
    });
  });
  return Packer.toBuffer(
    new Document({
      title: plan.title,
      creator: "AGENTIA",
      description: plan.topic,
      styles: {
        default: {
          document: {
            run: { font: "Arial", size: 22 },
            paragraph: { spacing: { line: 280 } },
          },
        },
        paragraphStyles: [
          {
            id: "Title",
            name: "Title",
            basedOn: "Normal",
            run: { size: 48, bold: true, color: "000000" },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            run: { size: 36, bold: true, color: "172554" },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            run: { size: 26, bold: true, color: "172554" },
          },
        ],
      },
      numbering: {
        config: [
          {
            reference: "ordered",
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.START,
                style: { paragraph: { indent: { left: 360, hanging: 180 } } },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: plan.title,
                      size: 16,
                      color: "64748B",
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      children: [
                        PageNumber.CURRENT,
                        " / ",
                        PageNumber.TOTAL_PAGES,
                      ],
                      size: 16,
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    }),
  );
}
async function powerpoint(plan: DocumentPlan, pages: ContentPage[]) {
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  deck.author = "AGENTIA";
  deck.title = plan.title;
  deck.subject = plan.topic;
  deck.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  pages.forEach((page, index) => {
    const slide = deck.addSlide();
    slide.background = { color: page.kind === "title" ? "172554" : "FFFFFF" };
    const color = page.kind === "title" ? "FFFFFF" : "172554";
    slide.addText(page.title, {
      x: 0.7,
      y: 0.5,
      w: 11.9,
      h: 1.15,
      fontSize: page.kind === "title" ? 40 : 30,
      bold: true,
      color,
      margin: 0,
      breakLine: false,
    });
    let y = 1.9;
    page.blocks.forEach((block) => {
      if (block.type === "table") {
        // Reserve the measured height of every wrapped row before placing the next block.
        const measure = new PDFDocument();
        measure.resume();
        setupFonts(measure);
        measure.font(pdfFont("Body")).fontSize(16);
        const rowH = [block.headers, ...block.rows].map((row) =>
          Math.max(
            0.46,
            ...row.map(
              (cell) =>
                measure.heightOfString(plain(cell), {
                  width: (11.9 / block.headers.length) * 72 - 18,
                  lineGap: 2,
                }) /
                  72 +
                0.2,
            ),
          ),
        );
        measure.end();
        const tableHeight = rowH.reduce((sum, height) => sum + height, 0);
        if (y + tableHeight > 6.8)
          throw new Error(
            `Slide ${index + 1} table is too dense. Shorten its cells or reduce rows.`,
          );
        const rows = [
          block.headers.map((text) => ({
            text,
            options: { bold: true, fill: "E2E8F0" },
          })),
          ...block.rows.map((row) => row.map((text) => ({ text }))),
        ];
        slide.addTable(rows, {
          x: 0.7,
          y,
          w: 11.9,
          h: tableHeight,
          rowH,
          fontSize: 16,
          color,
          margin: 7.2,
          border: { type: "solid", pt: 0.5, color: "CBD5E1" },
          autoPage: false,
        });
        y += tableHeight + 0.25;
      } else if (block.type === "diagram") {
        const width = 11.4 / block.steps.length;
        block.steps.forEach((step, i) =>
          slide.addText(`${i + 1}. ${plain(step)}`, {
            x: 0.7 + i * width,
            y,
            w: width - 0.15,
            h: 1.3,
            fontSize: 19,
            color,
            margin: 0.1,
            bold: true,
          }),
        );
        y += 1.5;
      } else {
        const lines = block.type === "list" ? block.items : [block.text];
        lines.forEach((line, i) => {
          const h = Math.max(0.34, Math.ceil(line.length / 96) * 0.32);
          if (y + h > 6.8)
            throw new Error(
              `Slide ${index + 1} overflows. Reduce visible text.`,
            );
          slide.addText(plain(line), {
            x: 0.7,
            y,
            w: 11.8,
            h,
            fontSize: block.type === "heading" ? 20 : 18,
            bold: block.type === "heading",
            color,
            margin: 0,
            breakLine: false,
            ...(block.type === "list"
              ? {
                  bullet: block.ordered
                    ? { type: "number" as const, numberStartAt: i + 1 }
                    : { indent: 18 },
                  paraSpaceAfterPt: 6,
                }
              : {}),
          });
          y += h + 0.09;
        });
      }
      if (y > 6.9)
        throw new Error(`Slide ${index + 1} content exceeds available height.`);
    });
    slide.addText(`${index + 1} / ${pages.length}`, {
      x: 11.4,
      y: 7.05,
      w: 1.2,
      h: 0.2,
      fontSize: 10,
      color,
      align: "right",
      margin: 0,
    });
    slide.addNotes(page.notes || page.summary);
  });
  return Buffer.from(
    (await deck.write({ outputType: "nodebuffer" })) as Buffer,
  );
}
export async function validateFile(
  bytes: Buffer,
  format: FileFormat,
  count: number,
) {
  if (bytes.length < 100 || bytes.length > MAX_FILE_BYTES)
    throw new Error("Invalid file size.");
  if (format === "pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("Invalid PDF signature.");
    const doc = await PdfReader.load(bytes);
    if (doc.getPageCount() !== count || count < 1 || count > 50)
      throw new Error("PDF page count does not match the document plan.");
    if (doc.getPages().some((p) => !p.node.Contents()))
      throw new Error("PDF contains an empty page.");
  } else {
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    if (!zip.file("[Content_Types].xml") || !zip.file("_rels/.rels"))
      throw new Error("Invalid Office archive.");
    if (format === "docx") {
      const xml = await zip.file("word/document.xml")?.async("string");
      if (!xml || !/<w:t[ >]/.test(xml))
        throw new Error("Word document has no content.");
    } else {
      const slides = Object.keys(zip.files).filter((n) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(n),
      );
      if (slides.length !== count || !zip.file("ppt/presentation.xml"))
        throw new Error("PowerPoint slide count does not match the plan.");
      for (const name of slides)
        if (!/<a:t>.+?<\/a:t>/.test(await zip.file(name)!.async("string")))
          throw new Error("PowerPoint has an empty slide.");
    }
  }
}
export async function renderFile(plan: DocumentPlan, pages: ContentPage[]) {
  if (pages.length !== plan.count)
    throw new Error("Incomplete document content.");
  pages.forEach((p, i) => assertPageFits(p, plan, i));
  const bytes = await (plan.format === "pdf"
    ? pdf(plan, pages)
    : plan.format === "docx"
      ? word(plan, pages)
      : powerpoint(plan, pages));
  await validateFile(bytes, plan.format, pages.length);
  if (plan.format === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      const text = await parser.getText();
      if (
        text.pages.length !== pages.length ||
        text.pages.some((p) => p.text.trim().length < 20)
      )
        throw new Error(
          "PDF text extraction failed: a page has no selectable content.",
        );
      const normalize = (value: string) =>
        plain(value).replace(/\s+/g, "").normalize("NFKC");
      if (
        pages.some(
          (p, i) =>
            !normalize(text.pages[i]!.text).includes(normalize(p.title)),
        )
      )
        throw new Error(
          "PDF text validation failed: a page title is missing or uses unsupported characters.",
        );
    } finally {
      await parser.destroy();
    }
  }
  return bytes;
}
