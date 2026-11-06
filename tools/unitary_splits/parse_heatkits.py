"""JHE technical guide -> heat kit data (jhe_heatkits.json).

Tables used: 12 (minimum fan speed tap per air handler; blank = kit not allowed),
16 (kW and MBH at 208 / 230 V), 17 (single source power, 208/230-1-60),
19 (single source power, 208/230-3-60). The guide's font splits decimals:
"147 ." is 14.7 and "450 ." is 45.0; values without " ." are whole numbers.
Kit names: "8HK(01)6500206" = 8HK06500206 or 8HK16500206 (0 = no disconnect, 1 = with).
Usage: python parse_heatkits.py src/jhe_tg.pdf
"""
import json, os, re, sys
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))


def dec(s):
    s = (s or '').strip()
    m = re.fullmatch(r'(\d+)\s+\.', s)      # the "." sits on its own line in the table cell
    if m:
        return int(m.group(1)) / 10
    return int(s) if re.fullmatch(r'\d+', s) else None


def kit(s):
    """'8HK(01)6500206 ,' -> '8HK*6500206'; '8HK06501025' unchanged."""
    s = re.sub(r'\s*,.*$', '', (s or '').strip(), flags=re.S)
    return re.sub(r'\((\d)(\d)\)', '*', s)


def tables(doc, pno):
    return [t.extract() for t in doc[pno - 1].find_tables().tables]


doc = pymupdf.open(sys.argv[1])
out = {'source': os.path.basename(sys.argv[1]), 'min_tap': {}, 'kw': {}, 'single_point': {'1': {}, '3': {}}}

# Table 12 (p16, first table): rows = kits, columns = air handler model patterns
t12 = tables(doc, 16)[0]
ahus = t12[1][2:]
for r in t12[2:]:
    if not r[0] or r[0].startswith('Note'):
        continue
    names = [kit(x) for x in r[0].split(',') if x.strip()]
    for col, ahu in enumerate(ahus):
        v = (r[2 + col] or '').strip()
        tap = re.fullmatch(r'#(\d)', v)
        if tap:
            for n in names:
                out['min_tap'].setdefault(ahu, {})[n] = int(tap.group(1))

# Table 16 (p17): kit -> kW / MBH at 208 and 230 V
for r in tables(doc, 17)[0][3:]:
    if not r[1] or 'Note' in (r[0] or ''):
        continue
    out['kw'][kit(r[1])] = dict(nominal_kw=dec(r[2]), kw208=dec(r[3]), kw230=dec(r[4]), mbh208=dec(r[5]), mbh230=dec(r[6]))


def single_point(rows, phase):
    ahu = None
    for r in rows:
        if r[0] and r[0].startswith('JHE'):
            ahu = r[0].strip()
        if not ahu or not r[1] or not r[1].strip().startswith('8HK'):
            continue
        out['single_point'][phase].setdefault(ahu, {})[kit(r[1])] = dict(
            amps240=dec(r[2]), mca208=dec(r[3]), mca230=dec(r[4]), mop208=dec(r[5]), mop230=dec(r[6]))


single_point(tables(doc, 18)[0], '1')
single_point(tables(doc, 19)[0], '1')
single_point(tables(doc, 20)[0], '3')

json.dump(out, open(os.path.join(HERE, 'jhe_heatkits.json'), 'w'), indent=1)
print('min-tap AHUs', len(out['min_tap']), '| kits', len(out['kw']),
      '| 1-ph AHUs', len(out['single_point']['1']), sum(len(v) for v in out['single_point']['1'].values()), 'rows',
      '| 3-ph AHUs', len(out['single_point']['3']), sum(len(v) for v in out['single_point']['3'].values()), 'rows')
