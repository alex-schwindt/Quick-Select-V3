"""Parse Bosch/UPG selection-tool Submittal Reports (Fraser Johnston splits) into systems.

Each unit in the report is a run of pages whose footer names the unit
("Unit Model #: X  Quantity: 1  Tag #: Y", and on some pages "System: A,B[,C]").
The unit's first page holds its performance block (label line, value line),
ending in "Matchup Information / AHRI Reference Number". Outdoor and indoor
performance pages of one system share the AHRI reference number.

Usage: python parse_reports.py <report.pdf> [...]  -> writes <name>.systems.json next to this script
"""
import json, os, re, sys
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
CLEAN = str.maketrans({' ': ' ', '�': ' ', ' ': ' '})


def lines_of(page):
    return [l.strip() for l in page.get_text().translate(CLEAN).splitlines() if l.strip()]


def footer(ls):
    t = ' '.join(ls)
    m = re.search(r'Unit Model #:\s*(\S+)\s+Quantity:\s*\d+\s+Tag #:\s*(.+?)(?:\s+System:|$)', t)
    s = re.search(r'System:\s*([A-Z0-9\-,]+)', t)
    kind = 'outdoor' if 'Split-System Outdoor' in t else 'indoor' if 'Split-System Indoor' in t else None
    return (m.group(1) if m else None, m.group(2).strip() if m else None, s.group(1).split(',') if s else None, kind)


# Section headings: values that follow them belong to that block, so
# "Supply air" / "Entering DB temp." are kept apart per section.
SECTIONS = ['Cooling Performance', 'Heat Pump Performance', 'Gas Heating Performance', 'Heating Performance',
            'Hangtag Ratings', 'Refrigerant', 'Electrical Data', 'Indoor Electrical Data',
            'Field Installed Heat Single Source Power', 'Supply Air Blower Performance',
            'Outdoor Unit Shipping Dimensions & Weight', 'Indoor Unit Shipping Dimensions & Weight',
            'Matchup Information']


def perf_block(ls):
    """{section: {label: value}} from the label/value pairs above 'Note:'/'Product Features'."""
    out, sec, i = {}, 'top', 0
    while i < len(ls):
        l = ls[i]
        if l.startswith('Note:') or l in ('Product Features',) or re.fullmatch(r'[\d.]+ Ton', l):
            if 'Matchup Information' in out and 'AHRI Reference Number' in out['Matchup Information']:
                break
        if l in SECTIONS:
            sec = l
            out.setdefault(sec, {})
            i += 1
            continue
        if i + 1 < len(ls):
            v = ls[i + 1]
            # value lines start with a digit, a sign, or are short tokens (YES/N/A/R-454B/Upflow/T3 ...)
            if re.match(r'^[-+]?[\d.]', v) or v in ('N/A', 'Yes', 'No', 'Installed', 'Field') or (
                    len(v) <= 24 and v not in SECTIONS and not v.endswith(':')):
                out.setdefault(sec, {})[l] = v
                i += 2
                continue
        i += 1
    return out


def parse(path):
    doc = pymupdf.open(path)
    units, cur = [], None
    for pno, page in enumerate(doc, 1):
        ls = lines_of(page)
        model, tag, system, kind = footer(ls)
        if 'Matchup Information' in ls and ('Cooling Performance' in ls or 'Gas Heating Performance' in ls):
            cur = dict(page=pno, model=model, tag=tag, kind=kind, system=system, perf=perf_block(ls))
            units.append(cur)
        elif cur and model == cur['model']:
            if system and not cur['system']:
                cur['system'] = system
            if not cur['kind']:
                cur['kind'] = kind
    # units without a footer model on the performance page take it from the next footer page
    return units, doc.page_count


def num(s):
    m = re.match(r'^([-+]?[\d.]+)', s or '')
    return float(m.group(1)) if m else None


def group_systems(units):
    """Walk the units in order: each outdoor perf page opens a system; indoor
    perf pages with the same AHRI ref join it."""
    systems, open_sys = [], None
    for u in units:
        ahri = u['perf'].get('Matchup Information', {}).get('AHRI Reference Number')
        if u['kind'] == 'outdoor':
            open_sys = dict(ahri=ahri, outdoor=u, indoor=[])
            systems.append(open_sys)
        elif open_sys and ahri == open_sys['ahri']:
            open_sys['indoor'].append(u)
        else:
            systems.append(dict(ahri=ahri, outdoor=None, indoor=[u], orphan=True))
    return systems


if __name__ == '__main__':
    for path in sys.argv[1:]:
        units, pages = parse(path)
        systems = group_systems(units)
        name = os.path.splitext(os.path.basename(path))[0]
        json.dump(dict(source=os.path.basename(path), pages=pages, units=units, systems=systems),
                  open(os.path.join(HERE, name + '.systems.json'), 'w', encoding='utf-8'), indent=1)
        orphans = [s for s in systems if s.get('orphan')]
        noind = [s for s in systems if s['outdoor'] and not s['indoor']]
        print(f'{name}: {pages} pages, {len(units)} performance pages, {len(systems)} systems, '
              f'{len(orphans)} indoor without outdoor, {len(noind)} outdoor without indoor')
