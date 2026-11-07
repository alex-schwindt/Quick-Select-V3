"""Build DATA/DATA FILES/TempMaster Heat Pump Capacity Tables.xlsx from the
per-guide JSON written by extract_tempmaster_hp.py.

    python build_hp_capacity_workbook.py <out.xlsx> <guide1.json> [<guide2.json> ...]

Applies the catalog corrections listed in CATALOG_FIXES (each one is also
written to the Notes sheet), takes nominal tons from the packaged heat pump
schedule (DATA/JSON/packaged_heat_pumps.json) rather than the table titles,
and checks every schedule row's rated cooling point against the tables.
"""
import collections
import datetime
import json
import os
import sys

import openpyxl
from openpyxl.styles import Font

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEDULE_JSON = os.path.join(HERE, '..', '..', 'DATA', 'JSON', 'packaged_heat_pumps.json')

# (model, page) pairs whose printed cooling table is not that model's data.
DROP_COOLING_PAGES = {
    ('WQE05', 40): 'WQE05 Table 18 (p.40, 75/85°F outdoor) reprints the WXE08 (7.5 ton) '
                   'table: all 264 values and its 1875-3750 CFM labels are identical to '
                   'WXE08\'s. Left out, so WQE05 cooling covers 95-125°F outdoor only.',
}

STANDING_NOTES = [
    'Cooling titles for WYEA7 and WYE08 (pp.34-37) print the tonnages swapped '
    '("WYEA7 (7.5 ton)", "WYE08 (6 ton)"). The data under each title is the right '
    'model (airflows, and the schedule\'s rated points reproduce), so only the tons '
    'are taken from the schedule instead.',
    'WXE09 heating table (p.57) lists airflows 2250 / 3400 / 4250 CFM; the cooling '
    'tables use 2125-4250. Kept as printed.',
    'Heating rows WXE09 3400 CFM 55°F and WXE12 3000 CFM 70°F each have one '
    'uneven outdoor step (likely misprints); every other heating row is a straight '
    'line in outdoor temperature. Kept as printed.',
    'Omni Pro WP: Tables 8-12 (pp.32-41) are hot gas REHEAT capacities (35-45°F outdoor, '
    'same layout as cooling). They are not cooling data and are left out.',
    'Omni Pro WP: WP102 heating rows at 2550 CFM / 80°F, 3400 CFM / 80°F and 4250 CFM '
    '(all DB) step differently from -10 to 0°F than above 0°F; every segment from 0°F up '
    'is straight. Kept as printed.',
    'Omni Pro WP: WP150 heating table lists 3750 / 5000 / 5600 CFM; the cooling table runs '
    'to 6250 CFM. Kept as printed.',
    'Heating tables read below the schedule\'s AHRI 17°F ratings for several sizes (e.g. '
    'WP090 43.2 vs 51 MBH at 70°F, interpolated): the tables are printed at 72% RH and are '
    'used as printed, so heating results at 17°F are on the conservative side.',
]


def schedule_tons():
    data = json.load(open(SCHEDULE_JSON, encoding='utf-8'))
    tons, rated = {}, collections.defaultdict(set)
    for sel in data['selections']:
        for row in sel['rows']:
            sd = row['scheduleData']
            m = str(sd['B'])[:5]
            tons[m] = sd['C']
            rated[m].add((sd['D'], sd['H'], sd['I']))
    return tons, rated


def main():
    out = sys.argv[1]
    guides = [json.load(open(p, encoding='utf-8')) for p in sys.argv[2:]]
    tons, rated = schedule_tons()

    # Omni Choice tables name sizes "MV13"; the schedule's model prefix is
    # "MV13C". Rename to the schedule prefix the site matches on.
    def site_model(m):
        if m in tons:
            return m
        hits = [p for p in tons if p.startswith(m)]
        return hits[0] if len(hits) == 1 else m

    cooling, heating, issues, sources = [], [], [], []
    capped = []
    for g in guides:
        for r in g['cooling'] + g['heating']:
            r['model'] = site_model(r['model'])
        sources.append(g['source'])
        issues.extend('%s: %s' % (g['source'], i) for i in g.get('issues', []))
        for r in g['cooling']:
            if (r['model'], r['page']) in DROP_COOLING_PAGES:
                continue
            if r['sensibleMbh'] > r['totalMbh']:
                capped.append('%s %s CFM / %s°F WB / %s°F OA / %s°F DB (p.%s): sensible %s > '
                              'total %s' % (r['model'], r['cfm'], r['eatWb'], r['oaDb'],
                                            r['eatDb'], r['page'], r['sensibleMbh'], r['totalMbh']))
                r = dict(r, sensibleMbh=r['totalMbh'])
            cooling.append(r)
        heating.extend(g['heating'])

    # Check each schedule row's rating point (its CFM, 80/67°F, 95°F OA).
    idx = {(r['model'], r['cfm'], r['eatDb'], r['eatWb'], r['oaDb']): r for r in cooling}
    checked = matched = 0
    unmatched, not_on_grid = [], []
    for m, pts in sorted(rated.items()):
        if not any(r['model'] == m for r in cooling):
            continue
        for cfm, tot, sens in sorted(pts, key=str):
            r = idx.get((m, cfm, 80, 67, 95))
            if r is None:
                not_on_grid.append('%s @ %s CFM' % (m, cfm))
                continue
            checked += 1
            ok_t = round(r['totalMbh'] * 1000) == tot
            ok_s = sens in (None, '-', '') or round(r['sensibleMbh'] * 1000) == sens
            if ok_t and ok_s:
                matched += 1
            else:
                unmatched.append('%s @ %s CFM: schedule %s/%s, table %s/%s' %
                                 (m, cfm, tot, sens, r['totalMbh'], r['sensibleMbh']))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Cooling'
    ws.append(['Model', 'Tons', 'CFM', 'EAT DB (°F)', 'EAT WB (°F)', 'OA DB (°F)',
               'MBh', 'Sensible MBh', 'Total Input (kW)', 'Source Page'])
    for r in sorted(cooling, key=lambda r: (r['model'], r['cfm'], r['oaDb'], r['eatWb'], r['eatDb'])):
        ws.append([r['model'], tons.get(r['model'], r['tons']), r['cfm'], r['eatDb'],
                   r['eatWb'], r['oaDb'], r['totalMbh'], r['sensibleMbh'], r['inputKw'], r['page']])

    ws = wb.create_sheet('Heat Pump Heating')
    ws.append(['Model', 'Tons', 'CFM', 'Indoor DB (°F)', 'OA DB (°F)', 'MBh', 'Input (kW)',
               'Source Page'])
    for r in sorted(heating, key=lambda r: (r['model'], r['cfm'], r['indoorDb'], r['oaDb'])):
        ws.append([r['model'], tons.get(r['model']), r['cfm'], r['indoorDb'], r['oaDb'],
                   r['mbh'], r['kw'], r['page']])
    for name in ('Cooling', 'Heat Pump Heating'):
        for c in wb[name][1]:
            c.font = Font(bold=True)

    ws = wb.create_sheet('Notes')
    models = sorted({r['model'] for r in cooling})
    notes = [
        'TempMaster Heat Pump Capacity Tables - packaged heat pumps, R-454B: ' + ', '.join(models),
        'Sources: ' + '; '.join(sources) + '. Extracted %s by tools/heat_pump_capacity '
        '(extract_tempmaster_hp.py, build_hp_capacity_workbook.py).' % datetime.date.today().strftime('%m/%d/%Y'),
        'Checked against PACKAGED HEAT PUMP DATA.xlsx: %d of %d schedule rating points '
        '(row CFM, 80/67°F EAT, 95°F OA) reproduce total and sensible capacity exactly.'
        % (matched, checked),
        '',
        'Cooling',
        'Long form, one row per model / CFM / entering DB / entering WB / outdoor DB, the same '
        'layout as TempMaster RTU Capacity Tables.xlsx. MBh is gross total; Sensible MBh is gross '
        'sensible. Total Input kW includes compressors and condenser fans, not the supply blower.',
        'Combinations the catalog prints as "-" (DB too close to WB) are omitted.',
        '',
        'Heat Pump Heating',
        'One row per model / CFM / indoor DB / outdoor DB. MBh and kW exclude the supply blower '
        '(catalog note). Outdoor temperatures are at 72% RH. The site reads the 70°F indoor rows '
        'and interpolates between outdoor columns (see JS/heat_pump_capacity.js).',
        'Omni Choice MV: sizes are printed "MV13" etc.; stored under the schedule prefix '
        '("MV13C"). Cooling prints total AND sensible per return DB (no input kW). Heating '
        'starts at -5°F and, unlike Omni Core / Pro, is not a straight line in outdoor '
        'temperature (capacity rises faster at milder temperatures), so interpolating between '
        'two columns reads slightly above the curve. Checked 11/07/2026 at each size\'s scheduled '
        'CFM: interpolated values are 2-4% below the schedule\'s 47°F ratings and 5-11% below its '
        '17°F ratings (reading the colder column instead would be about 15% low at 47°F).',
        '',
        'Catalog issues found during extraction',
    ]
    notes += ['- ' + v for v in DROP_COOLING_PAGES.values()]
    if capped:
        notes.append('- Sensible printed above total (misprint); sensible capped at total, '
                     'slightly conservative: ' + '; '.join(capped) + '.')
    notes += ['- ' + n for n in STANDING_NOTES]
    if not_on_grid:
        notes.append('- Schedule rows rated at an airflow the tables do not print (not checked): '
                     + ', '.join(not_on_grid) + '.')
    notes += ['- Extraction: ' + i for i in issues]
    notes += ['- MISMATCH: ' + u for u in unmatched]
    for n in notes:
        ws.append([n])
    ws.column_dimensions['A'].width = 140

    wb.save(out)
    print('cooling rows %d, heating rows %d, models %s' % (len(cooling), len(heating), models))
    print('schedule rating points matched %d of %d' % (matched, checked))
    for u in unmatched:
        print('MISMATCH', u)
    for n in not_on_grid:
        print('not on table grid:', n)
    for i in issues:
        print('ISSUE', i)


if __name__ == '__main__':
    main()
