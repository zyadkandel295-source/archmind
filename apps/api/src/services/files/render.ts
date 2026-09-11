import { PDFDocument as PdfReader, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PDFParse } from "pdf-parse";
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

// pdf-parse's Node worker is shipped as an inlined data URL. Configuring it
// explicitly keeps the selectable-text validation self-contained when this
// module is traced into a Vercel serverless function.
const { getData: getPdfParseWorker } = require("pdf-parse/worker") as {
  getData: () => string;
};
PDFParse.setWorker(getPdfParseWorker());

const plain = (s: string) => s.replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, "$1$2");
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

function wrapPdfText(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of plain(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawPdfLines(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineHeight: number,
) {
  lines.forEach((line, index) =>
    page.drawText(line, { x, y: y - index * lineHeight, font, size, color }),
  );
}

function drawPdfPage(
  output: PDFPage,
  content: ContentPage,
  documentTitle: string,
  number: number,
  count: number,
  body: PDFFont,
  bold: PDFFont,
) {
  const left = 54;
  const width = 504;
  const minimumY = 58;
  output.drawText(documentTitle.slice(0, 120), {
    x: left,
    y: 764,
    font: body,
    size: 8,
    color: rgb(0.39, 0.45, 0.55),
  });
  const pageNumber = `${number} / ${count}`;
  output.drawText(pageNumber, {
    x: 558 - body.widthOfTextAtSize(pageNumber, 8),
    y: 28,
    font: body,
    size: 8,
    color: rgb(0.39, 0.45, 0.55),
  });
  let y = 724;
  const write = (text: string, size: number, font: PDFFont, indent = 0) => {
    const lineHeight = size + 3;
    const lines = wrapPdfText(text, font, size, width - indent);
    const height = lines.length * lineHeight;
    if (y - height < minimumY)
      throw new Error(`Page ${number} is too dense. Reduce content or split the section.`);
    drawPdfLines(output, lines, left + indent, y, font, size, rgb(0.12, 0.16, 0.23), lineHeight);
    y -= height + 8;
  };
  write(content.title, content.kind === "title" ? 28 : 20, bold);
  for (const block of content.blocks) {
    if (block.type === "paragraph") write(block.text, 11, body);
    else if (block.type === "heading") write(block.text, 13, bold);
    else if (block.type === "list" || block.type === "diagram") {
      const items = block.type === "list" ? block.items : block.steps;
      items.forEach((item, index) =>
        write(`${block.type === "diagram" || block.ordered ? `${index + 1}.` : "-"} ${item}`, 11, body, 10),
      );
    } else {
      const rows = [block.headers, ...block.rows];
      const columnWidth = width / block.headers.length;
      rows.forEach((row, rowIndex) => {
        const font = rowIndex === 0 ? bold : body;
        const cells = row.map((cell) => wrapPdfText(cell, font, 9, columnWidth - 16));
        const height = Math.max(...cells.map((lines) => lines.length)) * 11 + 16;
        if (y - height < minimumY)
          throw new Error(`Page ${number} table exceeds the page.`);
        row.forEach((_, column) => {
          const x = left + column * columnWidth;
          output.drawRectangle({
            x,
            y: y - height,
            width: columnWidth,
            height,
            color: rowIndex === 0 ? rgb(0.89, 0.92, 0.96) : rgb(1, 1, 1),
            borderColor: rgb(0.8, 0.84, 0.9),
            borderWidth: 0.5,
          });
          drawPdfLines(output, cells[column]!, x + 8, y - 11, font, 9, rgb(0.12, 0.16, 0.23), 11);
        });
        y -= height;
      });
      y -= 10;
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
  const words = pageText(page).split(/\s+/).filter(Boolean).length;
  if (words > 430 || page.blocks.length > 10)
    throw new Error(`Page ${index + 1} is too dense. Reduce content or split the section.`);
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
  const doc = await PdfReader.create();
  doc.setTitle(plan.title);
  doc.setAuthor("AGENTIA");
  doc.setSubject(plan.topic);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  pages.forEach((page, index) =>
    drawPdfPage(doc.addPage([612, 792]), page, plan.title, index + 1, pages.length, body, bold),
  );
  return Buffer.from(await doc.save());
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
        const rowH = [block.headers, ...block.rows].map((row) =>
          Math.max(
            0.46,
            ...row.map(
              (cell) =>
                Math.ceil(
                  plain(cell).length /
                    Math.max(12, Math.floor((11.9 / block.headers.length) * 8)),
                ) * 0.28 + 0.2,
            ),
          ),
        );
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
