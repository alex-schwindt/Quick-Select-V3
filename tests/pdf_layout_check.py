"""Layout check for schedule PDFs (used by tests/smoke.js).

Flags text that runs across a table border - the "cut off / spilling into the
next column" bug: any text span with a vertical cell border passing through it,
or text outside the page. Prints JSON: {"pages": n, "spans": n, "problems": [...]}.

Usage: python tests/pdf_layout_check.py <file.pdf>
Needs PyMuPDF (pip install pymupdf).
"""
import json
import sys

try:
    import pymupdf
except ImportError:          # older PyMuPDF only ships the fitz name
    import fitz as pymupdf

SLACK = 0.6                  # points of tolerance at the span edges


def check(path):
    doc = pymupdf.open(path)
    problems, spans_seen = [], 0
    for pno, page in enumerate(doc, start=1):
        # Vertical border segments: (x, y_top, y_bottom)
        vlines = []
        for d in page.get_drawings():
            for item in d['items']:
                if item[0] == 'l':
                    p1, p2 = item[1], item[2]
                    if abs(p1.x - p2.x) < 0.01 and abs(p1.y - p2.y) > 1:
                        vlines.append((p1.x, min(p1.y, p2.y), max(p1.y, p2.y)))
                elif item[0] == 're':
                    r = item[1]
                    vlines += [(r.x0, r.y0, r.y1), (r.x1, r.y0, r.y1)]
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    text = span['text'].strip()
                    if not text:
                        continue
                    spans_seen += 1
                    x0, y0, x1, y1 = span['bbox']
                    ymid0, ymid1 = y0 + (y1 - y0) * 0.25, y1 - (y1 - y0) * 0.25
                    if x0 < -SLACK or x1 > page.rect.width + SLACK:
                        problems.append({'page': pno, 'text': text, 'issue': 'outside the page'})
                        continue
                    for x, ly0, ly1 in vlines:
                        if x0 + SLACK < x < x1 - SLACK and ly0 < ymid1 and ly1 > ymid0:
                            problems.append({'page': pno, 'text': text,
                                             'issue': 'crosses a cell border at x=%.1f' % x})
                            break
    return {'pages': doc.page_count, 'spans': spans_seen, 'problems': problems}


if __name__ == '__main__':
    print(json.dumps(check(sys.argv[1])))
