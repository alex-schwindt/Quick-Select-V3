"""Build MULTI POSITION SPLIT DATA.xlsx (heat pump + JHE air handler) and GAS SPLIT DATA.xlsx
(AC + gas furnace + cased coil) from the Fraser Johnston selection-tool Submittal Reports.

Inputs (this folder): hp.systems.json, gas.systems.json, gasfix.systems.json (parse_reports.py),
jhe_heatkits.json (parse_heatkits.py), src/*.pdf (summary-page descriptions).
The existing workbooks in DATA/DATA FILES are the templates: header rows 1-5, merges and
column letters stay as they are (the site, exports and design search read those letters);
only the data rows are replaced.

Rating point only (no capacity tables): cooling at 80/67 F EAT, 95 F ambient; heat pump
heating at 47 F ambient; values as printed by the selection tool, one row per AHRI match.
Heat pump rows add one row per electric heat kit the JHE technical guide allows for that
air handler (kW dropdown on the site).

Usage: python build_split_workbooks.py <DATA FILES dir> <out dir>
"""
import json, os, re, sys
from copy import copy
import openpyxl
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR, OUT_DIR = (sys.argv[1:3] + [None, None])[:2]
MAKE = 'FRASER JOHNSTON'
NA = '-'
load = lambda n: json.load(open(os.path.join(HERE, n), encoding='utf-8'))


def num(s):
    m = re.match(r'^\s*([-+]?[\d.]+)', s or '')
    return float(m.group(1)) if m else None


def whole(x):
    return int(x) if x is not None and float(x).is_integer() else x


def volts(s):
    """'208/230-1-60' -> '208/230/1'; '115-1-60' -> '115/1'; '460-3-60' -> '460/3'."""
    s = re.sub(r'-60$', '', (s or '').strip())
    v, _, ph = s.rpartition('-')                      # '208/230-1' -> ('208/230', '1')
    return f'{v}/{ph}' if v else s


# ---------------------------------------------------------------- summary descriptions
def descriptions(pdf):
    """model -> description text from the Submittal Summary pages."""
    out = {}
    doc = pymupdf.open(os.path.join(HERE, 'src', pdf))
    for page in doc:
        t = page.get_text()
        if 'Submittal Summary' not in t and 'Model # / Material #' not in t:
            if out:
                break
            continue
        ls = [l.strip() for l in t.replace(' ', ' ').splitlines() if l.strip()]
        for i, l in enumerate(ls):
            if re.fullmatch(r'[A-Z0-9][A-Z0-9\-]{7,}', l) and i + 1 < len(ls):
                d = []
                for x in ls[i + 1:]:
                    if x == '1' or x.startswith('Information is subject') or x.startswith('Equipment start-up'):
                        break
                    d.append(x)
                out.setdefault(l, ' '.join(d))
    return out


def stages(desc, features=''):
    d = (desc or '').upper()
    if 'TWO STAGE' in d:
        return '2 Stage'
    if 'SINGLE STAGE' in d:
        return '1 Stage'
    if 'INVERTER' in (features or '').upper() or re.search(r'\bHH8', d):
        return 'Inverter'
    return NA


def series_of(model):
    return model[:3]                                   # XH4, XH6, HH8, XC3, XC4, XC6


def tons(model):
    m = re.match(r'^[A-Z]{2}\d(\d{2})', model)         # XH418 -> 18 MBH nominal -> 1.5 t
    return int(m.group(1)) / 12 if m else None


# ---------------------------------------------------------------- template handling
def open_template(name):
    wb = openpyxl.load_workbook(os.path.join(SRC_DIR, name))
    ws = wb['SCHEDULE']
    style_row = [copy(c._style) for c in ws[6]]
    ws.delete_rows(6, ws.max_row)
    for extra in [s for s in wb.sheetnames if s not in ('SCHEDULE', 'SCHEDULE NOTES')]:
        del wb[extra]
    return wb, ws, style_row


def put_row(ws, r, values, style_row):
    for col, v in values.items():
        c = ws[f'{col}{r}']
        c.value = v
    for i, st in enumerate(style_row, 1):
        ws.cell(row=r, column=i)._style = copy(st)


def notes(wb, lines):
    ws = wb['SCHEDULE NOTES']
    ws.delete_rows(1, ws.max_row)
    for i, l in enumerate(lines, 1):
        ws.cell(row=i, column=1, value=l)


# ---------------------------------------------------------------- heat pump workbook
def build_hp():
    hk = load('jhe_heatkits.json')
    desc = descriptions('hp.pdf')
    wb, ws, style = open_template('MULTI POSITION SPLIT DATA.xlsx')
    r, n_sys, n_rows = 6, 0, 0
    for s in load('hp.systems.json')['systems']:
        o, i = s['outdoor'], s['indoor'][0]
        op, ip = o['perf'], i['perf']
        oc, ih, ib = op['Cooling Performance'], op['Heat Pump Performance'], ip['Supply Air Blower Performance']
        ic, oe, ie = ip['Cooling Performance'], op['Electrical Data'], ip['Indoor Electrical Data']
        cu, ahu = o['model'], i['model']
        cfm = num(ib['Supply air'])
        seer, eer = num(oc['Seasonal Efficiency (at ARI)']), num(oc['Efficiency (at ARI)'])
        stg = stages(desc.get(cu), '')
        if series_of(cu) == 'HH8':
            stg = 'Inverter'
        motor = 'Constant Torque ECM' if 'Constant Torque' in desc.get(ahu, '') else ('Variable Speed ECM' if 'Variable' in desc.get(ahu, '') else 'ECM')
        base = {
            'A': MAKE, 'B': ahu, 'C': whole(cfm), 'D': num(ib['Motor rating']), 'E': motor,
            'F': whole(num(ic['Entering DB temp.'])), 'G': whole(num(ic['Entering WB temp.'])),
            'H': num(ic['Unit Leaving DB temp.']),
            'I': round(num(oc['Total net capacity']) * 1000), 'J': round(num(oc['Sensible net capacity']) * 1000),
            'K': round(num(ih['Heating output capacity']) * 1000),
            'L': NA, 'M': NA, 'N': volts(ie['Power supply']),
            'O': num(ie['Unit min circuit ampacity']), 'P': whole(num(ie['Unit max over-current protection'])),
            'Q': whole(num(ip['Indoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])),
            'R': MAKE, 'S': cu, 'T': whole(num(ih['Ambient DB temp.'])), 'U': round(num(ih['Heating output capacity']) * 1000),
            'V': f"{ih['HSPF2']} HSPF2", 'W': volts(oe['Power supply']),
            'X': num(oe['Unit min circuit ampacity']), 'Y': whole(num(oe['Unit max over-current protection'])),
            'Z': whole(num(oc['Ambient DB temp.'])), 'AA': op['Refrigerant']['Refrigerant type'],
            'AB': f'{seer:g}/{eer:g} (SEER2/EER2)',
            'AC': whole(num(op['Outdoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])),
            'AD': stg,
            # filters
            'AF': tons(cu), 'AG': 'HEAT PUMP', 'AH': f'{series_of(cu)} ({seer:g} SEER2)', 'AI': volts(oe['Power supply']),
            'AJ': NA, 'AK': stg, 'AL': motor,
            # docs (submittals are split per unit later)
            'AN': cu, 'AO': ahu,
            # refrigerant columns: only what the report states
            'BG': op['Refrigerant']['Refrigerant type'], 'BM': 15,
        }
        for col in ('BH', 'BI', 'BJ', 'BK', 'BL', 'BN', 'BO', 'BP'):
            base[col] = NA
        put_row(ws, r, base, style); r += 1; n_rows += 1; n_sys += 1
        # electric heat kits the guide allows for this air handler (single point power)
        phase = '1' if '-1' in base['N'] or base['N'].endswith('/1') else '3'
        kits = {}
        for pat, rows in hk['single_point'][phase].items():
            if re.match('^' + pat.replace('*', '.') , ahu):
                kits = rows
                break
        for k, e in sorted(kits.items(), key=lambda kv: hk['kw'][kv[0]]['nominal_kw']):
            kw = hk['kw'][k]['nominal_kw']
            row = dict(base, L=kw, M=round(kw * 3412 / (1.08 * cfm), 1), O=e['mca230'], P=whole(e['mop230']),
                       AJ=kw, AN=cu, AO=ahu)
            row['B'] = ahu
            put_row(ws, r, row, style); r += 1; n_rows += 1
    notes(wb, [
        'Provide with 7-day programmable thermostat',
        'Provide with field installed disconnect. Disconnect shall be provided and installed by electrical contractor',
        'Electric heat, if scheduled, shall be field installed 8HK series heat kit with single point power. kW listed is at 240 V; temperature rise at the cooling airflow.',
        'Cooling capacity at 80/67 F EAT and 95 F ambient; heat pump heating capacity at 47 F ambient. AHRI matched system ratings from the Fraser Johnston selection software.',
    ])
    out = os.path.join(OUT_DIR, 'MULTI POSITION SPLIT DATA.xlsx')
    wb.save(out)
    print(f'heat pump: {n_sys} systems, {n_rows} rows -> {out}')


# ---------------------------------------------------------------- gas workbook
def build_gas():
    desc = descriptions('gas.pdf')
    desc.update(descriptions('gasfix.pdf'))
    systems = load('gas.systems.json')['systems'] + load('gasfix.systems.json')['systems']
    # indoor units printed without their condenser (re-run in a second report) join it by AHRI ref
    by_ahri = {s['ahri']: s for s in systems if s.get('outdoor')}
    for s in systems:
        if s.get('orphan') and s['ahri'] in by_ahri:
            by_ahri[s['ahri']]['indoor'] += s['indoor']
    wb, ws, style = open_template('GAS SPLIT DATA.xlsx')
    r, skipped = 6, []
    seen = set()
    for s in systems:
        if not s.get('outdoor'):
            continue
        furn = next((u for u in s['indoor'] if 'Gas Heating Performance' in u['perf']), None)
        coil = next((u for u in s['indoor'] if u is not furn), None)
        if not furn or not coil or s['ahri'] in seen:
            skipped.append((s['outdoor']['model'], s['ahri']))
            continue
        seen.add(s['ahri'])
        o = s['outdoor']; op, fp = o['perf'], furn['perf']
        oc, oe = op['Cooling Performance'], op['Electrical Data']
        g, fb, fe = fp['Gas Heating Performance'], fp['Supply Air Blower Performance'], fp['Indoor Electrical Data']
        fc = fp['Cooling Performance']
        cu = o['model']
        seer, eer = num(oc['Seasonal Efficiency (at ARI)']), num(oc['Efficiency (at ARI)'])
        stg = stages(desc.get(cu))
        gas_stg = 2 if 'TWO STAGE' in desc.get(furn['model'], '').upper() else 1
        fw = num(fp['Indoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])
        motor = 'ECM' if 'ECM' in desc.get(furn['model'], '') else NA
        afue = num(g['AFUE'])
        gin, gout = round(num(g['Heating input capacity (Max)']) * 1000), round(num(g['Heating output capacity (Max)']) * 1000)
        orient = 'Multiposition' if re.search(r'Multi ?position', desc.get(furn['model'], ''), re.I) else NA
        row = {
            'A': MAKE, 'B': f"{coil['model']} / {furn['model']}", 'C': whole(num(fb['Supply air'])),
            'D': num(fb['Motor rating']), 'E': motor,
            'F': whole(num(fc['Entering DB temp.'])), 'G': whole(num(fc['Entering WB temp.'])),
            'H': round(num(oc['Total net capacity']) * 1000),
            'I': gin, 'J': gout, 'K': gas_stg, 'L': whole(afue),
            'M': volts(fe['Power supply']), 'N': num(fe['Unit min circuit ampacity']),
            'O': whole(num(fe['Unit max over-current protection'])), 'P': whole(fw),
            'Q': MAKE, 'R': cu, 'S': volts(oe['Power supply']),
            'T': num(oe['Unit min circuit ampacity']), 'U': whole(num(oe['Unit max over-current protection'])),
            'V': whole(num(oc['Ambient DB temp.'])), 'W': op['Refrigerant']['Refrigerant type'],
            'X': f'{seer:g} / {eer:g}',
            'Y': whole(num(op['Outdoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])),
            'Z': stg,
            # filters
            'AB': tons(cu), 'AC': f'{series_of(cu)} ({seer:g} SEER2)', 'AD': stg, 'AE': orient,
            'AF': gas_stg, 'AG': gin, 'AH': gout, 'AI': whole(afue),
            # docs
            'AK': cu, 'AL': coil['model'], 'AM': furn['model'],
            'BG': op['Refrigerant']['Refrigerant type'], 'BM': 15,
        }
        charge = op.get('Refrigerant', {}).get('Data plate charge with 15\' lineset')
        for col in ('BH', 'BI', 'BJ', 'BK', 'BL', 'BN', 'BO', 'BP'):
            row[col] = NA
        if charge:
            row['BN'] = num(charge)
        put_row(ws, r, row, style); r += 1
    notes(wb, [
        'Provide with 7-day programmable thermostat',
        'Provide with field installed disconnect. Disconnect shall be provided and installed by electrical contractor',
        'Cooling capacity at 80/67 F EAT and 95 F ambient; AHRI matched system ratings from the Fraser Johnston selection software.',
    ])
    out = os.path.join(OUT_DIR, 'GAS SPLIT DATA.xlsx')
    wb.save(out)
    print(f'gas: {r - 6} systems -> {out}; skipped (incomplete / duplicate): {skipped}')


if __name__ == "__main__":
    build_hp()
    build_gas()
