# Unitary split data (Fraser Johnston, 1.5–5 tons)

Builds `DATA/DATA FILES/MULTI POSITION SPLIT DATA.xlsx` (the Unitary & Light Commercial
Split Systems tile) from Fraser Johnston selection-software Submittal Reports. Not part of
the site build; nothing in `tools/` is published.

1. In the selection software, put the systems in one project and print a **Submittal
   Report** with the performance pages on. Give each condenser and indoor unit its own tag.
2. Copy the PDFs into `src/` in this folder: `hp.pdf` (heat pump + air handler),
   `gas.pdf` (AC + furnace + coil), `gasfix.pdf` (follow-up systems), and the JHE
   technical guide as `jhe_tg.pdf`.
3. Run, from this folder:
   ```
   python parse_reports.py src/hp.pdf src/gas.pdf src/gasfix.pdf
   python parse_heatkits.py src/jhe_tg.pdf
   python build_unitary_workbook.py "../../DATA/DATA FILES/MULTI POSITION SPLIT DATA.xlsx"
   ```
   `parse_reports.py` prints how many systems it paired; any "without outdoor/indoor"
   count means a unit was printed without performance ("Run Performance") or without its
   match. Set `WITH_DOCS=1` before the last step once the per-unit submittal PDFs are in
   the bucket.
4. Convert the workbook to JSON (`convert_to_json.py`) and run `node tests/smoke.js`.

Outdoor and indoor performance pages are paired by AHRI reference number. Heat kit kW and
single-point MCA / MOP come from the JHE guide (tables 12, 16, 17, 19); its font splits
decimals ("147 ." = 14.7), which `parse_heatkits.py` decodes.
