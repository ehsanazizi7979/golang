#!/usr/bin/env python3
"""
Crop the 14 figures of chapter 2 (pp. 13-56) out of the book PDF.

Each page stores its screenshot twice: a small placeholder image underneath and
the real screenshot on top. Only the hi-res entries are rendered, at 150 dpi and
JPEG quality 82, which keeps all 14 figures under 0.5 MB in total.

Run from anywhere:  python3 assets/extract_chapter2.py
"""

import pathlib
import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
PDF = ROOT / "Let's Go [Alex Edwards].pdf"
OUT = ROOT / "assets" / "ch2"

# (page, xref of the hi-res figure, output slug)
FIGURES = [
    (13, 38, "01-project-directory"),
    (16, 48, "02-hello-from-snippetbox"),
    (19, 57, "03-snippet-view-route"),
    (20, 63, "04-snippet-create-route"),
    (22, 68, "05-not-found-404"),
    (34, 96, "06-view-id-query"),
    (37, 104, "07-project-structure"),
    (41, 116, "08-home-page-sketch"),
    (44, 124, "09-first-template"),
    (49, 137, "10-nav-partial"),
    (51, 143, "11-static-directory"),
    (54, 156, "12-static-listing"),
    (54, 154, "13-main-css"),
    (56, 164, "14-styled-home-page"),
]


def main() -> None:
    doc = pymupdf.open(PDF)
    OUT.mkdir(parents=True, exist_ok=True)
    for page_no, xref, slug in FIGURES:
        page = doc[page_no - 1]
        info = [i for i in page.get_image_info(xrefs=True) if i["xref"] == xref]
        assert info, f"no image xref {xref} on page {page_no}"
        pix = page.get_pixmap(dpi=150, clip=pymupdf.Rect(info[0]["bbox"]))
        target = OUT / f"{slug}.jpg"
        pix.save(target, jpg_quality=82)
        print(f"{target.relative_to(ROOT)}  {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
