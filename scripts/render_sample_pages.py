"""Render high-resolution PNG previews of representative pages from the 23-book classical academic collection."""
from pathlib import Path
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base" / "textbooks"
ARTIFACT_DIR = Path(r"C:\Users\AL-FAGR\.gemini\antigravity-ide\brain\aef3f16a-6e1b-4ed7-b71c-07218e1d2ee7\sample_previews")
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

# Selected representative sample pages (1-indexed) demonstrating the classical academic monograph visual system
SAMPLE_PAGES = [
    (1, "page_001_cover.png", "Restrained Academic Cover (Title, Discipline, Subtitle, AGENTIA AI Base)"),
    (2, "page_002_toc.png", "Table of Contents Part 1 (Traditional dot leaders, chapter spans, clean margins)"),
    (7, "page_007_chapter1_opener.png", "Chapter 1 Opener (Classical chapter title rule, Section 1.1, pure prose)"),
    (15, "page_015_section1_2.png", "Section 1.2 Opener (Continuous academic paragraphs, traditional indent)"),
    (151, "page_151_question1.png", "Section 4.4 Core Question 1 (Central problem AI was introduced to solve)"),
    (158, "page_158_question8.png", "Section 4.4 Core Question 8 (Operational landscape of the field in 2026)"),
    (167, "page_167_chapter5_opener.png", "Chapter 5 Opener (State of the art in 2026, institutional impact)"),
    (207, "page_207_bibliography_part1.png", "Scholarly References Part 1 (Peer-reviewed citations with significance notes)"),
    (220, "page_220_bibliography_final.png", "Scholarly References Part 14 (Final bibliography page, exact page 220)")
]

def render_book_samples(book_name: str, prefix: str):
    pdf_path = PDF_DIR / f"Applications of AI and Technology — {book_name}.pdf"
    if not pdf_path.exists():
        print(f"Skipping {book_name}: file does not exist yet ({pdf_path})")
        return

    print(f"Rendering samples for '{book_name}'...")
    pdf = pdfium.PdfDocument(str(pdf_path))
    print(f"  Total pages: {len(pdf)}")

    for page_num, out_name, description in SAMPLE_PAGES:
        dest_filename = f"{prefix}_{out_name}" if prefix else out_name
        page = pdf[page_num - 1]
        image = page.render(scale=2.0).to_pil()
        out_path = ARTIFACT_DIR / dest_filename
        image.save(str(out_path), "PNG")
        print(f"  [Rendered Page {page_num:03d}/220] -> {dest_filename} ({description})")

def main():
    print("=" * 80)
    print("RENDERING CLASSICAL ACADEMIC TEXTBOOK SAMPLES")
    print(f"Destination: {ARTIFACT_DIR}")
    print("=" * 80)

    # Render Astronomy and Computer Science
    render_book_samples("Astronomy", "astronomy")
    render_book_samples("Computer Science", "cs")

    print("=" * 80)
    print("All sample preview pages successfully rendered!")
    print("=" * 80)

if __name__ == "__main__":
    main()
