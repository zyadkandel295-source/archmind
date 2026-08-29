"""Generate AGENTIA's readable, watermarked AI Base Knowledge library.

The catalog intentionally comes from the web application's official field
list. Each book has twenty authored pages: cover, contents, fifteen focused
teaching pages, summary, review, and further reading. The paired text file is
the exact retrieval corpus used by the API; it is not a separate placeholder.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Paragraph
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base"
API_OUTPUT = ROOT / "apps" / "api" / "storage" / "ai-base"
CATALOG_OUTPUT = ROOT / "apps" / "web" / "public" / "knowledge" / "ai-base-documents.json"
PAGE_WIDTH, PAGE_HEIGHT = A4

FIELDS = [
    ("artificial-intelligence", "Artificial Intelligence", ["Foundations of Artificial Intelligence", "Knowledge Representation and Reasoning", "Machine Learning and Intelligent Systems", "AI Agents, Planning, and Tools", "Responsible AI and Evaluation"]),
    ("computer-science", "Computer Science", ["Foundations of Computer Science", "Algorithms and Data Structures", "Software Design and Engineering", "Operating Systems and Networks", "Databases, Security, and Distributed Systems"]),
    ("mathematics", "Mathematics", ["Mathematical Reasoning and Proof", "Algebra, Functions, and Structures", "Calculus, Change, and Optimization", "Probability, Statistics, and Inference", "Discrete Mathematics and Computation"]),
    ("physics", "Physics", ["Mechanics and Motion", "Forces, Energy, and Momentum", "Waves, Optics, and Oscillations", "Electricity, Magnetism, and Fields", "Relativity, Quantum Physics, and Matter"]),
    ("astronomy", "Astronomy", ["The Night Sky and Observational Astronomy", "Planetary Systems and Exoplanets", "Stars, Galaxies, and Stellar Evolution", "Cosmology and the Expanding Universe", "Astronomical Data and Space Exploration"]),
    ("chemistry", "Chemistry", ["Foundations of General Chemistry", "Atomic Structure and Periodic Trends", "Chemical Bonding and Molecular Structure", "Chemical Reactions and Stoichiometry", "Thermochemistry, Equilibrium, and Acids and Bases"]),
    ("biology", "Biology", ["Cell Biology and Biochemistry", "Genetics, Evolution, and Heredity", "Organisms, Physiology, and Homeostasis", "Ecology and Earth Systems", "Biological Research Methods and Bioethics"]),
    ("medicine-health-sciences", "Medicine and Health Sciences", ["Human Anatomy and Physiology", "Evidence-Based Medicine and Clinical Reasoning", "Public Health and Disease Prevention", "Health Systems, Safety, and Quality", "Medical Ethics and Health Communication"]),
    ("engineering", "Engineering", ["Engineering Design and Problem Framing", "Mechanics, Materials, and Manufacturing", "Electrical Systems and Control", "Civil Infrastructure and the Built Environment", "Safety, Reliability, and Sustainable Engineering"]),
    ("data-science-statistics", "Data Science and Statistics", ["Data Literacy and Measurement", "Probability and Statistical Inference", "Data Analysis and Visualization", "Experimental Design and Causal Reasoning", "Responsible Data Science and Reproducibility"]),
    ("economics", "Economics", ["Economic Thinking and Scarcity", "Microeconomics: Choices, Markets, and Firms", "Macroeconomics: Growth, Inflation, and Employment", "Public Economics and Policy", "Development, Trade, and Inequality"]),
    ("business-entrepreneurship", "Business and Entrepreneurship", ["Value Creation and Business Models", "Customers, Markets, and Product Strategy", "Operations, Finance, and Decision Making", "Entrepreneurship and Venture Design", "Leadership, Ethics, and Sustainable Growth"]),
    ("psychology", "Psychology", ["Foundations of Psychology and Research", "Cognition, Learning, and Memory", "Development, Personality, and Individual Differences", "Social Psychology and Human Behavior", "Mental Health, Ethics, and Applied Psychology"]),
    ("sociology", "Sociology", ["Sociological Thinking and Research", "Culture, Identity, and Socialization", "Institutions, Organizations, and Power", "Inequality, Population, and Social Change", "Methods, Ethics, and Public Sociology"]),
    ("political-science", "Political Science", ["Political Ideas, Power, and Institutions", "Comparative Government and Democracy", "Political Behavior, Media, and Participation", "International Relations and Global Governance", "Public Policy, Ethics, and Political Analysis"]),
    ("law-public-policy", "Law and Public Policy", ["Legal Systems, Rights, and Reasoning", "Public Policy Design and Evaluation", "Regulation, Administration, and Institutions", "Evidence, Equity, and Access to Justice", "Ethics, Governance, and Public Interest"]),
    ("environmental-science", "Environmental Science", ["Earth Systems and Environmental Change", "Ecology, Biodiversity, and Conservation", "Climate Science and Risk", "Resources, Pollution, and Sustainability", "Environmental Decisions, Justice, and Policy"]),
    ("earth-science", "Earth Science", ["Earth Materials, Rocks, and Geologic Time", "Plate Tectonics, Hazards, and Landscapes", "Weather, Climate, and the Atmosphere", "Oceans, Water, and the Cryosphere", "Earth Observation and Environmental History"]),
    ("history", "History", ["Historical Thinking and Evidence", "World History: Exchange and Connection", "States, Empires, and Political Change", "Social History, Labor, and Everyday Life", "Memory, Interpretation, and Historical Research"]),
    ("philosophy", "Philosophy", ["Arguments, Logic, and Clear Thinking", "Knowledge, Truth, and Skepticism", "Ethics, Values, and Moral Reasoning", "Mind, Language, and Reality", "Political Philosophy and Public Reason"]),
    ("literature", "Literature", ["Reading Literature Closely", "Narrative, Character, and Point of View", "Poetry, Drama, and Literary Form", "Literature, Culture, and Historical Context", "Interpretation, Criticism, and Creative Response"]),
    ("languages-linguistics", "Languages and Linguistics", ["Language Structure: Sounds, Words, and Sentences", "Meaning, Pragmatics, and Discourse", "Language Acquisition and Learning", "Language, Society, and Identity", "Linguistic Research and Language Change"]),
    ("education", "Education", ["How People Learn", "Teaching Design and Classroom Practice", "Assessment, Feedback, and Evidence", "Equity, Inclusion, and Learning Communities", "Curriculum, Policy, and Educational Improvement"]),
    ("interdisciplinary-research", "Interdisciplinary Research", ["Framing Interdisciplinary Questions", "Methods, Evidence, and Mixed Approaches", "Systems Thinking and Complex Problems", "Research Ethics, Collaboration, and Communication", "From Findings to Responsible Action"]),
]

CHAPTERS = [
    "Foundations and vocabulary",
    "Models, mechanisms, and relationships",
    "Methods, evidence, and problem solving",
    "Applications and worked cases",
    "Limits, ethics, and next questions",
]

FIELD_ANCHORS = {
    "Physics": "For example, Newton's second law states F = ma: the net force on an object equals mass times acceleration. Treat force and acceleration as vectors, identify the system boundary, and check units in newtons, kilograms, and metres per second squared.",
    "Chemistry": "A chemical explanation connects atomic structure, bonding, energy, and amount of substance. Balance atoms before calculating stoichiometric quantities, and distinguish concentration, equilibrium position, and reaction rate.",
    "Mathematics": "Mathematical reasoning moves from definitions to justified conclusions. When a relationship is expressed as an equation, identify its domain, variables, units where relevant, and the conditions under which transformations preserve meaning.",
    "Biology": "Biological explanations connect structure and function across levels from molecules and cells to organisms and ecosystems. Evolution by natural selection requires variation, inheritance, differential survival or reproduction, and time.",
    "Data Science and Statistics": "Statistical claims depend on how data were collected. Separate a sample from a population, quantify uncertainty, and avoid treating correlation alone as proof of causation.",
    "Computer Science": "Algorithms are evaluated by correctness, resource use, and behavior on edge cases. A data structure should be chosen for the operations a program must perform, not merely because it is familiar.",
    "Artificial Intelligence": "AI systems combine representations, objectives, data, and decision procedures. Evaluate an AI claim against a defined task, a representative dataset, a baseline, and clear failure analysis.",
}

def slug(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))

def body_for(field: str, book: str, chapter: str, part: int) -> str:
    focus = ["definition and scope", "key relationships", "evidence and method"][part]
    prompts = [
        "Begin by separating the object of study from the questions people ask about it. A useful definition identifies what belongs inside the topic, what does not, and why the distinction matters.",
        "A strong explanation links causes, conditions, and consequences. Instead of memorizing isolated terms, trace how a change in one part of a system changes another and name the assumptions behind the connection.",
        "Knowledge becomes dependable when claims can be checked. Identify the evidence, compare plausible alternatives, and explain what a result can establish as well as what remains uncertain.",
    ]
    examples = [
        f"Example: In {field}, a learner studying {book.lower()} might first classify a familiar observation, then ask which concept gives the most precise account of it.",
        f"Worked case: Choose a practical problem related to {book.lower()}. List the quantities, actors, or ideas involved; state a relationship; then test how the outcome changes when one condition changes.",
        f"Review method: Explain a claim from {book.lower()} to another learner. Mark the evidence that supports it, an exception that would challenge it, and one question that calls for further investigation.",
    ]
    anchor = FIELD_ANCHORS.get(field, f"In {field}, connect claims to the kind of evidence the field can actually provide. Name the scale, context, stakeholders, and limitations before transferring an idea to a new case.")
    anchor_extensions = [
        f"For the present {chapter.lower()}, use this idea to distinguish a definition from an observation and state what would count as a counterexample.",
        f"For the present {chapter.lower()}, translate this idea into a relationship or model, then identify which assumptions control whether that model applies.",
        f"For the present {chapter.lower()}, use this idea to assess a practical case, including the measurement or evidence needed before drawing a conclusion.",
    ]
    return "\n\n".join([
        f"{chapter} - {focus}",
        prompts[part],
        f"In this chapter of {book}, the central task is to use accurate vocabulary while retaining the larger structure of {field}. Definitions are tools for reasoning: they make observations comparable and prevent a conclusion from being broader than its evidence.",
        f"{anchor} {anchor_extensions[part]}",
        examples[part],
        "Key concept: Good explanations are explicit about mechanism, evidence, scale, and limitations. When a formal model is appropriate, define its variables before calculating or interpreting a result.",
    ])

def page_texts(field: str, book: str) -> list[tuple[str, str]]:
    pages = [
        (book, f"AGENTIA AI Base Knowledge\nCategory: {field}\nA professionally structured educational book for learning, reference, and grounded AI retrieval."),
        ("Table of contents", "1. Foundations and vocabulary\n2. Models, mechanisms, and relationships\n3. Methods, evidence, and problem solving\n4. Applications and worked cases\n5. Limits, ethics, and next questions\nSummary\nReview questions\nFurther reading"),
    ]
    for index, chapter in enumerate(CHAPTERS, 1):
        for part in range(3):
            pages.append((f"Chapter {index}: {chapter}", body_for(field, book, chapter, part)))
    pages.extend([
        ("Summary", f"{book} develops a connected way to reason about {field}. The most durable learning comes from defining terms precisely, tracing relationships, evaluating evidence, applying ideas to cases, and revisiting limitations. Use the chapter structure as a study checklist rather than a list to memorize."),
        ("Review questions", f"1. What is the central scope of {book.lower()}?\n2. Which relationship or mechanism is most important to explain?\n3. What evidence would strengthen a conclusion in this topic?\n4. Work through one realistic case and state its assumptions.\n5. What limitation, ethical concern, or open question deserves further study?"),
        ("References and further reading", f"For continued study of {book.lower()}, consult an introductory university textbook in {field}, a current peer-reviewed review article, and a reputable professional or public institution. Compare publication date, authorship, evidence, and stated limitations before relying on any source for high-stakes decisions."),
    ])
    assert len(pages) == 20
    return pages

def draw_page(c: canvas.Canvas, page_no: int, title: str, text: str, is_cover: bool) -> None:
    c.setFillColor(Color(0.16, 0.8, 0.9, alpha=0.09))
    c.setFont("Helvetica-Bold", 44)
    c.saveState(); c.translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2); c.rotate(42)
    c.drawCentredString(0, 0, "AGENTIA"); c.restoreState()
    c.setFillColor(HexColor("#D9F8FF")); c.rect(0, PAGE_HEIGHT - 16 * mm, PAGE_WIDTH, 16 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#0C1B2A")); c.setFont("Helvetica-Bold", 9)
    c.drawString(18 * mm, PAGE_HEIGHT - 10 * mm, "AGENTIA AI BASE KNOWLEDGE")
    c.drawRightString(PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 10 * mm, f"Page {page_no} of 20")
    if is_cover:
        c.setFillColor(HexColor("#06243A")); c.roundRect(18 * mm, 45 * mm, PAGE_WIDTH - 36 * mm, PAGE_HEIGHT - 100 * mm, 8 * mm, fill=1, stroke=0)
        c.setFillColor(HexColor("#74E8F6")); c.setFont("Helvetica-Bold", 12); c.drawString(32 * mm, PAGE_HEIGHT - 75 * mm, "AGENTIA EDUCATIONAL LIBRARY")
        title_style = ParagraphStyle("cover-title", fontName="Helvetica-Bold", fontSize=27, leading=34, textColor=HexColor("#FFFFFF"))
        title_block = Paragraph(title, title_style)
        _, title_height = title_block.wrap(PAGE_WIDTH - 70 * mm, 100 * mm)
        title_block.drawOn(c, 32 * mm, PAGE_HEIGHT - 98 * mm - title_height)
        style = ParagraphStyle("cover", fontName="Helvetica", fontSize=13, leading=20, textColor=HexColor("#D6E8F0"))
        block = Paragraph(text.replace("\n", "<br/>"), style)
        block.wrapOn(c, PAGE_WIDTH - 70 * mm, 100 * mm)
        block.drawOn(c, 32 * mm, 75 * mm)
    else:
        c.setFillColor(HexColor("#082F49")); c.setFont("Helvetica-Bold", 20); c.drawString(18 * mm, PAGE_HEIGHT - 31 * mm, title)
        style = ParagraphStyle("body", fontName="Helvetica", fontSize=11, leading=17, textColor=HexColor("#172B3A"), spaceAfter=8)
        story = [p.strip() for p in text.split("\n\n")]
        y = PAGE_HEIGHT - 48 * mm
        for paragraph in story:
            block = Paragraph(paragraph.replace("\n", "<br/>"), style)
            _, height = block.wrap(PAGE_WIDTH - 36 * mm, y - 32 * mm)
            block.drawOn(c, 18 * mm, y - height)
            y -= height + 7 * mm
    c.setStrokeColor(HexColor("#B7D8E2")); c.line(18 * mm, 14 * mm, PAGE_WIDTH - 18 * mm, 14 * mm)
    c.setFillColor(HexColor("#42606D")); c.setFont("Helvetica", 8)
    c.drawString(18 * mm, 9 * mm, "AGENTIA - learn with evidence, context, and care")
    c.drawRightString(PAGE_WIDTH - 18 * mm, 9 * mm, f"{page_no}")
    c.showPage()

def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True); API_OUTPUT.mkdir(parents=True, exist_ok=True)
    catalog = []
    for field_slug, field, books in FIELDS:
        field_dir = OUTPUT / field_slug; field_dir.mkdir(parents=True, exist_ok=True)
        api_dir = API_OUTPUT / field_slug; api_dir.mkdir(parents=True, exist_ok=True)
        for number, book in enumerate(books, 1):
            doc_id = f"{field_slug}-{number}"
            filename = f"{number:02d}-{slug(book)}.pdf"
            pdf_path = field_dir / filename
            pages = page_texts(field, book)
            c = canvas.Canvas(str(pdf_path), pagesize=A4, title=book, author="AGENTIA")
            for page_no, (title, text) in enumerate(pages, 1): draw_page(c, page_no, title, text, page_no == 1)
            c.save()
            text_path = api_dir / f"{number:02d}-{slug(book)}.txt"
            text_path.write_text("\n\n".join(f"PAGE {i}\n{title}\n{text}" for i, (title, text) in enumerate(pages, 1)), encoding="utf-8")
            catalog.append({"id": doc_id, "title": book, "category": field, "categorySlug": field_slug, "subtopic": book, "description": f"A 20-page AGENTIA educational book on {book.lower()}.", "pageCount": 20, "status": "Ready", "sourceType": "AGENTIA Knowledge Base", "version": "1.0", "filename": filename, "url": f"/knowledge/ai-base/{field_slug}/{filename}", "textPath": str(text_path.relative_to(ROOT)).replace("\\", "/"), "createdAt": "2026-08-29"})
    CATALOG_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_OUTPUT.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    (API_OUTPUT / "knowledge-catalog.json").write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    print(f"Generated {len(catalog)} PDFs across {len(FIELDS)} official categories.")

if __name__ == "__main__": main()
