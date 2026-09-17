"""Verify all 24 AGENTIA AI Base Textbooks for completeness, exact 220-page count, and integrity."""
import json
import re
from pathlib import Path
import pypdf

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base" / "textbooks"
TXT_DIR = ROOT / "apps" / "api" / "storage" / "ai-base" / "textbooks"
WEB_CAT = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base-textbooks.json"
API_CAT = ROOT / "apps" / "api" / "storage" / "ai-base" / "knowledge-textbooks-catalog.json"

def main():
    print("=" * 80)
    print("VERIFICATION SUITE: 24 ACADEMIC TEXTBOOKS (5,280 TOTAL PAGES)")
    print("=" * 80)

    # 1. Catalogs check
    assert WEB_CAT.exists(), f"Missing {WEB_CAT}"
    assert API_CAT.exists(), f"Missing {API_CAT}"
    web_books = json.loads(WEB_CAT.read_text(encoding="utf-8"))
    api_books = json.loads(API_CAT.read_text(encoding="utf-8"))

    print(f"[1] Catalogs: Web catalog has {len(web_books)} books, API catalog has {len(api_books)} books.")
    assert len(web_books) == 24, f"Expected 24 books in web catalog, got {len(web_books)}"
    assert len(api_books) == 24, f"Expected 24 books in api catalog, got {len(api_books)}"

    total_pdf_pages = 0
    total_txt_pages = 0
    total_bytes = 0

    for i, book in enumerate(web_books, 1):
        filename = book["filename"]
        pdf_path = PDF_DIR / filename
        txt_path = TXT_DIR / f"{Path(filename).stem}.txt"

        assert pdf_path.exists(), f"Missing PDF: {pdf_path}"
        assert txt_path.exists(), f"Missing TXT: {txt_path}"

        # Check PDF with pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        pdf_pages = len(reader.pages)
        file_size = pdf_path.stat().st_size
        total_bytes += file_size
        total_pdf_pages += pdf_pages

        # Check TXT markers
        txt_content = txt_path.read_text(encoding="utf-8")
        markers = re.findall(r"^PAGE (\d+)$", txt_content, re.MULTILINE)
        txt_pages_count = len(markers)
        total_txt_pages += txt_pages_count

        # Check for prohibited raw LaTeX syntax
        latex_matches = re.findall(r"(\\(?:frac|mathcal|lambda|text|begin|end|alpha|beta|sigma|theta|int|sum_)\b)", txt_content)
        assert len(latex_matches) == 0, f"Error: {txt_path.name} contains raw LaTeX commands: {latex_matches[:5]}"

        # Check for prohibited fake information / simulated metadata
        fake_terms = ["ISBN", "LCCN", "Library of Congress", "University Press", "Arthur M. Vance", "Elena Rostova", "Marcus H. Thorne", "Sarah Al-Mansoor", "Chen Wei"]
        for ft in fake_terms:
            assert ft.lower() not in txt_content.lower(), f"Error: {txt_path.name} contains prohibited fake metadata: '{ft}'"

        assert pdf_pages == 220, f"Error: {filename} has {pdf_pages} pages, expected 220!"
        assert txt_pages_count == 220, f"Error: {txt_path.name} has {txt_pages_count} markers, expected 220!"

        print(f"  [{i:02d}/24] OK: '{book['field_name']}' | {pdf_pages} PDF pp | {txt_pages_count} TXT markers | 0 raw LaTeX | 0 fake info | {file_size:,} bytes")

    print("=" * 80)
    print(f"VERIFICATION PASSED: ALL 24 TEXTBOOKS VALIDATED")
    print(f"  * Total Books: 24 / 24")
    print(f"  * Total PDF Pages: {total_pdf_pages:,} (Expected: 5,280)")
    print(f"  * Total TXT Markers: {total_txt_pages:,} (Expected: 5,280)")
    print(f"  * Total PDF Library Size: {total_bytes / (1024 * 1024):.2f} MB")
    print(f"  * Average PDF Size: {total_bytes / (24 * 1024):.1f} KB")
    print("=" * 80)

if __name__ == "__main__":
    main()
