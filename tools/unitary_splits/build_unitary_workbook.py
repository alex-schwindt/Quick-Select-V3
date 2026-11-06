"""Build MULTI POSITION SPLIT DATA.xlsx as ONE combined unitary split schedule:
Fraser Johnston heat pump + JHE air handler systems and AC + gas furnace + cased coil
systems, from the selection-tool Submittal Reports (parse_reports.py output) and the
JHE technical guide heat kit tables (parse_heatkits.py output).

Rating point only: cooling at 80/67 F EAT, 95 F ambient; heat pump heating at 47 F
ambient; gas heating at the furnace's max input; as printed by the selection tool,
one row per AHRI match. Heat pump systems add one row per 8HK electric heat kit the
JHE guide allows for that air handler (single point power, MCA / MOP at 230 V);
the site folds them into a kW dropdown (data.js kwVariants O -> P, R, S).

Columns that don't apply to a system type are "-"; the site hides columns that are
empty for the rows in view (data.js hideEmptyColumns).

Usage: python build_unitary_workbook.py <out.xlsx>
"""
import json, os, re, sys
import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import column_index_from_string as ci, get_column_letter as gl

from build_split_workbooks import (MAKE, NA, num, whole, volts, descriptions, stages, series_of, tons, load)

OUT = sys.argv[1]
HP, GAS = 'HEAT PUMP + AIR HANDLER', 'AC + GAS FURNACE'

# (letter, group, leaf)  - group None = header spans rows 4-5
SCHEDULE = [
    ('A', None, 'MAKE'), ('B', None, 'SYSTEM TYPE'), ('C', None, 'MODEL (AIR HANDLER OR COIL / FURNACE)'),
    ('D', 'SUPPLY FAN', 'AIRFLOW (CFM)'), ('E', 'SUPPLY FAN', 'MOTOR (HP)'), ('F', 'SUPPLY FAN', 'MOTOR TYPE'),
    ('G', 'COOLING', 'EAT (DB)'), ('H', 'COOLING', 'EAT (WB)'), ('I', 'COOLING', 'LAT (DB)'),
    ('J', 'COOLING', 'TOTAL CAPACITY'), ('K', 'COOLING', 'SENSIBLE CAPACITY'),
    ('L', 'HEATING', 'HEATING CAPACITY'), ('M', 'HEATING', 'GAS INPUT'), ('N', 'HEATING', 'AFUE (%)'),
    ('O', 'HEATING', 'AUX. ELECTRIC HEAT (kW)'), ('P', 'HEATING', 'TEMPERATURE RISE (DB)'),
    ('Q', 'ELECTRICAL DATA', 'VOLTAGE / PHASE'), ('R', 'ELECTRICAL DATA', 'MCA'), ('S', 'ELECTRICAL DATA', 'MOP'),
    ('T', None, 'WEIGHT'),
    ('U', None, 'MAKE'), ('V', None, 'MODEL'), ('W', None, 'OUTDOOR AMBIENT (COOLING)'),
    ('X', None, 'EFFICIENCY (SEER2/EER2)'), ('Y', None, 'HSPF2'), ('Z', None, 'COMPRESSOR STAGES'),
    ('AA', None, 'REFRIGERANT'),
    ('AB', 'ELECTRICAL DATA ', 'VOLTAGE / PHASE'), ('AC', 'ELECTRICAL DATA ', 'MCA'), ('AD', 'ELECTRICAL DATA ', 'MOP'),
    ('AE', None, 'WEIGHT'),
]
INDOOR_END, OUTDOOR = 'T', ('U', 'AE')
FILTERS = ['SIZE', 'SYSTEM TYPE', 'NOMINAL EFFICIENCY', 'ELECTRICAL', 'COMPRESSOR STAGES', 'GAS INPUT (MBH)', 'KW']
DOCS = ['SUBMITTAL (OUTDOOR UNIT)', 'SUBMITTAL (INDOOR UNIT)', 'SUBMITTAL (COIL)']
REFRIG = ['REFRIGERANT', 'MAX VERTICAL SEPARATION (ODU TO IDU) (FT)', 'MAX VERTICAL SEPARATION (IDU TO IDU) (FT)',
          'MAX TOTAL LINE SET (FT)', 'LIQUID LINE CONNECTION (IN)', 'SUCTION LINE CONNECTION (IN)',
          'PRE-CHARGE PIPING LENGTH (FT)', 'FACTORY CHARGE (LBS)', 'FACTORY CHARGE (OZ)', 'ADDITIONAL CHARGE (OZ/FT)']
F0 = ci('AG')
D0 = F0 + len(FILTERS) + 1
R0 = D0 + len(DOCS) + 1


def hp_rows():
    hk = load('jhe_heatkits.json')
    desc = descriptions('hp.pdf')
    out = []
    for s in load('hp.systems.json')['systems']:
        o, i = s['outdoor'], s['indoor'][0]
        op, ip = o['perf'], i['perf']
        oc, ih, ib = op['Cooling Performance'], op['Heat Pump Performance'], ip['Supply Air Blower Performance']
        ic, oe, ie = ip['Cooling Performance'], op['Electrical Data'], ip['Indoor Electrical Data']
        cu, ahu = o['model'], i['model']
        cfm = num(ib['Supply air'])
        seer, eer = num(oc['Seasonal Efficiency (at ARI)']), num(oc['Efficiency (at ARI)'])
        stg = 'Inverter' if series_of(cu) == 'HH8' else stages(desc.get(cu))
        motor = 'Constant Torque ECM' if 'Constant Torque' in desc.get(ahu, '') else 'ECM'
        heat = round(num(ih['Heating output capacity']) * 1000)
        base = dict(
            A=MAKE, B=HP, C=ahu, D=whole(cfm), E=num(ib['Motor rating']), F=motor,
            G=whole(num(ic['Entering DB temp.'])), H=whole(num(ic['Entering WB temp.'])), I=num(ic['Unit Leaving DB temp.']),
            J=round(num(oc['Total net capacity']) * 1000), K=round(num(oc['Sensible net capacity']) * 1000),
            L=heat, M=NA, N=NA, O=NA, P=NA,
            Q=volts(ie['Power supply']), R=num(ie['Unit min circuit ampacity']),
            S=whole(num(ie['Unit max over-current protection'])),
            T=whole(num(ip['Indoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])),
            U=MAKE, V=cu, W=whole(num(oc['Ambient DB temp.'])), X=f'{seer:g}/{eer:g}', Y=num(ih['HSPF2']), Z=stg,
            AA=op['Refrigerant']['Refrigerant type'], AB=volts(oe['Power supply']),
            AC=num(oe['Unit min circuit ampacity']), AD=whole(num(oe['Unit max over-current protection'])),
            AE=whole(num(op['Outdoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])),
            _f=[tons(cu), HP, f'{series_of(cu)} ({seer:g} SEER2)', volts(oe['Power supply']), stg, None, NA],
            _d=[cu, ahu, None], _r=op['Refrigerant']['Refrigerant type'], _charge=None, _ahri=s['ahri'])
        out.append(base)
        phase = base['Q'].rpartition('/')[2]
        kits = next((rows for pat, rows in hk['single_point'][phase].items()
                     if re.match('^' + pat.replace('*', '.'), ahu)), {})
        for k, e in sorted(kits.items(), key=lambda kv: hk['kw'][kv[0]]['nominal_kw']):
            kw = hk['kw'][k]['nominal_kw']
            row = dict(base, O=kw, P=round(kw * 3412 / (1.08 * cfm), 1), R=e['mca230'], S=whole(e['mop230']))
            row['_f'] = base['_f'][:6] + [kw]
            out.append(row)
    return out


def gas_rows():
    desc = descriptions('gas.pdf')
    desc.update(descriptions('gasfix.pdf'))
    systems = load('gas.systems.json')['systems'] + load('gasfix.systems.json')['systems']
    by_ahri = {s['ahri']: s for s in systems if s.get('outdoor')}
    for s in systems:                       # indoor units re-run in the fix-up report
        if s.get('orphan') and s['ahri'] in by_ahri:
            by_ahri[s['ahri']]['indoor'] += s['indoor']
    out, seen, skipped = [], set(), []
    for s in systems:
        if not s.get('outdoor'):
            continue
        furn = next((u for u in s['indoor'] if 'Gas Heating Performance' in u['perf']), None)
        coil = next((u for u in s['indoor'] if u is not furn), None)
        if not furn or not coil or s['ahri'] in seen:
            skipped.append(s['outdoor']['model'])
            continue
        seen.add(s['ahri'])
        o = s['outdoor']; op, fp = o['perf'], furn['perf']
        oc, oe = op['Cooling Performance'], op['Electrical Data']
        g, fb, fe, fc = (fp['Gas Heating Performance'], fp['Supply Air Blower Performance'],
                         fp['Indoor Electrical Data'], fp['Cooling Performance'])
        cu = o['model']
        seer, eer = num(oc['Seasonal Efficiency (at ARI)']), num(oc['Efficiency (at ARI)'])
        stg = stages(desc.get(cu))
        gin = round(num(g['Heating input capacity (Max)']) * 1000)
        cw = num((coil['perf'].get('Indoor Unit Shipping Dimensions & Weight') or {}).get('Weight with factory installed options'))
        fw = num(fp['Indoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])
        out.append(dict(
            A=MAKE, B=GAS, C=f"{coil['model']} / {furn['model']}", D=whole(num(fb['Supply air'])),
            E=num(fb['Motor rating']), F='ECM' if 'ECM' in desc.get(furn['model'], '') else NA,
            G=whole(num(fc['Entering DB temp.'])), H=whole(num(fc['Entering WB temp.'])), I=num(fc['Unit Leaving DB temp.']),
            J=round(num(oc['Total net capacity']) * 1000), K=round(num(oc['Sensible net capacity']) * 1000),
            L=round(num(g['Heating output capacity (Max)']) * 1000), M=gin, N=whole(num(g['AFUE'])), O=NA,
            P=num(g['Air temp. rise']),
            Q=volts(fe['Power supply']), R=num(fe['Unit min circuit ampacity']),
            S=whole(num(fe['Unit max over-current protection'])), T=whole((fw or 0) + (cw or 0)) or NA,
            U=MAKE, V=cu, W=whole(num(oc['Ambient DB temp.'])), X=f'{seer:g}/{eer:g}', Y=NA, Z=stg,
            AA=op['Refrigerant']['Refrigerant type'], AB=volts(oe['Power supply']),
            AC=num(oe['Unit min circuit ampacity']), AD=whole(num(oe['Unit max over-current protection'])),
            AE=whole(num(op['Outdoor Unit Shipping Dimensions & Weight']['Weight with factory installed options'])),
            _f=[tons(cu), GAS, f'{series_of(cu)} ({seer:g} SEER2)', volts(oe['Power supply']), stg, whole(gin / 1000), NA],
            _d=[cu, furn['model'], coil['model']], _r=op['Refrigerant']['Refrigerant type'],
            _charge=op['Refrigerant'].get("Data plate charge with 15' lineset"), _ahri=s['ahri']))
    return out, skipped


def write(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'SCHEDULE'
    bold, center = Font(bold=True), Alignment(horizontal='center', vertical='center', wrap_text=True)
    fill = PatternFill('solid', fgColor='DDEBF7')

    def hdr(cell, value, rng=None):
        ws[cell] = value
        if rng:
            ws.merge_cells(rng)
        c = ws[cell]; c.font, c.alignment, c.fill = bold, center, fill

    last_sched = SCHEDULE[-1][0]
    hdr('A1', 'SCHEDULE RANGE', f'A1:{last_sched}1')
    hdr(f'{gl(F0)}1', 'FILTERS', f'{gl(F0)}1:{gl(F0 + len(FILTERS) - 1)}1')
    hdr(f'{gl(D0)}1', 'DOCUMENTATION', f'{gl(D0)}1:{gl(D0 + len(DOCS) - 1)}1')
    hdr(f'{gl(R0)}1', 'REFRIGERANT CALCULATIONS', f'{gl(R0)}1:{gl(R0 + len(REFRIG) - 1)}1')
    hdr('A2', 'UNITARY & LIGHT COMMERCIAL SPLIT SYSTEM SCHEDULE', f'A2:{last_sched}2')
    hdr('A3', 'INDOOR UNIT', f'A3:{INDOOR_END}3')
    hdr(f'{OUTDOOR[0]}3', 'OUTDOOR CONDENSING UNIT', f'{OUTDOOR[0]}3:{OUTDOOR[1]}3')
    groups = {}
    for L, g, leaf in SCHEDULE:
        if g is None:
            hdr(f'{L}4', leaf, f'{L}4:{L}5')
        else:
            groups.setdefault(g, []).append(L)
            hdr(f'{L}5', leaf)
    for g, ls in groups.items():
        hdr(f'{ls[0]}4', g.strip(), f'{ls[0]}4:{ls[-1]}4' if len(ls) > 1 else None)
    for k, name in enumerate(FILTERS):
        hdr(f'{gl(F0 + k)}2', name, f'{gl(F0 + k)}2:{gl(F0 + k)}5')
    for k, name in enumerate(DOCS):
        hdr(f'{gl(D0 + k)}2', name, f'{gl(D0 + k)}2:{gl(D0 + k)}5')
    for k, name in enumerate(REFRIG):
        hdr(f'{gl(R0 + k)}2', name, f'{gl(R0 + k)}2:{gl(R0 + k)}5')

    for r, row in enumerate(rows, 6):
        for L, _, _ in SCHEDULE:
            ws[f'{L}{r}'] = row[L]
        for k, v in enumerate(row['_f']):
            ws.cell(row=r, column=F0 + k, value=v)
        # Submittal file names go in once the per-unit PDFs are in the
        # bucket (run with WITH_DOCS=1); empty cells = no Submittal button.
        for k, v in enumerate(row['_d']):
            if v and os.environ.get('WITH_DOCS'):
                ws.cell(row=r, column=D0 + k, value=v)
        refr = [row['_r'], NA, NA, NA, NA, NA, 15, NA, NA, NA]
        for k, v in enumerate(refr):
            ws.cell(row=r, column=R0 + k, value=v)
    for L, w in (('B', 22), ('C', 30), ('V', 14), ('X', 12)):
        ws.column_dimensions[L].width = w
    ws.freeze_panes = 'D6'

    notes = wb.create_sheet('SCHEDULE NOTES')
    for l in [
        'Provide with 7-day programmable thermostat',
        'Provide with field installed disconnect. Disconnect shall be provided and installed by electrical contractor',
        'Cooling capacity at 80/67 F EAT and 95 F ambient. Heat pump heating capacity at 47 F ambient; gas heating capacity is furnace output at the listed input.',
        'Electric heat, if scheduled, shall be a field installed 8HK series heat kit with single point power. kW listed is at 240 V; MCA / MOP at 230 V; temperature rise at the cooling airflow.',
        'AHRI matched system ratings from the Fraser Johnston selection software.',
    ]:
        notes.append([l])
    notes.column_dimensions['A'].width = 140

    src = wb.create_sheet('SOURCES')
    for l in [
        'Fraser Johnston (Bosch) selection software Submittal Reports, printed 11/06/2026: "Quick Select Split-System Heat Pump", "Quick Select Split-System Gas Split" and the follow-up "Quick Select Split-System" report. Built by build_unitary_workbook.py.',
        'One row per AHRI matched system as printed (outdoor + indoor performance pages share the AHRI reference). Values are the tool\'s rating-point output; no capacity tables.',
        'Electric heat kits: JHE Technical Guide tables 12 (allowed kits / minimum fan tap), 16 (kW) and 17 / 19 (single source power MCA / MOP). kW = nominal at 240 V. Temperature rise = kW x 3412 / (1.08 x cooling CFM); the guide requires a minimum blower tap per kit that can be above the cooling tap, so actual heating airflow may be higher and the rise lower.',
        'Gas: input / output at the furnace max (single stage furnaces), AFUE and temperature rise from the furnace performance page. Weight = furnace + coil.',
        'Size (tons) from the outdoor model number (e.g. XH418 = 18 MBH nominal = 1.5 tons).',
    ]:
        src.append([l])
    src.column_dimensions['A'].width = 160
    wb.save(OUT)


hp = hp_rows()
gas, skipped = gas_rows()
write(hp + gas)
n_hp_sys = len({r['_ahri'] for r in hp})
print(f'heat pump: {n_hp_sys} systems / {len(hp)} rows (with heat kits); gas: {len(gas)} systems; '
      f'total rows {len(hp) + len(gas)} -> {OUT}; skipped: {skipped}')
