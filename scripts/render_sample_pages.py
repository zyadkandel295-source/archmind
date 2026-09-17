"""Render high-resolution PNG previews of representative pages from the 220-page textbook."""
from pathlib import Path
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base" / "textbooks" / "Applications of AI and Technology — Artificial Intelligence.pdf"
ARTIFACT_DIR = Path(r"C:\Users\AL-FAGR\.gemini\antigravity-ide\brain\aef3f16a-6e1b-4ed7-b71c-07218e1d2ee7\sample_previews")
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

# Selected representative sample pages (1-indexed)
SAMPLE_PAGES = [
    (1, "page_001_cover.png", "Modern Cover Page (Clean Typography & Discipline Badge)"),
    (2, "page_002_license.png", "Open Educational License & Distribution Policy (No Fake Publisher/ISBN)"),
    (3, "page_003_curriculum_framework.png", "Curriculum Architecture & 5-Part Framework (No Fake Advisory Board)"),
    (4, "page_004_toc.png", "Table of Contents (Modern Minimalist Layout with Chapter Badges)"),
    (11, "page_011_chapter_opener.png", "Chapter 1 Opener (Learning Goals & Chapter Overview)"),
    (20, "page_020_vector_diagram.png", "Vector Architecture Flowchart & Engineering Schematic"),
    (22, "page_022_comparison_table.png", "Technical Comparison Table of Applied Computing Models"),
    (37, "page_037_equation_block.png", "Modern Equation Block (Structured Variables & Intuitive Explanation)"),
    (42, "page_042_chapter_review.png", "Chapter Review (Key Takeaways, Conceptual Questions & Applied Exercises)"),
    (171, "page_171_case_study.png", "Real-World Case Study (Architecture, Metrics, Failure Modes & Lessons)"),
    (220, "page_220_colophon.png", "Academic Colophon & Standards Certificate")
]

def main():
    print("=" * 80)
    print(f"RENDERING SAMPLE PAGES FROM: {PDF_PATH.name}")
    print(f"Destination: {ARTIFACT_DIR}")
    print("=" * 80)

    pdf = pdfium.PdfDocument(str(PDF_PATH))
    total_pages = len(pdf)
    print(f"Total pages in document: {total_pages}")

    for page_num, out_name, description in SAMPLE_PAGES:
        # pypdfium2 is 0-indexed
        page = pdf[page_num - 1]
        # Render at 150 DPI for crisp readability (scale = 150 / 72 = ~2.083)
        image = page.render(scale=2.0).to_pil()
        out_path = ARTIFACT_DIR / out_name
        image.save(str(out_path), "PNG")
        print(f"  [Rendered Page {page_num:03d}/220] -> {out_name} ({description})")

    # Also render Astronomy pages 2 & 3 (specifically requested by user)
    astro_pdf_path = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base" / "textbooks" / "Applications of AI and Technology — Astronomy.pdf"
    if astro_pdf_path.exists():
        astro_pdf = pdfium.PdfDocument(str(astro_pdf_path))
        for pg_num, out_name, desc in [
            (2, "astronomy_page_002_license.png", "Astronomy Page 2 (No Fake ISBN, LCCN, DOI)"),
            (3, "astronomy_page_003_framework.png", "Astronomy Page 3 (No Fake Advisory Board)")
        ]:
            page = astro_pdf[pg_num - 1]
            img = page.render(scale=2.0).to_pil()
            img.save(str(ARTIFACT_DIR / out_name), "PNG")
            print(f"  [Rendered Astronomy Page {pg_num:03d}/220] -> {out_name} ({desc})")

    print("=" * 80)
    print("All sample preview pages successfully rendered!")
    print("=" * 80)

if __name__ == "__main__":
    main()
