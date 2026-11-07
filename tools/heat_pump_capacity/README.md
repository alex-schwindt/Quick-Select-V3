# Packaged heat pump capacity tables (TempMaster, 3–25 tons)

Builds `DATA/DATA FILES/TempMaster Heat Pump Capacity Tables.xlsx`, which drives the
condition-aware Packaged Heat Pumps section of Design Search (`JS/heat_pump_capacity.js`).
Not part of the site build; nothing in `tools/` is published.

1. Put the three TempMaster technical guides in `DATA/DATA FILES/` (PDFs there are
   gitignored). They are the files the schedule links to, in the document bucket under
   `ASSETS/PACKAGED HEAT PUMPS/ENGINEERING MANUALS/`:
   - `TempMaster Omni Core WQ-WY-WX 3-10 Ton Heat Pump Technical Guide.pdf`
   - `TempMaster Omni Pro WP 6.5-12.5 Ton Heat Pump Technical Guide.pdf`
   - `TempMaster Omni Choice MV 12.5-25 Ton Heat Pump Technical Guide.pdf`
2. With Python 3 + `pymupdf` + `openpyxl`, from the project folder:
   ```
   python tools/heat_pump_capacity/extract_tempmaster_hp.py "DATA/DATA FILES/TempMaster Omni Core WQ-WY-WX 3-10 Ton Heat Pump Technical Guide.pdf" core.json
   python tools/heat_pump_capacity/extract_tempmaster_hp.py "DATA/DATA FILES/TempMaster Omni Pro WP 6.5-12.5 Ton Heat Pump Technical Guide.pdf" pro.json
   python tools/heat_pump_capacity/extract_tempmaster_hp.py "DATA/DATA FILES/TempMaster Omni Choice MV 12.5-25 Ton Heat Pump Technical Guide.pdf" choice.json
   python tools/heat_pump_capacity/build_hp_capacity_workbook.py "DATA/DATA FILES/TempMaster Heat Pump Capacity Tables.xlsx" core.json pro.json choice.json
   ```
   Each extract prints its record counts and any `ISSUE` lines (there should be none).
   The build step prints how many schedule rating points (row CFM, 80/67 °F, 95 °F) the
   tables reproduce - it should be all of them except rows rated at an airflow the
   tables don't print - and writes the same checks and every catalog misprint handled
   to the workbook's Notes sheet.
3. Convert the workbook to JSON (`convert_to_json.py`, pick the capacity workbook) and
   run `node tests/smoke.js`.

Known catalog misprints are handled in `build_hp_capacity_workbook.py`
(`DROP_COOLING_PAGES`, `STANDING_NOTES`). If a new revision of a guide moves pages,
check the WQE05 p.40 entry still points at the reprinted table before rebuilding.
