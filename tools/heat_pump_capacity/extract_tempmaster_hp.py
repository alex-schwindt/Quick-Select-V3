"""Extract cooling and heat-pump heating capacity tables from the TempMaster
packaged heat pump technical guides into long-form JSON (one file per guide).

    python extract_tempmaster_hp.py <guide.pdf> <out.json>

The output is read by build_hp_capacity_workbook.py, which writes
DATA/DATA FILES/TempMaster Heat Pump Capacity Tables.xlsx.

Cooling tables ("Table N: WQE04 (3 ton) 75°F to 85°F") print, per outdoor
temperature pair, one block per CFM: rows of
    WB | total MBh | input kW | sensible MBh @ DB 90 85 80 75 70 65 | (same for 2nd OA)
The CFM label is printed just before the LAST row of its block.

Heating tables ("Table N: WYE04 heating capacities") print, per CFM, three
indoor DB rows (55/70/80) of MBH and kW at outdoor -10 ... 60 °F; the CFM label
is printed just before the last DB of its block.

Nothing is interpolated: every value written is a printed value. "-" cells
(DB too close to WB) are left out.
"""
import json
import re
import sys

import pymupdf

WB_SET = {57, 62, 67, 72, 77}
# "Table 16: WQE04 (3 ton) 75°F to 85°F" (Omni Core), "Table 3: WP078 (6.5 ton)"
# (Omni Pro - no outdoor range in the title; its continuation page has no title) or
# "Table 9: MV13 cooling performance 75°F and 85°F" (Omni Choice - no tons).
COOL_TITLE = re.compile(r'^Table\s+(\d+):\s*([A-Z]{2,3}[A-Z0-9]{1,3})\s*'
                        r'(?:\(([\d.]+)\s*ton\)|cooling performance)')
# "Table 30: WYE04 heating capacities" (one model) or "Table 13: WP078-150" (all
# models in one table - each model's block carries a "078 (6.5)" + "WP" label).
HEAT_TITLE = re.compile(r'^Table\s+(\d+):\s*([A-Z]{2,3}[A-Z0-9]{1,3})'
                        r'(?:\s+heating (?:capacities|performance)|-\d+$)')
HEAT_LABEL = re.compile(r'^([A-Z0-9]{2,3})\s*\(([\d.]+)(?:\s*ton)?\)$')
AMB = re.compile(r'^(\d{2,3})\s*(?:°F|\(°F\))$')
FOOTER = re.compile(r'^Technical Guide:')
# Section headings. Pages carry the section of the last heading seen, so
# untitled continuation pages and the Omni Pro reheat tables (hot gas reheat
# mode, laid out exactly like cooling) are told apart.
SECTION = [('reheat', re.compile(r'reheat capacities', re.I)),
           ('heating', re.compile(r'heating\s+capacit', re.I)),
           ('cooling', re.compile(r'cooling\s+capacit', re.I)),
           ('other', re.compile(r'^(Airflow performance|Electrical data|Blower performance|'
                                r'Indoor blower|Typical wiring|Power exhaust)', re.I))]


def page_sections(doc):
    """Section ('cooling' / 'reheat' / 'heating' / 'other' / None) of each page."""
    out, cur = [], None
    for pno in range(doc.page_count):
        top = page_lines(doc[pno])[:12]
        # Headings wrap ("... cooling" / "capacities"), so the capacity
        # sections are matched on the joined top of the page; the 'other'
        # headings are matched line by line (they are anchored).
        joined = ' '.join(top)
        hit = next((name for name, rx in SECTION[:3] if rx.search(joined)), None)
        if hit is None and any(SECTION[3][1].search(l) for l in top):
            hit = 'other'
        if hit:
            cur = hit
        out.append(cur)
    return out


def num(tok):
    try:
        return float(tok)
    except ValueError:
        return None


def page_lines(page):
    lines = [l.strip() for l in page.get_text().splitlines() if l.strip()]
    # Drop the running footer and the page number printed next to it.
    out = []
    for i, l in enumerate(lines):
        if FOOTER.match(l):
            continue
        near_footer = (i > 0 and FOOTER.match(lines[i - 1])) or \
                      (i + 1 < len(lines) and FOOTER.match(lines[i + 1]))
        if near_footer and re.fullmatch(r'\d{1,3}', l):
            continue
        out.append(l)
    return out


def parse_cooling(doc, sections):
    """-> list of dict rows and a list of issues."""
    rows, issues = [], []
    model = tons = None
    for pno in range(doc.page_count):
        if sections[pno] != 'cooling':
            continue
        lines = page_lines(doc[pno])
        # Tables start at their title; a page without one continues the
        # last model (Omni Pro prints the 95-125°F half untitled).
        starts = [i for i, l in enumerate(lines) if COOL_TITLE.match(l)]
        if not starts:
            if model is None or not any(AMB.match(l) for l in lines):
                continue
            starts = [-1]
        for si, start in enumerate(starts):
            if start >= 0:
                m = COOL_TITLE.match(lines[start])
                model, tons = m.group(2), (float(m.group(3)) if m.group(3) else None)
            end = starts[si + 1] if si + 1 < len(starts) else len(lines)
            body = lines[start + 1:end]
            # Data begins at the first outdoor-temperature label ("75°F");
            # the header cells before it come out in different orders on
            # different pages, so they are skipped rather than parsed.
            k = next((i for i, l in enumerate(body) if AMB.match(l)), None)
            if k is None:
                issues.append('p.%d %s: no outdoor temperature label' % (pno + 1, model))
                continue
            # Omni Core / Omni Pro print one total + input kW per WB row and six
            # sensible values; Omni Choice prints a total AND a sensible for
            # every DB (no kW). Told apart by the "Total input" header.
            pairs = not any('input' in l.lower() for l in body[:k])
            width = 24 if pairs else 16
            amb_pair = None
            pending = []        # rows of the current CFM block, awaiting CFM
            last_row_of_block = False
            while k < len(body):
                tok = body[k]
                a = AMB.match(tok)
                if a:
                    # Ambient labels come in pairs: "95°F", "105°F".
                    b = AMB.match(body[k + 1]) if k + 1 < len(body) else None
                    if not b:
                        issues.append('p.%d %s: unpaired ambient %s' % (pno + 1, model, tok))
                        k += 1
                        continue
                    if pending:
                        issues.append('p.%d %s: %d rows without CFM before %s' %
                                      (pno + 1, model, len(pending), tok))
                        pending = []
                    amb_pair = (int(a.group(1)), int(b.group(1)))
                    k += 2
                    continue
                v = num(tok)
                if v is None:
                    k += 1
                    continue
                if v >= 300 and v.is_integer():
                    # CFM label: applies to the pending rows plus the next row.
                    cfm = int(v)
                    for r in pending:
                        r['cfm'] = cfm
                    pending = []
                    last_row_of_block = cfm
                    k += 1
                    continue
                if v.is_integer() and int(v) in WB_SET:
                    vals = body[k + 1:k + 1 + width]
                    if len(vals) < width or amb_pair is None:
                        issues.append('p.%d %s: short row at WB %s' % (pno + 1, model, tok))
                        k += 1
                        continue
                    dbs = [90, 85, 80, 75, 70, 65]
                    for j, oa in enumerate(amb_pair):
                        if pairs:
                            g = vals[j * 12:(j + 1) * 12]
                            tot = dict(zip(dbs, [num(x) for x in g[0::2]]))
                            sens = dict(zip(dbs, [num(x) for x in g[1::2]]))
                            kwv = None
                        else:
                            g = vals[j * 8:(j + 1) * 8]
                            tot = dict.fromkeys(dbs, num(g[0]))
                            sens = dict(zip(dbs, [num(x) for x in g[2:8]]))
                            kwv = num(g[1])
                        row = {
                            'model': model, 'tons': tons, 'wb': int(v), 'oa': oa,
                            'tot': tot, 'kw': kwv, 'sens': sens,
                            'page': pno + 1, 'cfm': None
                        }
                        if last_row_of_block:
                            row['cfm'] = last_row_of_block
                        else:
                            pending.append(row)
                        rows.append(row)
                    last_row_of_block = False
                    k += 1 + width
                    continue
                issues.append('p.%d %s: stray token %s' % (pno + 1, model, tok))
                k += 1
            if pending:
                issues.append('p.%d %s: %d trailing rows without CFM' % (pno + 1, model, len(pending)))
    # Explode to one record per DB.
    out = []
    for r in rows:
        if r['cfm'] is None:
            continue
        for db, s in r['sens'].items():
            t = r['tot'].get(db)
            if s is None or t is None:
                continue
            out.append({'model': r['model'], 'tons': r['tons'], 'cfm': r['cfm'],
                        'eatDb': db, 'eatWb': r['wb'], 'oaDb': r['oa'],
                        'totalMbh': t, 'sensibleMbh': s, 'inputKw': r['kw'],
                        'page': r['page']})
    return out, issues


def parse_heating(doc, sections):
    """Heating tables. Per CFM block: three indoor-DB rows of MBH and kW; the
    CFM label is printed before the block's last DB. A model's size label
    ("04 (3)" / "078 (6.5)") and family ("WYE" / "WP") are printed inside its
    last block; in a one-model table the title names the model instead."""
    out, issues = [], []
    title_model = None      # set by a one-model title
    unlabelled = []         # CFM-complete rows not yet tied to a model

    def flush(model):
        for r in unlabelled:
            for oa, m, w in zip(r['oas'], r['mbh'], r['kw']):
                if m is not None:
                    out.append({'model': model, 'cfm': r['cfm'], 'indoorDb': r['db'],
                                'oaDb': oa, 'mbh': m, 'kw': w, 'page': r['page']})
        del unlabelled[:]

    for pno in range(doc.page_count):
        if sections[pno] != 'heating':
            continue
        lines = page_lines(doc[pno])
        starts = [i for i, l in enumerate(lines) if HEAT_TITLE.match(l)]
        for si, start in enumerate(starts):
            t = HEAT_TITLE.match(lines[start])
            # A one-model table ends where the next title starts, label or not.
            if unlabelled and title_model:
                flush(title_model)
            title_model = t.group(2) if 'heating' in lines[start] else None
            end = starts[si + 1] if si + 1 < len(starts) else len(lines)
            body = lines[start + 1:end]
            # Outdoor columns start at -10°F (Omni Core / Pro) or -5°F (Choice).
            hdr = next((i for i, l in enumerate(body) if re.fullmatch(r'-\d+', l)), None)
            if hdr is None:
                issues.append('p.%d: no outdoor header' % (pno + 1))
                continue
            oas = [int(x) for x in body[hdr:hdr + 8]]
            k = hdr + 8
            pending = []
            while k < len(body):
                if body[k] != 'MBH':
                    k += 1
                    continue
                mbh = [num(x) for x in body[k + 1:k + 9]]
                k += 9
                # Tokens up to "kW": [size label, family,] [CFM,] DB
                j = body.index('kW', k)
                mid = body[k:j]
                label = None
                for x in mid:
                    lm = HEAT_LABEL.match(x)
                    if lm:
                        label = lm.group(1)
                fam = next((x for x in mid if re.fullmatch(r'[A-Z]{2,3}', x)), None)
                ints = [int(v) for v in (num(x) for x in mid) if v is not None and v.is_integer()]
                if not ints:
                    issues.append('p.%d: no DB before kW' % (pno + 1))
                    k = j + 9
                    continue
                db = ints[-1]
                cfm = ints[-2] if len(ints) >= 2 and ints[-2] >= 300 else None
                kw = [num(x) for x in body[j + 1:j + 9]]
                k = j + 9
                pending.append({'db': db, 'mbh': mbh, 'kw': kw, 'page': pno + 1, 'oas': oas})
                if cfm is not None:
                    for r in pending:
                        r['cfm'] = cfm
                    unlabelled.extend(pending)
                    pending = []
                if label and fam:
                    flush(title_model or (fam + label))
            if pending:
                issues.append('p.%d: %d heating rows without CFM' % (pno + 1, len(pending)))
    if unlabelled and title_model:
        flush(title_model)
    if unlabelled:
        issues.append('%d heating rows with no model label' % len(unlabelled))
    return out, issues


def main():
    pdf, dest = sys.argv[1], sys.argv[2]
    doc = pymupdf.open(pdf)
    sections = page_sections(doc)
    cooling, ci = parse_cooling(doc, sections)
    heating, hi = parse_heating(doc, sections)
    json.dump({'source': pdf.split('/')[-1], 'cooling': cooling, 'heating': heating,
               'issues': ci + hi}, open(dest, 'w'), indent=0)
    models = sorted({r['model'] for r in cooling})
    print('cooling records %d, models %s' % (len(cooling), models))
    print('heating records %d, models %s' % (len(heating), sorted({r['model'] for r in heating})))
    for i in ci + hi:
        print('ISSUE', i)


if __name__ == '__main__':
    main()
