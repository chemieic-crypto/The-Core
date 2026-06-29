// --- Groundwater Data Engine: Core Functions & State ---

// Global Application State (Attached to window for cross-script compatibility)
window.globalRawWellDictionary = {};
window.globalFilteredDictionary = {};
window.globalOutputData = [];
window.globalDistributionOutputData = [];
window.globalValidationOutputData = [];
window.globalAvailabilityOutputData = [];
window.globalSeasonalOutputData = [];
window.globalSummaryData = {};

window.globalValidationStats = { missingID: 0, missingLocation: 0, missingWL: 0, negativeWL: 0, totalRows: 0 };
window.latestGlobalYear = 0;
window.isDarkTheme = false;

window.uploadedFileSource = null;
window.uploadedFileType = null;

window.stateSet = new Set();
window.districtByState = {};
window.blockByDistrict = {};
window.availableYears = new Set();
window.availableSeasons = new Set();

// ** Dynamic Table Dirty Rendering Flags **
window.tabDataDirty = { 
    'table': true, 'seasonal': true, 'distribution': true, 
    'availability': true, 'validation': true, 'map': true, 'charts': true, 'summary': true 
};
window.currentActiveTab = 'table';

window.normalizeStateName = function(stateStr) {
    if (!stateStr) return '';
    let clean = String(stateStr).trim().replace(/\s+/g, ' '); // remove extra inner spaces
    let lower = clean.toLowerCase();
    
    // Check known mappings/fuzzy corrections
    const mappings = {
        'orissa': 'Odisha',
        'odisha': 'Odisha',
        'chattisgarh': 'Chhattisgarh',
        'chhatisgarh': 'Chhattisgarh',
        'chhattisgarh': 'Chhattisgarh',
        'tamilnadu': 'Tamil Nadu',
        'tamil nadu': 'Tamil Nadu',
        'westbengal': 'West Bengal',
        'west bengal': 'West Bengal',
        'andhrapradesh': 'Andhra Pradesh',
        'andhra pradesh': 'Andhra Pradesh',
        'uttarpradesh': 'Uttar Pradesh',
        'uttar pradesh': 'Uttar Pradesh',
        'madhyapradesh': 'Madhya Pradesh',
        'madhya pradesh': 'Madhya Pradesh',
        'himachalpradesh': 'Himachal Pradesh',
        'himachal pradesh': 'Himachal Pradesh',
        'arunachalpradesh': 'Arunachal Pradesh',
        'arunachal pradesh': 'Arunachal Pradesh',
        'pondicherry': 'Puducherry',
        'puducherry': 'Puducherry'
    };
    
    if (mappings[lower]) {
        return mappings[lower];
    }
    
    // Default: title-case the string
    return lower.replace(/\b\w/g, char => char.toUpperCase());
};

// Helper: Toast Notifications
window.showToast = function(message, type = 'error') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    
    let bgColor, iconClass;
    switch(type) {
        case 'success':
            bgColor = 'bg-emerald-600';
            iconClass = 'ph-check-circle';
            break;
        case 'info':
            bgColor = 'bg-blue-600';
            iconClass = 'ph-info';
            break;
        default:
            bgColor = 'bg-rose-600';
            iconClass = 'ph-warning-circle';
            break;
    }
    
    toast.className = `px-6 py-3 rounded-xl font-bold text-white shadow-2xl transition-all duration-300 transform translate-y-full opacity-0 flex items-center gap-3 ${bgColor}`;
    toast.innerHTML = `<i class="ph-bold ${iconClass} text-2xl"></i> <span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-full', 'opacity-0');
    });

    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 300); 
    }, 4000);
};

window.showLoader = function(text) {
    const el = document.getElementById('loaderText'); 
    if(el) el.innerText = text;
    const loader = document.getElementById('globalLoader'); 
    if(loader) loader.style.display = 'flex';
};

window.hideLoader = function() { 
    const loader = document.getElementById('globalLoader'); 
    if(loader) loader.style.display = 'none'; 
};

// Coordinate Parser (Transforms degrees/minutes/seconds or strings to float numbers)
window.parseCoordinate = function(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return val;
    let str = String(val).trim(); if (str === '') return NaN;
    let floatVal = parseFloat(str);
    if (!isNaN(floatVal) && !/[°'"NSWEnswe]/.test(str) && !/[a-zA-Z]/.test(str)) return floatVal;
    let parts = str.match(/\d+(\.\d+)?/g);
    if (!parts || parts.length === 0) { 
        let finalFloat = parseFloat(str.replace(/[^\d.-]/g, '')); 
        return isNaN(finalFloat) ? NaN : finalFloat; 
    }
    let deg = parseFloat(parts[0]) || 0; 
    let min = parts.length > 1 ? parseFloat(parts[1]) : 0; 
    let sec = parts.length > 2 ? parseFloat(parts[2]) : 0;
    let dec = deg + (min / 60) + (sec / 3600); 
    if (/[SWsw]/.test(str)) dec = -dec; 
    return dec;
};

// Process Excel/CSV Upload Pipelines
window.handleFileUpload = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const fileName = file.name.toLowerCase();
    window.showLoader("Reading Headers...");
    window.uploadedFileSource = file;
    
    setTimeout(() => {
        if (fileName.endsWith('.csv')) {
            window.uploadedFileType = 'csv';
            Papa.parse(file, {
                header: true,
                preview: 10,
                skipEmptyLines: true,
                transformHeader: function(h) { return h.replace(/^\uFEFF/, '').trim(); },
                complete: function(results) {
                    if (results.meta.fields && results.meta.fields.length > 1) {
                        window.initiateMapping(results.meta.fields);
                    } else { 
                        window.hideLoader(); 
                        window.showToast("Could not find a valid header row in the CSV file.", "error"); 
                    }
                },
                error: function(err) { 
                    window.hideLoader(); 
                    window.showToast("Error parsing CSV: " + err.message, "error"); 
                }
            });
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            window.uploadedFileType = 'excel';
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    if (file.size > 25 * 1024 * 1024) window.showToast("Notice: Large Excel file. CSV is recommended for speed.", "info");
                    const wbPreview = XLSX.read(e.target.result, {type: 'binary', cellDates: false, sheetRows: 50});
                    const sheetPreview = wbPreview.Sheets[wbPreview.SheetNames[0]];
                    const aoa = XLSX.utils.sheet_to_json(sheetPreview, {header: 1, defval: ""});
                    if (aoa.length === 0) { 
                        window.hideLoader(); 
                        window.showToast("No data found in Excel.", "error"); 
                        return; 
                    }
                    let headerRowIdx = 0; let maxCols = 0;
                    for (let i = 0; i < Math.min(20, aoa.length); i++) { 
                        let cols = aoa[i].filter(cell => cell !== undefined && String(cell).trim() !== '').length; 
                        if (cols > maxCols) { maxCols = cols; headerRowIdx = i; } 
                    }
                    const originalHeaders = aoa[headerRowIdx] || []; const headers = [];
                    originalHeaders.forEach((h, idx) => { 
                        let hName = (h !== undefined && h !== null) ? String(h).trim() : ''; 
                        if (!hName) hName = `__EMPTY_${idx}`; 
                        let finalName = hName; let counter = 1; 
                        while(headers.includes(finalName)) { finalName = `${hName}_${counter}`; counter++; } 
                        headers.push(finalName); 
                    });
                    if (headers.length > 0) { 
                        window.uploadedFileSource = e.target.result; 
                        window.initiateMapping(headers); 
                    } else { 
                        window.hideLoader(); 
                        window.showToast("No valid headers found in Excel.", "error"); 
                    }
                } catch (err) { 
                    window.hideLoader(); 
                    window.showToast("Error parsing Excel: " + err.message, "error"); 
                }
            }; 
            reader.readAsBinaryString(file);
        } else { 
            window.hideLoader(); 
            window.showToast("Please upload a valid CSV or Excel file.", "error"); 
        }
    }, 50); 
};

const mappingConfig = [
    { id: 'map_well', label: 'Well / Site ID', req: true, match: ['wellno', 'well', 'site', 'id'] },
    { id: 'map_state', label: 'State Name', req: true, match: ['statename', 'statenam', 'state'] },
    { id: 'map_dist', label: 'District Name', req: true, match: ['districtname', 'districtna', 'district', 'dist'] },
    { id: 'map_block', label: 'Block / Taluk', req: false, match: ['block_taluk', 'block_talu', 'block', 'taluk', 'tehsil'] },
    { id: 'map_date', label: 'Year / Date of Monitoring', req: true, match: ['dateofmonitoring', 'year', 'dateof', 'date'] },
    { id: 'map_wl', label: 'Water Level (mbgl)', req: true, match: ['water_level, mbgl', 'water_level', 'water_lavel', 'water_lav', 'wl', 'dtw'] },
    { id: 'map_lat', label: 'Latitude / Northing', req: false, match: ['latitude', 'lat', 'northing', 'north', 'y'] },
    { id: 'map_lon', label: 'Longitude / Southing / Easting', req: false, match: ['longitude', 'lon', 'long', 'easting', 'east', 'southing', 'x'] },
    { id: 'map_loc', label: 'Location Details', req: false, match: ['village', 'location', 'place'] },
    { id: 'map_source', label: 'Source', req: false, match: ['welltype', 'source', 'type', 'well_type'] },
    { id: 'map_aquifer', label: 'Aquifer', req: false, match: ['aqtap', 'aquifer', 'formation'] }
];

window.initiateMapping = function(headers) {
    const container = document.getElementById('mappingFieldsContainer'); if(!container) return; 
    container.innerHTML = '';
    const validHeaders = headers.filter(h => h != null && String(h).trim() !== '');
    mappingConfig.forEach(conf => {
        let bestMatch = '';
        for (let m of conf.match) { 
            let found = validHeaders.find(h => String(h).toLowerCase().includes(m.toLowerCase())); 
            if (found) { bestMatch = found; break; } 
        }
        let optionsHTML = `<option value="">-- Select Column --</option>` + validHeaders.map(h => `<option value="${h}" ${h === bestMatch ? 'selected' : ''}>${h}</option>`).join('');
        let html = `<div class="flex flex-col"><label class="text-[10px] font-bold text-slate-500 uppercase mb-1">${conf.label} ${conf.req ? '<span class="text-red-500">*</span>' : ''}</label>
                <select id="${conf.id}" class="w-full bg-slate-50 rounded px-3 py-2 border ${conf.req ? 'border-blue-300' : 'border-slate-200'} font-bold shadow-sm focus:border-blue-500 text-slate-800 text-sm">${optionsHTML}</select></div>`;
        container.innerHTML += html;
    });
    window.hideLoader(); 
    const modal = document.getElementById('mappingModal'); 
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
};

window.cancelMapping = function() { 
    const modal = document.getElementById('mappingModal'); 
    if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); } 
    window.uploadedFileSource = null; window.uploadedFileType = null; 
    const fileInput = document.getElementById('csvFileInput'); 
    if (fileInput) fileInput.value = '';
};

window.confirmMapping = function() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const map = { 
        well: getVal('map_well'), state: getVal('map_state'), dist: getVal('map_dist'), 
        block: getVal('map_block'), date: getVal('map_date'), wl: getVal('map_wl'), 
        lat: getVal('map_lat'), lon: getVal('map_lon'), loc: getVal('map_loc'), 
        source: getVal('map_source'), aquifer: getVal('map_aquifer') 
    };
    if (!map.well || !map.state || !map.dist || !map.date || !map.wl) { 
        window.showToast("Please map all required fields (Well ID, State, District, Date, and Water Level).", "error"); 
        return; 
    }
    const modal = document.getElementById('mappingModal'); 
    if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    
    window.globalRawWellDictionary = {}; 
    window.globalValidationStats = { missingID: 0, missingLocation: 0, missingWL: 0, negativeWL: 0, totalRows: 0 };
    window.stateSet.clear(); 
    window.districtByState = {}; 
    window.blockByDistrict = {}; 
    window.availableYears.clear(); 
    window.availableSeasons.clear(); 
    window.latestGlobalYear = 0;
    window.showLoader("Starting Data Stream Analysis...");
    
    const fileSourceToProcess = window.uploadedFileSource;
    window.uploadedFileSource = null;

    if (window.uploadedFileType === 'csv') {
        window.processCSVStream(fileSourceToProcess, map);
    } else {
        setTimeout(() => {
            try {
                const wb = XLSX.read(fileSourceToProcess, {type: 'binary', cellDates: false});
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, {header: 1, defval: ""});
                let headerRowIdx = 0; let maxCols = 0;
                for (let i = 0; i < Math.min(20, aoa.length); i++) { 
                    let cols = aoa[i].filter(cell => cell !== undefined && String(cell).trim() !== '').length; 
                    if (cols > maxCols) { maxCols = cols; headerRowIdx = i; } 
                }
                const originalHeaders = aoa[headerRowIdx] || []; const headers = [];
                originalHeaders.forEach((h, idx) => { 
                    let hName = (h !== undefined && h !== null) ? String(h).trim() : ''; 
                    if (!hName) hName = `__EMPTY_${idx}`; 
                    let finalName = hName; let counter = 1; 
                    while(headers.includes(finalName)) { finalName = `${hName}_${counter}`; counter++; } 
                    headers.push(finalName); 
                });
                const data = [];
                for (let i = headerRowIdx + 1; i < aoa.length; i++) {
                    const row = aoa[i]; 
                    if (row.length === 0 || row.every(cell => cell === undefined || String(cell).trim() === '')) continue;
                    const rowData = {}; 
                    headers.forEach((h, idx) => { rowData[h] = row[idx] !== undefined ? row[idx] : ""; }); 
                    data.push(rowData);
                }
                window.processDataArray(data, map);
            } catch(err) { 
                window.hideLoader(); 
                window.showToast("Error processing Excel file: " + err.message, "error"); 
            }
        }, 50);
    }
};

window.processSingleRowData = function(row, colMap) {
    window.globalValidationStats.totalRows++;
    const rawWell = row[colMap.well]; const rawState = row[colMap.state]; const dateValue = row[colMap.date]; const wlRaw = row[colMap.wl];
    const latRaw = colMap.lat && row[colMap.lat] ? String(row[colMap.lat]).trim() : ''; 
    const lonRaw = colMap.lon && row[colMap.lon] ? String(row[colMap.lon]).trim() : '';
    
    let latVal = window.parseCoordinate(latRaw); let lonVal = window.parseCoordinate(lonRaw);
    if (Math.abs(latVal) > 60 && Math.abs(latVal) <= 180 && Math.abs(lonVal) <= 40) { 
        let temp = latVal; latVal = lonVal; lonVal = temp; 
    }
    if (Math.abs(latVal) > 90 || Math.abs(lonVal) > 180) { latVal = NaN; lonVal = NaN; }

    const state = window.normalizeStateName(rawState);
    let isMissingID = !rawWell || String(rawWell).trim() === '';
    let isMissingLoc = (!state) && (isNaN(latVal) && isNaN(lonVal));
    let isMissingWL = wlRaw === undefined || wlRaw === null || String(wlRaw).trim() === ''; 
    let wlNum = parseFloat(wlRaw); 
    let isNegativeWL = !isMissingWL && !isNaN(wlNum) && wlNum < 0;

    if (isMissingID) window.globalValidationStats.missingID++; 
    if (isMissingLoc) window.globalValidationStats.missingLocation++;
    if (isMissingWL) window.globalValidationStats.missingWL++; 
    if (isNegativeWL) window.globalValidationStats.negativeWL++;
    if (isMissingID || !state || !dateValue || isMissingWL || isNaN(wlNum)) return;

    const district = colMap.dist && row[colMap.dist] ? String(row[colMap.dist]).trim() : 'Unknown';
    const block = colMap.block && row[colMap.block] ? String(row[colMap.block]).trim() : 'Unknown'; 
    const well = String(rawWell).trim(); 
    const wellKey = state + "_" + district + "_" + block + "_" + well;

    let yearInt = NaN;
    let parsedMonth = NaN;

    let dStrLowCheck = String(dateValue).trim().toLowerCase();
    let isExplicitSeason = false;
    let sName = '';

    if (dStrLowCheck.includes('pre-monsoon') || dStrLowCheck.includes('pre monsoon') || dStrLowCheck.includes('premonsoon')) {
        sName = 'Pre-Monsoon';
        isExplicitSeason = true;
    } else if (dStrLowCheck.includes('post-monsoon') || dStrLowCheck.includes('post monsoon') || dStrLowCheck.includes('postmonsoon')) {
        sName = 'Post-Monsoon';
        isExplicitSeason = true;
    } else if (dStrLowCheck.includes('monsoon')) {
        sName = 'Monsoon';
        isExplicitSeason = true;
    }

    if (typeof dateValue === 'number') {
        if (dateValue > 10000) { 
            let d = new Date(Math.round((dateValue - 25569) * 86400 * 1000)); 
            yearInt = d.getFullYear(); 
            parsedMonth = d.getMonth() + 1; 
        } else { 
            yearInt = dateValue; 
            parsedMonth = NaN;
        }
    } else {
        let dStr = String(dateValue).trim(); 
        let dStrLow = dStr.toLowerCase();
        
        // Month name matching
        if (dStrLow.includes('jan')) parsedMonth = 1;
        else if (dStrLow.includes('feb')) parsedMonth = 2;
        else if (dStrLow.includes('mar')) parsedMonth = 3;
        else if (dStrLow.includes('apr')) parsedMonth = 4;
        else if (dStrLow.includes('may')) parsedMonth = 5;
        else if (dStrLow.includes('jun')) parsedMonth = 6;
        else if (dStrLow.includes('jul')) parsedMonth = 7;
        else if (dStrLow.includes('aug')) parsedMonth = 8;
        else if (dStrLow.includes('sep')) parsedMonth = 9;
        else if (dStrLow.includes('oct')) parsedMonth = 10;
        else if (dStrLow.includes('nov')) parsedMonth = 11;
        else if (dStrLow.includes('dec')) parsedMonth = 12;

        // Try to match a four-digit year (19xx or 20xx)
        let yearMatch = dStr.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) { 
            yearInt = parseInt(yearMatch[0], 10); 
        }

        // Split-based processing for standard date delimiters (/, —, .)
        let parts = dStr.split(/[\/\-\.\s]+/);
        if (parts.length >= 2) {
            let intParts = parts.map(p => parseInt(p, 10)).filter(p => !isNaN(p));
            let yearIdx = intParts.findIndex(p => p >= 1900 && p <= 2100);
            
            if (yearIdx !== -1) {
                yearInt = intParts[yearIdx];
                let remaining = intParts.filter((_, idx) => idx !== yearIdx);
                
                if (remaining.length === 1) {
                    let val = remaining[0];
                    if (val >= 1 && val <= 12 && isNaN(parsedMonth)) {
                        parsedMonth = val;
                    }
                } else if (remaining.length >= 2) {
                    let p0 = remaining[0];
                    let p1 = remaining[1];
                    
                    if (yearIdx === 0) {
                        // YYYY-MM-DD
                        if (p0 >= 1 && p0 <= 12 && isNaN(parsedMonth)) {
                            parsedMonth = p0;
                        }
                    } else {
                        // DD-MM-YYYY
                        if (p0 > 12 && p1 <= 12) {
                            if (isNaN(parsedMonth)) parsedMonth = p1;
                        } else if (p1 > 12 && p0 <= 12) {
                            if (isNaN(parsedMonth)) parsedMonth = p0;
                        } else {
                            // Standard DD-MM-YYYY: second part is month
                            if (p1 >= 1 && p1 <= 12 && isNaN(parsedMonth)) {
                                parsedMonth = p1;
                            } else if (p0 >= 1 && p0 <= 12 && isNaN(parsedMonth)) {
                                parsedMonth = p0;
                            }
                        }
                    }
                }
            } else {
                // Check if YY-based (e.g. DD-MM-YY)
                if (intParts.length >= 3) {
                    let p0 = intParts[0];
                    let p1 = intParts[1];
                    let p2 = intParts[2];
                    if (p2 < 100) {
                        yearInt = p2 < 50 ? 2000 + p2 : 1900 + p2;
                    }
                    if (p0 > 12 && p1 <= 12) {
                        if (isNaN(parsedMonth)) parsedMonth = p1;
                    } else if (p1 > 12 && p0 <= 12) {
                        if (isNaN(parsedMonth)) parsedMonth = p0;
                    } else {
                        // Default to DD-MM-YY
                        if (p1 >= 1 && p1 <= 12 && isNaN(parsedMonth)) {
                            parsedMonth = p1;
                        } else if (p0 >= 1 && p0 <= 12 && isNaN(parsedMonth)) {
                            parsedMonth = p0;
                        }
                    }
                }
            }
        }

        // Fallback for short years if not resolved yet
        if (isNaN(yearInt)) {
            let shortYearMatch = dStr.match(/[\/\-](\d{2})$/); 
            if (shortYearMatch) { 
                let y = parseInt(shortYearMatch[1], 10); 
                yearInt = y < 50 ? 2000 + y : 1900 + y; 
            } else { 
                let num = dStr.replace(/\D/g, ''); 
                if (num.length >= 4) yearInt = parseInt(num.slice(-4), 10); 
            }
        }
    }

    if (isNaN(yearInt)) return;

    if (!isExplicitSeason) {
        // Fallback or default month to January (1) if still NaN
        if (isNaN(parsedMonth)) {
            parsedMonth = 1;
        }
        
        if (parsedMonth === 1 || parsedMonth === 2) {
            sName = 'January';
        } else if (parsedMonth >= 3 && parsedMonth <= 6) {
            sName = 'Pre-Monsoon';
        } else if (parsedMonth >= 7 && parsedMonth <= 9) {
            sName = 'August';
        } else if (parsedMonth >= 10 && parsedMonth <= 12) {
            sName = 'Post-Monsoon';
        } else {
            sName = 'Unknown';
        }
    }
    
    window.stateSet.add(state);
    if (!window.districtByState[state]) window.districtByState[state] = new Set(); 
    window.districtByState[state].add(district);
    if (!window.blockByDistrict[district]) window.blockByDistrict[district] = new Set(); 
    window.blockByDistrict[district].add(block);
    window.availableYears.add(yearInt); 
    if (sName !== 'Unknown') window.availableSeasons.add(sName);
    if(yearInt > window.latestGlobalYear) window.latestGlobalYear = yearInt;

    if (window.globalRawWellDictionary[wellKey] === undefined) {
        window.globalRawWellDictionary[wellKey] = { 
            well, state, district, block, 
            lat: isNaN(latVal) ? null : latVal, 
            lon: isNaN(lonVal) ? null : lonVal, 
            latRaw: latRaw, lonRaw: lonRaw, 
            loc: colMap.loc ? row[colMap.loc] : '', 
            source: colMap.source ? row[colMap.source] : '', 
            aquifer: colMap.aquifer ? row[colMap.aquifer] : '', 
            records: [] 
        };
    }
    window.globalRawWellDictionary[wellKey].records.push({ year: yearInt, season: sName, wl: wlNum });
};

window.processCSVStream = function(file, colMap) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: function(h) { return h.replace(/^\uFEFF/, '').trim(); },
        chunkSize: 1024 * 1024 * 5, // 5MB chunks
        chunk: function(results, parser) {
            parser.pause();
            const data = results.data;
            let i = 0;
            function processSubChunk() {
                const SUB_CHUNK_SIZE = 2000;
                const end = Math.min(i + SUB_CHUNK_SIZE, data.length);
                for (; i < end; i++) { window.processSingleRowData(data[i], colMap); }
                const loaderText = document.getElementById('loaderText');
                if (loaderText) loaderText.innerText = `Processed ${window.globalValidationStats.totalRows.toLocaleString()} rows...`;
                if (i < data.length) { setTimeout(processSubChunk, 0); } 
                else { parser.resume(); }
            }
            processSubChunk();
        },
        complete: function() { window.finalizeDataProcessing(); },
        error: function(err) { window.hideLoader(); window.showToast("Error during streaming: " + err.message, "error"); }
    });
};

window.processDataArray = function(data, colMap) {
    const len = data.length;
    const CHUNK_SIZE = 50000; let currentIndex = 0;
    function processChunk() {
        const endIndex = Math.min(currentIndex + CHUNK_SIZE, len); 
        for (let i = currentIndex; i < endIndex; i++) window.processSingleRowData(data[i], colMap); 
        currentIndex = endIndex;
        if (currentIndex < len) { 
            const loaderText = document.getElementById('loaderText'); 
            if (loaderText) loaderText.innerText = `Processed ${currentIndex.toLocaleString()} of ${len.toLocaleString()} rows...`; 
            setTimeout(processChunk, 0); 
        } else {
            window.finalizeDataProcessing();
        }
    } 
    setTimeout(processChunk, 0);
};

window.finalizeDataProcessing = function() {
    window.populateFilterDropdowns(); window.populateYearAndSeasonDropdowns();
    const statusBtn = document.getElementById('dataStatusBtn');
    if (statusBtn) { 
        statusBtn.classList.remove('status-empty'); 
        statusBtn.classList.add('status-loaded'); 
        statusBtn.innerText = `Loaded ${window.globalValidationStats.totalRows.toLocaleString()} Rows`; 
    }
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) fileInput.value = '';
    window.applyFiltersAsync();
};

window.populateYearAndSeasonDropdowns = function() {
    const yearsArr = Array.from(window.availableYears).sort((a,b) => b - a);
    const seasonsArr = Array.from(window.availableSeasons).sort();
    
    const dropdowns = {
        year: ['flucYear', 'distYear', 'valYear', 'mapYear', 'chartYear', 'chartBaseYear', 'chartCurrentYear', 'sfYearA', 'sfYearB', 'summaryDecYear', 'summarySeaYearA', 'summarySeaYearB', 'mapDecYear', 'mapYearA', 'mapYearB'],
        season: ['flucSeason', 'distSeason', 'valSeason', 'mapSeason', 'chartSeason', 'chartBaseSeason', 'chartCurrentSeason', 'sfSeasonA', 'sfSeasonB', 'summaryDecSeason', 'summarySeaSeasonA', 'summarySeaSeasonB', 'mapDecSeason', 'mapSeasonA', 'mapSeasonB']
    };

    dropdowns.year.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<option value="">Year</option>';
            yearsArr.forEach(y => el.add(new Option(y, y)));
            // Intelligently pre-populate target periods to prevent empty tables on load
            if (id.includes('BaseYear') && yearsArr.length > 1) el.value = yearsArr[yearsArr.length - 1];
            if ((id === 'sfYearA' || id === 'summarySeaYearA' || id === 'mapYearA') && yearsArr.length > 1) el.value = yearsArr[yearsArr.length - 1];
            if (id === 'sfYearB' || id === 'summarySeaYearB' || id === 'flucYear' || id === 'distYear' || id === 'mapYear' || id === 'mapDecYear' || id === 'chartYear' || id === 'valYear' || id === 'summaryDecYear' || id === 'mapYearB') {
                el.value = yearsArr[0] || '';
            }
        }
    });

    dropdowns.season.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<option value="">Season</option>';
            seasonsArr.forEach(s => el.add(new Option(s, s)));
            // Select "Pre-Monsoon" or first season by default
            const preMonsoonIdx = seasonsArr.findIndex(s => s.toLowerCase().includes('pre'));
            if (preMonsoonIdx !== -1) el.value = seasonsArr[preMonsoonIdx];
            else if (seasonsArr.length > 0) el.value = seasonsArr[0];
        }
    });
};

window.populateFilterDropdowns = function() {
    const stateSel = document.getElementById('filterState'); if(!stateSel) return;
    stateSel.innerHTML = '<option value="ALL">All States</option>'; 
    Array.from(window.stateSet).sort().forEach(s => stateSel.add(new Option(s, s))); 
    window.onStateFilterChange(true);
};

window.onStateFilterChange = function(skipApply = false) {
    const stateSelEl = document.getElementById('filterState'); 
    const distSelEl = document.getElementById('filterDistrict'); 
    if (!stateSelEl || !distSelEl) return;
    const stateSel = stateSelEl.value; 
    distSelEl.innerHTML = '<option value="ALL">All Districts</option>'; 
    let districtsToLoad = [];
    if (stateSel === 'ALL') { 
        Object.values(window.districtByState).forEach(set => set.forEach(d => districtsToLoad.push(d))); 
    } else if (window.districtByState[stateSel]) { 
        districtsToLoad = Array.from(window.districtByState[stateSel]); 
    }
    [...new Set(districtsToLoad)].sort().forEach(d => distSelEl.add(new Option(d, d))); 
    window.onDistrictFilterChange(skipApply);
};

window.onDistrictFilterChange = function(skipApply = false) {
    const distSelEl = document.getElementById('filterDistrict'); 
    const blockSelEl = document.getElementById('filterBlock'); 
    if (!distSelEl || !blockSelEl) return;
    const distSel = distSelEl.value; 
    blockSelEl.innerHTML = '<option value="ALL">All Blocks</option>'; 
    let blocksToLoad = [];
    if (distSel === 'ALL') { 
        const currentDistricts = Array.from(distSelEl.options).map(o => o.value).filter(v => v !== 'ALL'); 
        currentDistricts.forEach(d => { if (window.blockByDistrict[d]) window.blockByDistrict[d].forEach(b => blocksToLoad.push(b)); }); 
    } else if (window.blockByDistrict[distSel]) { 
        blocksToLoad = Array.from(window.blockByDistrict[distSel]); 
    }
    [...new Set(blocksToLoad)].sort().forEach(b => blockSelEl.add(new Option(b, b))); 
    if (!skipApply) window.applyFiltersAsync();
};

window.applyFilters = function() { window.applyFiltersAsync(); };

window.applyFiltersAsync = function() {
    window.showLoader("Aggregating Filtered Data...");
    setTimeout(() => {
        const selState = document.getElementById('filterState')?.value || 'ALL';
        const selDist = document.getElementById('filterDistrict')?.value || 'ALL';
        const selBlock = document.getElementById('filterBlock')?.value || 'ALL';
        const selAquifer = document.getElementById('filterAquifer')?.value || 'ALL';

        window.globalFilteredDictionary = {};
        const keys = Object.keys(window.globalRawWellDictionary);
        const len = keys.length;
        let i = 0;
        const CHUNK_SIZE = 50000;

        function processFilterChunk() {
            const end = Math.min(i + CHUNK_SIZE, len);
            for (; i < end; i++) {
                let key = keys[i];
                let well = window.globalRawWellDictionary[key];
                if (selState !== 'ALL' && well.state !== selState) continue;
                if (selDist !== 'ALL' && well.district !== selDist) continue;
                if (selBlock !== 'ALL' && well.block !== selBlock) continue;

                if (selAquifer !== 'ALL') {
                    let aq = String(well.aquifer || '').toLowerCase();
                    if (selAquifer === 'UNCONFINED' && !aq.includes('unconfined')) continue;
                    else if (selAquifer === 'CONFINED' && aq.includes('unconfined')) continue;
                }
                window.globalFilteredDictionary[key] = well;
            }

            if (i < len) { 
                setTimeout(processFilterChunk, 0); 
            } else {
                const yearSpanWarning = document.getElementById('elevenYearWarning');
                if (yearSpanWarning) { 
                    yearSpanWarning.classList.toggle('hidden', !(window.availableYears.size > 0 && window.availableYears.size < 11)); 
                }
                Object.keys(window.tabDataDirty).forEach(k => window.tabDataDirty[k] = true);
                if (typeof window.updateMethodologyExample === 'function') window.updateMethodologyExample();
                if (typeof window.updateShapefileMask === 'function') window.updateShapefileMask();
                
                window.renderActiveTab();
            }
        }
        processFilterChunk();
    }, 50);
};

window.updateMethodologyExample = function() {
    const keys = Object.keys(window.globalFilteredDictionary); if (keys.length < 2) return;
    const well1 = window.globalFilteredDictionary[keys[0]]; const well2 = window.globalFilteredDictionary[keys[1]];
    const elL1Id = document.getElementById('ex-loc1-id'); const elL1Coord = document.getElementById('ex-loc1-coord'); const elL1Recs = document.getElementById('ex-loc1-recs'); const elL1Name1 = document.getElementById('ex-loc1-name1'); const elL1Name2 = document.getElementById('ex-loc1-name2'); const elL1Name3 = document.getElementById('ex-loc1-name3');
    const elL2Id = document.getElementById('ex-loc2-id'); const elL2Coord = document.getElementById('ex-loc2-coord'); const elL2Recs = document.getElementById('ex-loc2-recs'); const elL2Name1 = document.getElementById('ex-loc2-name1'); const elL2Name2 = document.getElementById('ex-loc2-name2'); const elL2Name3 = document.getElementById('ex-loc2-name3');

    if(elL1Id) elL1Id.innerText = well1.well; if(elL1Coord) elL1Coord.innerText = `[Lat: ${well1.lat ? well1.lat.toFixed(4) : 'N/A'}, Lon: ${well1.lon ? well1.lon.toFixed(4) : 'N/A'}]`; if(elL1Recs) elL1Recs.innerText = well1.records.length; if(elL1Name1) elL1Name1.innerText = well1.well; if(elL1Name2) elL1Name2.innerText = well1.well; if(elL1Name3) elL1Name3.innerText = well1.well;
    if(elL2Id) elL2Id.innerText = well2.well; if(elL2Coord) elL2Coord.innerText = `[Lat: ${well2.lat ? well2.lat.toFixed(4) : 'N/A'}, Lon: ${well2.lon ? well2.lon.toFixed(4) : 'N/A'}]`; if(elL2Recs) elL2Recs.innerText = well2.records.length; if(elL2Name1) elL2Name1.innerText = well2.well; if(elL2Name2) elL2Name2.innerText = well2.well; if(elL2Name3) elL2Name3.innerText = well2.well;
};

// Switch navigation drawers seamlessly
window.markTabDirtyAndRender = function(tabName) {
    if (window.tabDataDirty) {
        window.tabDataDirty[tabName] = true;
    }
    if (window.currentActiveTab === tabName) {
        window.renderActiveTab();
    }
};

window.switchTab = function(tabName) {
    window.currentActiveTab = tabName;

    const tabs = ['table', 'seasonal', 'distribution', 'availability', 'validation', 'map', 'charts', 'summary', 'methodology'];
    tabs.forEach(t => {
        const content = document.getElementById(`tabContent-${t}`);
        if (content) {
            content.style.display = (t === tabName) ? (t === 'map' ? 'flex' : 'block') : 'none';
        }
    });

    document.querySelectorAll('.tab-btn-3d').forEach(btn => {
        btn.classList.remove('active'); btn.classList.add('inactive');
    });
    const activeBtn = document.getElementById(`tabBtn-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.add('active'); activeBtn.classList.remove('inactive');
    }
    
    if (window.tabDataDirty[tabName]) {
        window.renderActiveTab();
    } else {
        if (['table', 'seasonal', 'distribution', 'availability', 'validation'].includes(tabName)) setTimeout(window.updateStickyHeaders, 50);
        if (tabName === 'charts' && window.myChartInstance) window.myChartInstance.reflow();
        if (tabName === 'map') {
            if (!window.mapInstance) window.initMap();
            setTimeout(() => { if (window.mapInstance) window.mapInstance.invalidateSize(); }, 200);
        }
    }
};

window.renderActiveTab = function() {
    window.showLoader("Rendering Data Grid...");
    setTimeout(() => {
        try {
            if (window.currentActiveTab === 'table' && window.tabDataDirty.table) { window.calculateAndRenderTable(); window.tabDataDirty.table = false; }
            else if (window.currentActiveTab === 'seasonal' && window.tabDataDirty.seasonal) { window.calculateAndRenderSeasonalTable(); window.tabDataDirty.seasonal = false; }
            else if (window.currentActiveTab === 'distribution' && window.tabDataDirty.distribution) { window.calculateAndRenderDistributionTable(); window.tabDataDirty.distribution = false; }
            else if (window.currentActiveTab === 'availability' && window.tabDataDirty.availability) { window.calculateAndRenderAvailabilityTable(); window.tabDataDirty.availability = false; }
            else if (window.currentActiveTab === 'validation' && window.tabDataDirty.validation) { window.calculateAndRenderValidationTable(); window.tabDataDirty.validation = false; }
            else if (window.currentActiveTab === 'map' && window.tabDataDirty.map) {
                if (!window.mapInstance) window.initMap();
                if (window.mapInstance) window.mapInstance.invalidateSize();
                window.updateMapMarkers();
                window.updateMapTitle();
                if (typeof window.generateSmoothIDW === 'function' && window.idwLayerGroup) {
                    window.generateSmoothIDW();
                }
                window.tabDataDirty.map = false;
            }
            else if (window.currentActiveTab === 'charts' && window.tabDataDirty.charts) { window.renderChart(); window.tabDataDirty.charts = false; }
            else if (window.currentActiveTab === 'summary' && window.tabDataDirty.summary) { window.calculateAndRenderSummary(); window.tabDataDirty.summary = false; }
            
            if (['table', 'seasonal', 'distribution', 'availability', 'validation'].includes(window.currentActiveTab)) {
                setTimeout(window.updateStickyHeaders, 100);
            }
            window.hideLoader();
        } catch(err) {
            console.error('Error rendering tab:', window.currentActiveTab, err);
            window.hideLoader();
        }
    }, 50);
};

// Dynamic Header Fixed Layout System
window.updateStickyHeaders = function() {
    const containers = document.querySelectorAll('.table-container');
    containers.forEach(container => {
        if (container.parentElement && container.parentElement.style.display === 'none') return;
        const theads = container.querySelectorAll('thead');
        theads.forEach(thead => {
            const rows = thead.querySelectorAll('tr');
            let currentTop = 0;
            const rowHeights = Array.from(rows).map(row => row.getBoundingClientRect().height || 30);
            for (let i = 0; i < rows.length; i++) {
                let cells = rows[i].querySelectorAll('th');
                for (let j = 0; j < cells.length; j++) {
                    cells[j].style.position = 'sticky'; 
                    cells[j].style.top = currentTop + 'px'; 
                    cells[j].style.zIndex = (100 - i).toString(); 
                }
                currentTop += rowHeights[i];
            }
        });
    });
};

window.calculateAndRenderTable = function() {
    const tBody = document.getElementById('tableBody'); const tFooter = document.getElementById('tableFooter'); if(!tBody || !tFooter) return;
    const f1 = parseFloat(document.getElementById('flucR1')?.value) || 2; const f2 = parseFloat(document.getElementById('flucR2')?.value) || 4;
    document.querySelectorAll('.dyn-r1').forEach(el => el.innerText = f1); document.querySelectorAll('.dyn-r2').forEach(el => el.innerText = f2);

    if(Object.keys(window.globalFilteredDictionary).length === 0) { 
        tBody.innerHTML = '<tr><td colspan="26" class="py-16 text-center dt-muted font-bold text-base">No data available. Please upload a dataset.</td></tr>'; 
        tFooter.innerHTML = ''; 
        return; 
    }
    
    const selSeason = document.getElementById('flucSeason')?.value || ''; const selYearStr = document.getElementById('flucYear')?.value || '';
    const customTitle = document.getElementById('flucTitleInput')?.value || 'Decadal Water Level Fluctuation';
    
    if (!selSeason || !selYearStr) return; const targetYear = parseInt(selYearStr);
    let mode = document.getElementById('flucAggregation')?.value || 'state';

    let extraCols = mode === 'dist' ? 1 : (mode === 'block' ? 2 : 0);
    const thState = document.getElementById('th-state'); const thDist = document.getElementById('th-dist'); const thGroup = document.getElementById('th-group-name');

    if (mode === 'state') {
        if(thState) thState.style.display = 'none'; if(thDist) thDist.style.display = 'none';
        if(thGroup) thGroup.innerText = 'State/UT Name';
    } else if (mode === 'dist') {
        if(thState) thState.style.display = 'table-cell'; if(thDist) thDist.style.display = 'none';
        if(thGroup) thGroup.innerText = 'District Name';
    } else {
        if(thState) thState.style.display = 'table-cell'; if(thDist) thDist.style.display = 'table-cell';
        if(thGroup) thGroup.innerText = 'Block/Taluk Name';
    }

    const mainRow = document.getElementById('main-title-row');
    if(mainRow) { mainRow.colSpan = 26 + extraCols; mainRow.innerText = `${customTitle} (${selSeason} ${targetYear} vs Mean of ${targetYear-10} to ${targetYear-1})`; }

    const groupStats = {}; const wellsArray = Object.values(window.globalFilteredDictionary);
    for(let i=0; i<wellsArray.length; i++) {
        let well = wellsArray[i]; 
        let groupKey = mode === 'state' ? well.state : (mode === 'dist' ? well.state + '::' + well.district : well.state + '::' + well.district + '::' + well.block);
        
        if (!groupStats[groupKey]) { 
            groupStats[groupKey] = { meta: { state: well.state, dist: well.district, block: well.block }, total_wells: 0, wells_ge_5: 0, wells_lt_5: 0, wells_ge_5_latest: 0, wells: 0, rise_min: Infinity, rise_max: -Infinity, fall_min: Infinity, fall_max: -Infinity, r_range1: 0, r_range2: 0, r_gtRange2: 0, f_range1: 0, f_range2: 0, f_gtRange2: 0, total_rise: 0, total_fall: 0, total_no_change: 0 }; 
        }
        const s = groupStats[groupKey];
        let relevantRecords = well.records.filter(r => r.season === selSeason); if(relevantRecords.length === 0) continue;
        s.total_wells++; let latestVal = undefined; let prevSum = 0; let prevCount = 0;
        for(let j=0; j<relevantRecords.length; j++) { let r = relevantRecords[j]; if (r.year === targetYear) { latestVal = r.wl; } else if (r.year >= targetYear - 10 && r.year <= targetYear - 1) { prevSum += r.wl; prevCount++; } }
        if (prevCount >= 5) { s.wells_ge_5++; if (latestVal !== undefined) s.wells_ge_5_latest++; } else { s.wells_lt_5++; }
        if (latestVal === undefined || prevCount < 5) continue;
        s.wells++; const avgPrev = prevSum / prevCount; const fluctuation = avgPrev - latestVal;
        
        if (fluctuation > 0) { s.total_rise++; if (fluctuation < s.rise_min) s.rise_min = fluctuation; if (fluctuation > s.rise_max) s.rise_max = fluctuation; if (fluctuation <= f1) s.r_range1++; else if (fluctuation <= f2) s.r_range2++; else s.r_gtRange2++; } 
        else if (fluctuation < 0) { s.total_fall++; let absFall = Math.abs(fluctuation); if (absFall < s.fall_min) s.fall_min = absFall; if (absFall > s.fall_max) s.fall_max = absFall; if (absFall <= f1) s.f_range1++; else if (absFall <= f2) s.f_range2++; else s.f_gtRange2++; } 
        else { s.total_no_change++; }
    }

    const safeFormat = (val) => (val === Infinity || val === -Infinity) ? '-' : val.toFixed(2);
    const getPct = (part, total) => total === 0 ? '0.00' : ((part / total) * 100).toFixed(2);
    let totals = { total_wells: 0, wells_ge_5: 0, wells_lt_5: 0, wells_ge_5_latest: 0, wells: 0, r_r1: 0, r_r2: 0, r_gt: 0, f_r1: 0, f_r2: 0, f_gt: 0, t_rise: 0, t_fall: 0, t_no: 0, r_min: Infinity, r_max: -Infinity, f_min: Infinity, f_max: -Infinity };
    window.globalOutputData = []; let htmlStr = ''; let srIndex = 1; const sortedKeys = Object.keys(groupStats).sort();
    
    for(let i=0; i<sortedKeys.length; i++) {
        let groupKey = sortedKeys[i]; let s = groupStats[groupKey]; if (s.total_wells === 0) continue;
        totals.total_wells += s.total_wells; totals.wells_ge_5 += s.wells_ge_5; totals.wells_lt_5 += s.wells_lt_5; totals.wells_ge_5_latest += s.wells_ge_5_latest; totals.wells += s.wells;
        totals.r_r1 += s.r_range1; totals.r_r2 += s.r_range2; totals.r_gt += s.r_gtRange2; totals.f_r1 += s.f_range1; totals.f_r2 += s.f_range2; totals.f_gt += s.f_gtRange2; totals.t_rise += s.total_rise; totals.t_fall += s.total_fall; totals.t_no += s.total_no_change;
        if (s.rise_min !== Infinity && s.rise_min < totals.r_min) totals.r_min = s.rise_min; if (s.rise_max !== -Infinity && s.rise_max > totals.r_max) totals.r_max = s.rise_max;
        if (s.fall_min !== Infinity && s.fall_min < totals.f_min) totals.f_min = s.fall_min; if (s.fall_max !== -Infinity && s.fall_max > totals.f_max) totals.f_max = s.fall_max;

        let dynamicTds = ''; if (mode === 'dist') dynamicTds = `<td>${s.meta.state}</td>`; else if (mode === 'block') dynamicTds = `<td>${s.meta.state}</td><td>${s.meta.dist}</td>`;
        let displayGroupKey = mode === 'state' ? s.meta.state : (mode === 'dist' ? s.meta.dist : s.meta.block);

        const rObj = { sr: srIndex++, groupKey: displayGroupKey, total_wells: s.total_wells, wells_ge_5: s.wells_ge_5, wells_lt_5: s.wells_lt_5, wells_ge_5_latest: s.wells_ge_5_latest, wells: s.wells, r_min: safeFormat(s.rise_min), r_max: safeFormat(s.rise_max), f_min: safeFormat(s.fall_min), f_max: safeFormat(s.fall_max), r1: s.r_range1, r1_p: getPct(s.r_range1, s.wells), r2: s.r_range2, r2_p: getPct(s.r_range2, s.wells), rgt: s.r_gtRange2, rgt_p: getPct(s.r_gtRange2, s.wells), f1: s.f_range1, f1_p: getPct(s.f_range1, s.wells), f2: s.f_range2, f2_p: getPct(s.f_range2, s.wells), fgt: s.f_gtRange2, fgt_p: getPct(s.f_gtRange2, s.wells), t_rise: s.total_rise, t_fall: s.total_fall, t_no: s.total_no_change };

        htmlStr += `<tr><td>${rObj.sr}</td>${dynamicTds}<td class="text-left font-bold group-key-cell">${rObj.groupKey}</td><td>${rObj.total_wells}</td><td class="dt-rise">${rObj.wells_ge_5}</td><td class="theme-warn font-bold">${rObj.wells_lt_5}</td><td class="dt-highlight">${rObj.wells_ge_5_latest}</td><td class="dt-highlight font-bold">${rObj.wells}</td><td class="dt-rise font-normal">${rObj.r_min}</td><td class="dt-rise font-normal">${rObj.r_max}</td><td class="dt-fall font-normal">${rObj.f_min}</td><td class="dt-fall font-normal">${rObj.f_max}</td><td>${rObj.r1}</td><td class="dt-rise">${rObj.r1_p}</td><td>${rObj.r2}</td><td class="dt-rise">${rObj.r2_p}</td><td>${rObj.rgt}</td><td class="dt-rise">${rObj.rgt_p}</td><td>${rObj.f1}</td><td class="dt-fall">${rObj.f1_p}</td><td>${rObj.f2}</td><td class="dt-fall">${rObj.f2_p}</td><td>${rObj.fgt}</td><td class="dt-fall">${rObj.fgt_p}</td><td class="dt-rise text-[13px]">${rObj.t_rise}</td><td class="dt-fall text-[13px]">${rObj.t_fall}</td><td class="dt-muted font-bold">${rObj.t_no}</td></tr>`;
        
        let rowData = {"Sr No": rObj.sr}; 
        if (extraCols >= 1) rowData["State Name"] = s.meta.state; 
        if (extraCols === 2) rowData["District Name"] = s.meta.dist;
        rowData[thGroup ? thGroup.innerText : 'Group'] = rObj.groupKey;

        Object.assign(rowData, { "Total Wells Available": rObj.total_wells, "Wells with >= 5 Data": rObj.wells_ge_5, "Wells with < 5 Data": rObj.wells_lt_5, "Wells with Target Year Data": rObj.wells_ge_5_latest, "No Analysed": rObj.wells, "Rise Min": rObj.r_min, "Rise Max": rObj.r_max, "Fall Min": rObj.f_min, "Fall Max": rObj.f_max, [`Rise 0-${f1}`]: rObj.r1, [`Rise 0-${f1} %`]: parseFloat(rObj.r1_p), [`Rise ${f1}-${f2}`]: rObj.r2, [`Rise ${f1}-${f2} %`]: parseFloat(rObj.r2_p), [`Rise >${f2}`]: rObj.rgt, [`Rise >${f2} %`]: parseFloat(rObj.rgt_p), [`Fall 0-${f1}`]: rObj.f1, [`Fall 0-${f1} %`]: parseFloat(rObj.f1_p), [`Fall ${f1}-${f2}`]: rObj.f2, [`Fall ${f1}-${f2} %`]: parseFloat(rObj.f2_p), [`Fall >${f2}`]: rObj.fgt, [`Fall >${f2} %`]: parseFloat(rObj.fgt_p), "Total Rise": rObj.t_rise, "Total Fall": rObj.t_fall, "No Change": rObj.t_no });
        window.globalOutputData.push(rowData);
    }

    if (htmlStr === '') { 
        tBody.innerHTML = `<tr><td colspan="26" class="py-16 text-center text-amber-600 font-bold text-base bg-amber-50">⚠️ No wells matched the strict Decadal Criteria. Select a different base year or season.</td></tr>`; 
        tFooter.innerHTML = ''; 
    } else {
        tBody.innerHTML = htmlStr;
        tFooter.innerHTML = `<tr><td colspan="${2 + extraCols}" class="px-4 py-4 text-right dt-highlight uppercase tracking-wider font-bold">Grand Total</td><td class="dt-key">${totals.total_wells}</td><td class="dt-rise text-[13px]">${totals.wells_ge_5}</td><td class="theme-warn font-bold">${totals.wells_lt_5}</td><td class="dt-highlight text-[13px]">${totals.wells_ge_5_latest}</td><td class="dt-highlight text-[13px]">${totals.wells}</td><td class="dt-rise font-normal">${safeFormat(totals.r_min)}</td><td class="dt-rise font-normal">${safeFormat(totals.r_max)}</td><td class="dt-fall font-normal">${safeFormat(totals.f_min)}</td><td class="dt-fall font-normal">${safeFormat(totals.f_max)}</td><td>${totals.r_r1}</td><td class="dt-rise">${getPct(totals.r_r1, totals.wells)}</td><td>${totals.r_r2}</td><td class="dt-rise">${getPct(totals.r_r2, totals.wells)}</td><td>${totals.r_gt}</td><td class="dt-rise">${getPct(totals.r_gt, totals.wells)}</td><td>${totals.f_r1}</td><td class="dt-fall">${getPct(totals.f_r1, totals.wells)}</td><td>${totals.f_r2}</td><td class="dt-fall">${getPct(totals.f_r2, totals.wells)}</td><td>${totals.f_gt}</td><td class="dt-fall">${getPct(totals.f_gt, totals.wells)}</td><td class="dt-rise text-sm">${totals.t_rise}</td><td class="dt-fall text-sm">${totals.t_fall}</td><td class="dt-muted text-sm">${totals.t_no}</td></tr>`;
        
        let footerData = {"Sr No": ""}; 
        if (extraCols >= 1) footerData["State Name"] = ""; 
        if (extraCols === 2) footerData["District Name"] = ""; 
        footerData[thGroup ? thGroup.innerText : 'Group'] = "TOTAL";

        Object.assign(footerData, { "Total Wells Available": totals.total_wells, "Wells with >= 5 Data": totals.wells_ge_5, "Wells with < 5 Data": totals.wells_lt_5, "Wells with Target Year Data": totals.wells_ge_5_latest, "No Analysed": totals.wells, "Rise Min": safeFormat(totals.r_min), "Rise Max": safeFormat(totals.r_max), "Fall Min": safeFormat(totals.f_min), "Fall Max": safeFormat(totals.f_max), [`Rise 0-${f1}`]: totals.r_r1, [`Rise 0-${f1} %`]: parseFloat(getPct(totals.r_r1, totals.wells)), [`Rise ${f1}-${f2}`]: totals.r_r2, [`Rise ${f1}-${f2} %`]: parseFloat(getPct(totals.r_r2, totals.wells)), [`Rise >${f2}`]: totals.r_gt, [`Rise >${f2} %`]: parseFloat(getPct(totals.r_gt, totals.wells)), [`Fall 0-${f1}`]: totals.f_r1, [`Fall 0-${f1} %`]: parseFloat(getPct(totals.f_r1, totals.wells)), [`Fall ${f1}-${f2}`]: totals.f_r2, [`Fall ${f1}-${f2} %`]: parseFloat(getPct(totals.f_r2, totals.wells)), [`Fall >${f2}`]: totals.f_gt, [`Fall >${f2} %`]: parseFloat(getPct(totals.f_gt, totals.wells)), "Total Rise": totals.t_rise, "Total Fall": totals.t_fall, "No Change": totals.t_no });
        window.globalOutputData.push(footerData);
    }
    const dBtn = document.getElementById('downloadBtn'); const cBtn = document.getElementById('btnExportCSV');
    if (dBtn) dBtn.style.display = htmlStr !== '' ? 'inline-flex' : 'none'; 
    if (cBtn) cBtn.style.display = htmlStr !== '' ? 'inline-flex' : 'none'; 
};
