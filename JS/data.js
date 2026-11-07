/* ============================================================
   HHpro - Data module
   ------------------------------------------------------------
   Central product registry. Adding a new product type to the
   site is as simple as adding a new entry to PRODUCTS below
   (plus running convert_to_json.py on the matching Excel file).
   ============================================================ */

(function () {
    'use strict';

    window.HHpro = window.HHpro || {};

    /**
     * Product registry.
     *
     * Each entry describes one product type tile on the main page and
     * links to the JSON data file the site loads for that product.
     *
     * To add a new product type:
     *   1. Add the Excel file to DATA/DATA FILES/
     *   2. Add an entry in convert_to_json.py's PRODUCT_CONFIGS
     *   3. Run convert_to_json.py
     *   4. Add a new entry below, then add a matching tile color
     *      variable and .tile-<productKey> rule in CSS/main.css
     *   5. Create a stub JS file at JS/products/<productKey>.js
     *      (see gas_packs.js for the pattern) and add it to index.html
     *   6. (Optional) Drop a JPG in DATA/PICTURES/ with the exact
     *      filename shown in pictureFile. If missing, the colored
     *      placeholder shows instead.
     */
    var PRODUCTS = [
        {
            productKey: 'gas_packs',
            displayName: 'GAS PACK RTUS',
            jsonFile: 'DATA/JSON/gas_packs.json',
            pictureFile: 'DATA/PICTURES/TempMaster_Omni_Core_black_bg.jpg',
            assetsFolder: 'ASSETS/GAS PACKS',
            tileClass: 'tile-gas-packs'
        },
        {
            // TempMaster Omni Core / Pro / Choice heat pumps from the technical
            // guides - see the SOURCES tab of DATA/DATA FILES/PACKAGED HEAT
            // PUMP DATA.xlsx. Electric heat options fold into a kW dropdown that
            // swaps the model number (WP factory heat), heater kit and MCA/MOCP.
            productKey: 'packaged_heat_pumps',
            displayName: 'PACKAGED HEAT PUMPS',
            jsonFile: 'DATA/JSON/packaged_heat_pumps.json',
            // Same cabinet as the gas packs from the outside.
            pictureFile: 'DATA/PICTURES/GAS PACK RTUS.jpg',
            assetsFolder: 'ASSETS/PACKAGED HEAT PUMPS',
            tileClass: 'tile-packaged-heat-pumps',
            autoTagPrefix: 'RTU-',
            kwVariants: {
                variantColumn: 'V',
                dependentColumns: ['B', 'W', 'X', 'AB', 'AC'],
                filterName: 'ELECTRIC HEAT',
                defaultValue: '-'
            }
        },
        {
            productKey: 'mini_splits',
            displayName: 'MINI SPLITS',
            jsonFile: 'DATA/JSON/mini_splits.json',
            pictureFile: 'DATA/PICTURES/MINI SPLITS.jpg',
            assetsFolder: 'ASSETS/MINI SPLITS',
            tileClass: 'tile-mini-splits',
            // Indoor-unit-type picker gallery rendered above the filters
            // on the browse page (see JS/mini_splits.js). `type` must
            // match a TYPE (INDOOR UNIT #1) filter value exactly -
            // clicking a card filters the schedule to that indoor type.
            // Photos are the indoor-unit shots from the Midea submittal
            // PDFs, flood-filled onto black.
            typeGallery: [
                { type: 'Wall Mounted',        picture: 'DATA/PICTURES/MINI SPLIT TYPES/Wall Mounted (Midea).jpg' },
                { type: 'One-Way Cassette',    picture: 'DATA/PICTURES/MINI SPLIT TYPES/One-Way Cassette.jpg' },
                { type: 'Round Flow Cassette', picture: 'DATA/PICTURES/MINI SPLIT TYPES/Round Flow Cassette.jpg' },
                { type: 'Slim Duct',           picture: 'DATA/PICTURES/MINI SPLIT TYPES/Slim Duct.jpg' },
                { type: 'Console',             picture: 'DATA/PICTURES/MINI SPLIT TYPES/Console.jpg' },
                { type: 'Ceiling & Floor',     picture: 'DATA/PICTURES/MINI SPLIT TYPES/Ceiling & Floor.jpg' }
            ]
        },
        {
            productKey: 'multi_position_splits',
            // Fraser Johnston heat pump + air handler and AC + gas furnace
            // systems, 1.5-5 tons, in one schedule (SYSTEM TYPE filter).
            displayName: 'UNITARY & LIGHT COMMERCIAL SPLIT SYSTEMS',
            jsonFile: 'DATA/JSON/multi_position_splits.json',
            pictureFile: 'DATA/PICTURES/MULTI POSITION SPLITS.jpg',
            assetsFolder: 'ASSETS/MULTI POSITION SPLITS',
            tileClass: 'tile-multi-position-splits',
            // Heat pump rows: one row per 8HK heat kit, folded into a kW
            // dropdown; temperature rise and the indoor MCA / MOP follow it.
            kwVariants: {
                variantColumn: 'O',
                dependentColumns: ['P', 'R', 'S'],
                filterName: 'KW',
                defaultValue: '-'
            },
            // Gas columns on heat pump rows (and heat pump / kW columns on
            // gas rows) are "-": hide whatever is all "-" for the rows in view.
            hideEmptyColumns: true
        },
        {
            // Bosch CL / CF / CP / EC at AHRI water-loop ratings - see the
            // SOURCES tab of DATA/DATA FILES/WATER SOURCE HEAT PUMP DATA.xlsx.
            productKey: 'water_source_heat_pumps',
            displayName: 'WATER SOURCE HEAT PUMPS',
            jsonFile: 'DATA/JSON/water_source_heat_pumps.json',
            pictureFile: 'DATA/PICTURES/WATER SOURCE HEAT PUMPS.jpg',
            assetsFolder: 'ASSETS/WATER SOURCE HEAT PUMPS',
            tileClass: 'tile-water-source-heat-pumps',
            autoTagPrefix: 'WSHP-'
        },
        {
            // Quantech air-cooled chillers H&H holds in stock. Visible to
            // everyone, engineers included. To make it H&H-only again, add
            // internalOnly: true here and list the JSON in worker/index.js
            // INTERNAL_ONLY (+ run_worker_first in wrangler.jsonc).
            productKey: 'stocked_chillers',
            displayName: 'AIR COOLED CHILLERS',
            jsonFile: 'DATA/JSON/stocked_chillers.json',
            pictureFile: 'DATA/PICTURES/CHILLERS.jpg',
            assetsFolder: 'ASSETS/STOCKED CHILLERS',
            tileClass: 'tile-stocked-chillers',
            autoTagPrefix: 'CH-'
        },
        {
            // AIRSYS School Air Solutions (Focus IQ indoor / BackPack outdoor)
            // from the AIRSYS specification sheet and data sheets - see the
            // SOURCES tab of DATA/DATA FILES/AIRSYS DATA.xlsx.
            productKey: 'airsys',
            displayName: 'AIRSYS VERTICAL WALL MOUNT',
            jsonFile: 'DATA/JSON/airsys.json',
            pictureFile: 'DATA/PICTURES/AIRSYS VERTICAL WALL MOUNT.jpg',
            assetsFolder: 'ASSETS/AIRSYS',
            tileClass: 'tile-airsys',
            autoTagPrefix: 'HP-',
            // Heater kW dropdown; the model number (heater digits) and
            // MCA / MOCP change with it.
            kwVariants: {
                variantColumn: 'R',
                dependentColumns: ['B', 'T', 'U'],
                filterName: 'ELECTRIC HEAT',
                defaultValue: 0
            }
        },
        {
            productKey: 'marvair',
            // Marvair isn't sold in Nashville; replaced by the AIRSYS section
            // above. Hidden, but still resolvable for saved project items.
            retired: true,
            displayName: 'MARVAIR VERTICAL WALL MOUNT',
            jsonFile: 'DATA/JSON/marvair.json',
            pictureFile: 'DATA/PICTURES/MARVAIR VERTICAL WALL MOUNT.jpg',
            assetsFolder: 'ASSETS/MARVAIR',
            tileClass: 'tile-marvair',
            // Collapse selections that differ only in ELECTRIC HEAT (KW)
            // into a single row with a kW dropdown. The dropdown swaps
            // the dependent columns (MCA, MOCP) to the chosen variant's
            // values. See multi_position_splits above for details.
            kwVariants: {
                variantColumn: 'K',
                dependentColumns: ['M', 'N'],
                filterName: 'ELECTRIC HEAT',
                defaultValue: 0
            }
        },
        // Planned sections - placeholder tiles only (no data file yet), shown
        // greyed out with a COMING SOON banner. Drop a JPG at pictureFile to
        // give a tile its photo.
        {
            // Enviro-Tec fan coils (HL, HP, CDV, VF/VL) from the ETI
            // catalogs - see the SOURCES tab of DATA/DATA FILES/FAN COIL
            // DATA.xlsx.
            productKey: 'fan_coils',
            displayName: 'FAN COILS',
            jsonFile: 'DATA/JSON/fan_coils.json',
            pictureFile: 'DATA/PICTURES/FAN COILS.jpg',
            assetsFolder: 'ASSETS/FAN COILS',
            tileClass: 'tile-fan-coils',
            autoTagPrefix: 'FCU-',
            // Airflow box in the filter bar: keeps the nearest CFM at or
            // below and at or above the entry for each series / cabinet /
            // coil-rows line.
            nearestFilter: {
                column: 'D',
                label: 'AIRFLOW (CFM)',
                groupFilters: ['SERIES', 'CABINET'],
                groupColumns: ['G']
            },
            // Electric heat kW dropdown ('-' = no heat); heat type, heater
            // amps and the calculated MCA / MOP change with it.
            kwVariants: {
                variantColumn: 'P',
                dependentColumns: ['L', 'Q', 'T', 'U'],
                filterName: 'ELECTRIC HEAT',
                defaultValue: '-'
            }
        },
        {
            // Enviro-Tec VAV terminals (SDR single duct, VFR parallel and CRB
            // series fan-powered) from the ETI catalogs - see the SOURCES tab
            // of DATA/DATA FILES/VAV DATA.xlsx.
            productKey: 'vavs',
            displayName: 'VAVs',
            jsonFile: 'DATA/JSON/vavs.json',
            pictureFile: 'DATA/PICTURES/VAVs.jpg',
            assetsFolder: 'ASSETS/VAVS',
            tileClass: 'tile-vavs',
            autoTagPrefix: 'VAV-',
            // ~6,400 rows across the three series; open on one so the
            // first render stays quick.
            initialFilters: { 'TYPE': 'SDR SINGLE DUCT' },
            // Heat size dropdown: hot water rows list each coil option
            // ("1-ROW @ 1 GPM"), electric heat rows the kW sizes. Min dPs,
            // capacity, LAT / LWT / WPD / APD, heater amps and the
            // calculated MCA / MOP change with it.
            // Heating airflow (F) is a dependent too: SDR electric heat rows
            // are rated at the least airflow each kW needs (kW x 70 CFM).
            kwVariants: {
                variantColumn: 'J',
                dependentColumns: ['F', 'H', 'K', 'M', 'O', 'P', 'Q', 'T', 'U', 'V'],
                filterName: 'HEAT SIZE'
            },
            // SDR electric heat: the engineer types the heating airflow;
            // the kW list keeps the sizes it supports (70 CFM per kW, up to
            // the max airflow) and heating CFM / LAT follow it
            // (JS/heat_airflow.js). Saved on the cart item as heatCfm.
            heatAirflow: {
                label: 'ELECTRIC HEAT AIRFLOW (CFM)',
                showWhen: { 'TYPE': 'SDR SINGLE DUCT', 'HEATING TYPE': 'ELECTRIC' },
                appliesWhen: { 'C': 'SDR SINGLE DUCT', 'I': 'ELECTRIC' },
                airflowColumn: 'F',
                maxColumn: 'E',
                capacityColumn: 'K',
                eatColumn: 'L',
                latColumn: 'M'
            }
        },
        {
            // Cambridge direct gas-fired heaters (M-Series, Spec Air, S-Series,
            // SA-Series) from the engineering specification manuals - see the
            // SOURCES tab of DATA/DATA FILES/CAMBRIDGE DATA.xlsx.
            productKey: 'cambridge',
            displayName: 'CAMBRIDGE DIRECT-FIRED HEATERS',
            jsonFile: 'DATA/JSON/cambridge.json',
            pictureFile: 'DATA/PICTURES/CAMBRIDGE.jpg',
            assetsFolder: 'ASSETS/CAMBRIDGE',
            tileClass: 'tile-cambridge',
            autoTagPrefix: 'MAU-',
            // ~18,500 rows; open on the make-up air units.
            initialFilters: { 'TYPE': 'M-SERIES MAKE-UP AIR (DRAW-THRU)' },
            // Temperature rise dropdown; burner input / length and the gas
            // train pressures change with it.
            kwVariants: {
                variantColumn: 'H',
                dependentColumns: ['I', 'J', 'K', 'L', 'M'],
                filterName: 'TEMP RISE'
            }
        },
        {
            // Not a schedule: the tile opens the design request form
            // (JS/ahu_request.js), which is emailed to H&H on submit.
            productKey: 'air_handler_design_request',
            displayName: 'AIR HANDLER DESIGN REQUEST',
            pictureFile: 'DATA/PICTURES/AIR HANDLER DESIGN REQUEST.jpg',
            tileClass: 'tile-air-handler-design-request',
            view: 'ahu_request',
            excludeFromDesignSearch: true
        },
        {
            productKey: 'vfds',
            retired: true,
            displayName: 'VFDs',
            jsonFile: 'DATA/JSON/vfds.json',
            pictureFile: 'DATA/PICTURES/VFDs.jpg',
            assetsFolder: 'ASSETS/VFDs',
            tileClass: 'tile-vfds',
            // Unlike the other products, VFD schedule notes are a fixed
            // authoritative list - users can't delete items or add
            // custom ones. The notes render as a plain numbered list
            // in the order defined on the SCHEDULE NOTES tab.
            scheduleNotesReadOnly: true,
            // Schedule column letters to hide on the selection (browse)
            // page. The project-view schedule creator still shows these.
            // For VFDs, column M is the "Notes" column (per-item note
            // numbers) - useful in the final schedule but noisy while
            // browsing.
            hiddenSelectionColumns: ['M'],
            // Don't render the free-text "Accessories" column anywhere
            // (browse page, project schedule creator, Excel/PDF export).
            // VFDs convey per-item annotations via the Notes column.
            hideAccessoriesColumn: true,
            // Render a manual-input "Serves" column immediately to the
            // right of the primary Tag column in the project schedule
            // creator (and in Excel/PDF export).
            hasServesColumn: true,
            // Auto Tag prefix default for this product.
            autoTagPrefix: 'VFD-'
        },
        {
            productKey: 'gps',
            retired: true,
            displayName: 'Bipolar Ionization',
            // Short label used in export filenames (productTabLabel).
            name: 'Bipolar Ionization',
            jsonFile: 'DATA/JSON/gps.json',
            pictureFile: 'DATA/PICTURES/GPS/GPS.webp',
            assetsFolder: 'ASSETS/GPS',
            tileClass: 'tile-gps',
            autoTagPrefix: 'AI-',
            // Pre-fill each selected item's Accessories box with "All".
            defaultAccessories: 'All',
            // The GPS JSON holds SEVEN independent sub-schedules (see
            // subSchedules in gps.json); JS/gps.js renders the photo
            // gallery + per-sub-schedule pages, and export.js /
            // project_view.js stack one section per sub-schedule.
            // ZONE TAG (col A) is blank in the data - hideEmptyColumns
            // drops it (the project view's own Tag column takes over),
            // along with any column empty for the models in view.
            hideEmptyColumns: true,
            // Notes are the authoritative pre-numbered lists under each
            // schedule in the Excel; data rows cite the numbers, so no
            // editing/renumbering is allowed anywhere.
            scheduleNotesReadOnly: true,
            // Mixed per-schedule columns make tolerance targets
            // meaningless here - keep GPS out of Design Search.
            excludeFromDesignSearch: true,
            // Where the sub-schedule gallery photos live: each card's
            // image is '<folder>/GPS - <photoKey>.webp'.
            photoFolder: 'DATA/PICTURES/GPS',
            // Gallery card captions default to the sub-schedule's
            // LOCATION filter value; override per schedule TITLE (must
            // match the Excel title row exactly) when two schedules
            // share a filter value and need distinct captions.
            subScheduleLabels: {
                'AIR IONIZATION DEVICE SCHEDULE - FAN COIL MOUNTED':
                    'FAN COIL MOUNTED (BAS COMPATIBLE)'
            }
        }
    ];

    // In-memory cache for loaded product JSON (filled lazily by loadProduct)
    var productDataCache = {};

    HHpro.Data = {
        /**
         * Products this user can browse (home tiles, Design Search, model
         * lookup). Sections flagged retired (lines not sold in Nashville)
         * are hidden from browsing, but getProduct still resolves them so
         * items already saved in projects keep rendering and exporting.
         * Sections flagged internalOnly are H&H-staff only; the
         * Worker also refuses their data file to everyone else, so this is
         * only about not showing a tile that can't load.
         */
        getProducts: function () {
            var internal = !!(HHpro.ProjectSync && HHpro.ProjectSync.isInternal());
            return PRODUCTS.filter(function (p) {
                return !p.retired && (internal || !p.internalOnly);
            });
        },

        getProduct: function (productKey) {
            for (var i = 0; i < PRODUCTS.length; i++) {
                if (PRODUCTS[i].productKey === productKey) {
                    return PRODUCTS[i];
                }
            }
            return null;
        },

        /**
         * Asynchronously fetch a product's JSON data. Caches after first load.
         * Returns a Promise resolving to the parsed JSON object.
         */
        loadProduct: function (productKey) {
            var product = this.getProduct(productKey);
            if (!product) {
                return Promise.reject(new Error('Unknown product key: ' + productKey));
            }
            if (productDataCache[productKey]) {
                return Promise.resolve(productDataCache[productKey]);
            }
            return fetch(product.jsonFile)
                .then(function (resp) {
                    if (!resp.ok) {
                        throw new Error('Failed to load ' + product.jsonFile + ' (HTTP ' + resp.status + ')');
                    }
                    return resp.json();
                })
                .then(function (data) {
                    // Very large products are split across
                    // multiple JSON files to stay under Cloudflare's
                    // 25 MiB per-file asset limit. The main file lists
                    // its continuation files (selections-only chunks in
                    // the same folder); fetch them all and re-join the
                    // selections in order before caching.
                    var cont = data.continuationFiles;
                    if (!cont || !cont.length) {
                        productDataCache[productKey] = data;
                        return data;
                    }
                    var dir = product.jsonFile.slice(0, product.jsonFile.lastIndexOf('/') + 1);
                    return Promise.all(cont.map(function (name) {
                        var url = dir + name;
                        return fetch(url).then(function (resp) {
                            if (!resp.ok) {
                                throw new Error('Failed to load ' + url + ' (HTTP ' + resp.status + ')');
                            }
                            return resp.json();
                        });
                    })).then(function (partList) {
                        partList.forEach(function (part) {
                            data.selections = data.selections.concat(part.selections || []);
                        });
                        productDataCache[productKey] = data;
                        return data;
                    });
                });
        }
    };
})();