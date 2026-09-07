"""Local visual QA only: compose already rendered document pages."""
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw

directory = Path(sys.argv[1])
pattern = sys.argv[2]
files = sorted(directory.glob(pattern))
assert files, "No rendered pages found"
width, height, columns = 480, 340, 3
for offset in range(0, len(files), 12):
    batch = files[offset:offset + 12]
    sheet = Image.new("RGB", (columns * width, math.ceil(len(batch) / columns) * height), "#d1d5db")
    draw = ImageDraw.Draw(sheet)
    for index, file in enumerate(batch):
        picture = Image.open(file).convert("RGB")
        picture.thumbnail((width - 12, height - 32))
        left = index % columns * width
        top = index // columns * height
        sheet.paste(picture, (left + (width - picture.width) // 2, top + 24))
        draw.text((left + 10, top + 6), file.name, fill="black")
    output = directory / f"qa-sheet-{offset // 12 + 1}.png"
    sheet.save(output)
    print(output)
