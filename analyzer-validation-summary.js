// --- Groundwater Data Engine: Data Validation Diagnostic Screen & Textual Auto-Summaries ---

window.calculateAndRenderAvailabilityTable = function() {
    const tBody = document.getElementById('availabilityTableBody'); const tHead = document.getElementById('availabilityTableHead'); const tFooter = document.getElementById('availabilityTableFooter'); const exportBtn = document.getElementById('btnExportAvailability'); const exportCSVBtn = document.getElementById('btnExportAvailCSV');
    if(!tBody || !tHead || !tFooter) return;

    if(Object.keys(window.globalFilteredDictionary).length === 0) {
         tBody.innerHTML = '<tr><td colspan="100%" class="py-16 text-center dt-muted font-bold text-base">No data available. Please upload a dataset to view availability data.</td></tr>'; tHead.innerHTML = ''; tFooter.innerHTML = '';
         if(exportBtn) exportBtn.style.display = 'none'; if(exportCSVBtn) exportCSVBtn.style.display = 'none'; return;
    }
    if(exportBtn) exportBtn.style.display = 'inline-flex'; if(exportCSVBtn) exportCSVBtn.style.display = 'inline-flex';
    
    const filterStateEl = document.getElementById('filterState'); const filterDistEl = document.getElementById('filterDistrict');
    const selState = filterStateEl ? filterStateEl.value : 'ALL'; const selDist = filterDistEl ? filterDistEl.value : 'ALL';
    
    let groupByField = 'state'; let colHeader = 'State/UT Name'; let extraCols = 0;
    if (selState !== 'ALL' && selDist === 'ALL') { groupByField = 'district'; colHeader = 'District Name'; extraCols = 1; } else if (selDist !== 'ALL') { groupByField = 'block'; colHeader = 'Block/Taluk Name'; extraCols = 2; } 

    let yearsArr = Array.from(window.availableYears).sort((a,b) => b - a); let seasonsArr = Array.from(window.availableSeasons).sort();
    
    let headHTML = `<tr><th rowspan="2" class="align-middle">Sr.<br>No.</th>`;
    if (extraCols >= 1) headHTML += `<th rowspan="2" class="align-middle min-w-[120px]">State Name</th>`; if (extraCols === 2) headHTML += `<th rowspan="2" class="align-middle min-w-[120px]">District Name</th>`;
    headHTML += `<th rowspan="2" class="align-middle text-left min-w-[150px]">${colHeader}</th>`;
    yearsArr.forEach(y => { headHTML += `<th colspan="${seasonsArr.length + 1}" class="dt-header-highlight border-l-2 border-l-blue-400">${y}</th>`; });
    headHTML += `<th rowspan="2" class="align-middle dt-header-rise border-l-2 border-l-emerald-500 min-w-[100px]">Grand<br>Total</th></tr><tr>`;
    yearsArr.forEach(y => { seasonsArr.forEach(s => { headHTML += `<th class="text-slate-500 text-[10px] bg-slate-50 border-l border-slate-200">${s}</th>`; }); headHTML += `<th class="dt-header-highlight text-[11px] font-black border-r border-slate-300">Total</th>`; });
    headHTML += `</tr>`; tHead.innerHTML = headHTML;

    const groupStats = {}; const wellsArray = Object.values(window.globalFilteredDictionary);
    for(let i=0; i<wellsArray.length; i++) {
        let well = wellsArray[i]; const groupKey = well[groupByField]; 
        if (!groupStats[groupKey]) { groupStats[groupKey] = { total: 0 }; yearsArr.forEach(y => { groupStats[groupKey][y] = { total: 0 }; seasonsArr.forEach(s => groupStats[groupKey][y][s] = 0); }); }
        well.records.forEach(r => { if (groupStats[groupKey][r.year] && groupStats[groupKey][r.year][r.season] !== undefined) { groupStats[groupKey][r.year][r.season]++; groupStats[groupKey][r.year].total++; groupStats[groupKey].total++; } });
    }

    window.globalAvailabilityOutputData = []; let htmlStr = ''; let srIndex = 1; const sortedKeys = Object.keys(groupStats).sort();
    let colTotals = { grand: 0 }; yearsArr.forEach(y => { colTotals[y] = { total: 0 }; seasonsArr.forEach(s => colTotals[y][s] = 0); });

    for(let i=0; i<sortedKeys.length; i++) {
        let groupKey = sortedKeys[i]; let s = groupStats[groupKey]; colTotals.grand += s.total;
        let rowData = { "Sr. No.": srIndex }; if (extraCols >= 1) rowData["State Name"] = selState; if (extraCols === 2) rowData["District Name"] = selDist;
        rowData[colHeader] = groupKey;
        let dynamicTds = ''; if (extraCols === 1) dynamicTds = `<td>${selState}</td>`; else if (extraCols === 2) dynamicTds = `<td>${selState}</td><td>${selDist}</td>`;

        htmlStr += `<tr><td>${srIndex++}</td>${dynamicTds}<td class="text-left font-bold group-key-cell">${groupKey}</td>`;
        yearsArr.forEach(y => {
            seasonsArr.forEach(season => { let val = s[y][season]; colTotals[y][season] += val; rowData[`${y} - ${season}`] = val; htmlStr += `<td class="border-l theme-border ${val > 0 ? 'theme-text font-semibold' : 'theme-text-muted font-normal'}">${val}</td>`; });
            colTotals[y].total += s[y].total; rowData[`${y} - Total`] = s[y].total; htmlStr += `<td class="dt-highlight font-bold border-r border-slate-300">${s[y].total}</td>`;
        });
        rowData["Grand Total"] = s.total; window.globalAvailabilityOutputData.push(rowData);
        htmlStr += `<td class="dt-rise font-black border-l-2 border-emerald-400 text-sm">${s.total}</td></tr>`;
    }

    tBody.innerHTML = htmlStr;
    let footerHTML = `<tr><td colspan="${2 + extraCols}" class="px-4 py-4 text-right uppercase tracking-wider font-bold bg-slate-100">Overall Totals</td>`;
    let footerData = { "Sr. No.": "" }; if (extraCols >= 1) footerData["State Name"] = ""; if (extraCols === 2) footerData["District Name"] = ""; footerData[colHeader] = "GRAND TOTAL";
    
    yearsArr.forEach(y => {
        seasonsArr.forEach(season => { footerHTML += `<td class="font-bold text-slate-600 bg-slate-50 border-l border-slate-200">${colTotals[y][season]}</td>`; footerData[`${y} - ${season}`] = colTotals[y][season]; });
        footerHTML += `<td class="dt-highlight font-black text-sm border-r border-slate-300">${colTotals[y].total}</td>`; footerData[`${y} - Total`] = colTotals[y].total;
    });
    footerHTML += `<td class="dt-rise font-black text-base border-l-2 border-emerald-500">${colTotals.grand}</td></tr>`; footerData["Grand Total"] = colTotals.grand; window.globalAvailabilityOutputData.push(footerData); 
    tFooter.innerHTML = footerHTML;
};

window.checkBlockStatus = function() {
    const selYearStr = document.getElementById('flucYear')?.value;
    const selSeason = document.getElementById('flucSeason')?.value;

    if (!selYearStr || !selSeason) {
        window.showToast("Please select a Year and Season in the 'Decadal Fluctuation' tab first.", "info");
        return;
    }

    const targetYear = parseInt(selYearStr);

    if (Object.keys(window.globalFilteredDictionary).length === 0) {
        window.showToast("No data is loaded or filtered.", "error");
        return;
    }

    const allBlocksInFilter = new Set();
    const blocksWithData = new Set();

    Object.values(window.globalFilteredDictionary).forEach(well => {
        if (well.block && well.block !== 'Unknown') {
            allBlocksInFilter.add(well.block);
            
            const hasData = well.records.some(r => r.year === targetYear && r.season === selSeason && r.wl !== undefined && !isNaN(r.wl));
            if (hasData) {
                blocksWithData.add(well.block);
            }
        }
    });

    const appliedList = document.getElementById('applied-blocks-list');
    const unappliedList = document.getElementById('unapplied-blocks-list');
    const resultsContainer = document.getElementById('block-status-results');

    if (!appliedList || !unappliedList || !resultsContainer) return;

    const appliedBlocks = Array.from(blocksWithData).sort();
    const unappliedBlocks = Array.from(allBlocksInFilter).filter(b => !blocksWithData.has(b)).sort();
    appliedList.innerHTML = appliedBlocks.length > 0 ? appliedBlocks.map(b => `<li class="text-sm text-slate-700 py-1">${b}</li>`).join('') : `<li class="text-sm text-slate-400 italic py-1">No blocks had data for the selected period.</li>`;
    unappliedList.innerHTML = unappliedBlocks.length > 0 ? unappliedBlocks.map(b => `<li class="text-sm text-slate-700 py-1">${b}</li>`).join('') : `<li class="text-sm text-slate-400 italic py-1">All blocks in the current filter have data.</li>`;

    resultsContainer.classList.remove('hidden');
};

window.calculateAndRenderValidationTable = function() {
    const vMissId = document.getElementById('val-missing-id'); const vMissLoc = document.getElementById('val-missing-loc'); const vMissWl = document.getElementById('val-missing-wl'); const vNegWl = document.getElementById('val-negative-wl');
    if(vMissId) vMissId.innerText = window.globalValidationStats.missingID.toLocaleString(); 
    if(vMissLoc) vMissLoc.innerText = window.globalValidationStats.missingLocation.toLocaleString(); 
    if(vMissWl) vMissWl.innerText = window.globalValidationStats.missingWL.toLocaleString(); 
    if(vNegWl) vNegWl.innerText = window.globalValidationStats.negativeWL.toLocaleString();

    const tBody = document.getElementById('validationTableBody'); const tHead = document.getElementById('validationTableHead');
    const exportBtn = document.getElementById('btnExportValidation'); const exportCSVBtn = document.getElementById('btnExportValCSV');

    const wellsArray = Object.values(window.globalFilteredDictionary);
    if(wellsArray.length === 0) {
         if(tBody) tBody.innerHTML = '<tr><td colspan="100%" class="py-16 text-center dt-muted font-bold text-base">No valid well data to visualize. Please upload a dataset.</td></tr>';
         if(tHead) tHead.innerHTML = ''; if(exportBtn) exportBtn.style.display = 'none'; if(exportCSVBtn) exportCSVBtn.style.display = 'none'; return;
    }
    if(exportBtn) exportBtn.style.display = 'inline-flex'; if(exportCSVBtn) exportCSVBtn.style.display = 'inline-flex';
    
    const valYearEl = document.getElementById('valYear'); const valSeasonEl = document.getElementById('valSeason');
    const selYearStr = valYearEl ? valYearEl.value : ''; const targetSeason = valSeasonEl ? valSeasonEl.value : ''; const targetYear = parseInt(selYearStr) || 0;
    
    let periodSet = new Set();
    for(let i = 0; i < wellsArray.length; i++) { 
        let recs = wellsArray[i].records; 
        for(let j=0; j<recs.length; j++) { periodSet.add(`${recs[j].year}::${recs[j].season}`); } 
    }
    let periods = Array.from(periodSet).map(p => { let parts = p.split('::'); return { year: parseInt(parts[0]), season: parts[1], key: p }; });
    const seasonOrder = { 'Winter': 1, 'Pre-Monsoon': 2, 'Monsoon': 3, 'Post-Monsoon': 4, 'Unknown': 5 };
    periods.sort((a, b) => { if (a.year !== b.year) return a.year - b.year; return (seasonOrder[a.season] || 5) - (seasonOrder[b.season] || 5); });

    let headHTML = `<tr><th class="align-middle min-w-[50px]">Sr.<br>No.</th><th class="align-middle text-left min-w-[120px]">Well ID</th><th class="align-middle text-left min-w-[100px]">State</th><th class="align-middle text-left min-w-[100px]">District</th><th class="align-middle text-left min-w-[100px]">Block</th><th class="align-middle text-left min-w-[100px]">Lat<br>(Northing)</th><th class="align-middle text-left min-w-[100px]">Lon<br>(Southing/Easting)</th><th class="align-middle text-left min-w-[100px]">Location</th><th class="align-middle text-left min-w-[100px]">Source</th><th class="align-middle text-left min-w-[100px]">Aquifer</th><th class="align-middle text-amber-500 min-w-[100px] border-l-2 border-r-2 border-amber-500">Valid Count (10 Yrs)<br><span class="text-[9px] uppercase tracking-wider text-amber-400">(${targetSeason})</span></th>`;
    periods.forEach(p => { let isTargetSeason = p.season === targetSeason; let inlineStyle = isTargetSeason ? 'border-bottom: 3px solid #f59e0b;' : ''; headHTML += `<th class="align-middle min-w-[80px]" style="${inlineStyle}">${p.year}<br><span class="text-[10px] font-semibold text-slate-400">${p.season}</span></th>`; });
    headHTML += `</tr>`; if(tHead) tHead.innerHTML = headHTML;

    window.globalValidationOutputData = []; let htmlStr = ''; const wLen = wellsArray.length;
    const MAX_DOM_ROWS = 1000;
    
    for(let i = 0; i < wLen; i++) {
        let well = wellsArray[i]; let sr = i + 1; let recMap = {}; let countLast10Years = 0;
        for(let j = 0; j < well.records.length; j++) { let r = well.records[j]; recMap[`${r.year}::${r.season}`] = r.wl; if (r.season === targetSeason && r.year >= targetYear - 10 && r.year <= targetYear - 1) countLast10Years++; }
        
        let rowData = { "Sr. No.": sr, "Well ID": well.well, "State": well.state, "District": well.district, "Block": well.block, "Latitude": well.latRaw || 'N/A', "Longitude": well.lonRaw || 'N/A', "Location": well.loc || 'N/A', "Source": well.source || 'N/A', "Aquifer": well.aquifer || 'N/A', [`Valid Count (${targetSeason} Last 10 Yrs)`]: countLast10Years };
        
        let countColorClass = countLast10Years >= 5 ? 'dt-rise' : (countLast10Years > 0 ? 'theme-warn font-bold' : 'dt-fall');
        let trHtml = '';
        
        if (i < MAX_DOM_ROWS) {
            trHtml += `<tr><td>${sr}</td><td class="text-left font-bold group-key-cell">${well.well}</td><td class="text-left">${well.state}</td><td class="text-left">${well.district}</td><td class="text-left">${well.block}</td><td class="text-left dt-muted">${well.latRaw || '-'}</td><td class="text-left dt-muted">${well.lonRaw || '-'}</td><td class="text-left dt-muted">${well.loc || '-'}</td><td class="text-left dt-muted">${well.source || '-'}</td><td class="text-left dt-muted">${well.aquifer || '-'}</td><td class="border-l border-r border-amber-500/50 ${countColorClass}">${countLast10Years}</td>`;
        }

        periods.forEach(p => {
            let val = recMap[p.key]; let valStr = val !== undefined ? val.toFixed(2) : '-';
            rowData[`${p.year} ${p.season}`] = val !== undefined ? val : null;
            if (i < MAX_DOM_ROWS) {
                let cellClass = val !== undefined ? "font-semibold" : "dt-muted"; let isTargetSeason = p.season === targetSeason; let bgClass = isTargetSeason && val !== undefined ? "dt-highlight" : ""; 
                trHtml += `<td class="${cellClass} ${bgClass}">${valStr}</td>`;
            }
        });
        
        if (i < MAX_DOM_ROWS) { trHtml += `</tr>`; htmlStr += trHtml; }
        if (i === MAX_DOM_ROWS) { htmlStr += `<tr><td colspan="100%" class="py-6 text-center dt-muted font-bold text-amber-600 bg-amber-50 shadow-inner">⚠️ View limited to top ${MAX_DOM_ROWS} records to preserve browser performance.<br>Please use 'Export CSV' to retrieve all validated rows.</td></tr>`; }
        
        window.globalValidationOutputData.push(rowData);
    }
    if(tBody) tBody.innerHTML = htmlStr; 
};

window.calculateAndRenderSummary = function() {
    const outArea = document.getElementById('summaryTextContent');
    if(!outArea) return;

    if(Object.keys(window.globalFilteredDictionary).length === 0) {
        outArea.innerHTML = '<p class="text-center text-slate-500 font-bold py-10">No data available. Please upload a dataset to generate a summary.</p>';
        return;
    }

    const summaryType = document.getElementById('summaryType')?.value || 'seasonal';
    const mode = document.getElementById('summaryAggregation')?.value || 'national';

    const filterStateEl = document.getElementById('filterState');
    const filterDistEl = document.getElementById('filterDistrict');
    const filterBlockEl = document.getElementById('filterBlock');
    const selState = filterStateEl ? filterStateEl.value : 'ALL';
    const selDist = filterDistEl ? filterDistEl.value : 'ALL';
    const selBlock = filterBlockEl ? filterBlockEl.value : 'ALL';
    
    let geoTitle = "National Overview";
    let geoSubtitle = "All India Groundwater Data";
    if (selBlock !== 'ALL') {
        geoTitle = `${selBlock} Block/Taluk`;
        geoSubtitle = `${selDist} District, ${selState}`;
    } else if (selDist !== 'ALL') {
        geoTitle = `${selDist} District`;
        geoSubtitle = `State of ${selState}`;
    } else if (selState !== 'ALL') {
        geoTitle = `State of ${selState}`;
        geoSubtitle = `State-Level Groundwater Analysis`;
    }

    const pamphletHeader = `
        <div class="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-[1.5rem] shadow-xl mb-6 text-center relative overflow-hidden border border-slate-700 no-export">
            <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 20px 20px;"></div>
            <div class="relative z-10 flex flex-col items-center">
                <span class="bg-blue-500/20 text-blue-200 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-blue-500/30 mb-3">
                    ${summaryType === 'decadal' ? 'Decadal Fluctuation Report' : 'Seasonal Fluctuation Report'}
                </span>
                <h1 class="text-2xl md:text-3xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-emerald-200 shadow-sm mb-1">
                    ${geoTitle}
                </h1>
                <h2 class="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">
                    ${geoSubtitle}
                </h2>
            </div>
        </div>
    `;

    if (summaryType === 'decadal') {
        const selSeason = document.getElementById('summaryDecSeason')?.value || '';
        const selYearStr = document.getElementById('summaryDecYear')?.value || '';

        if (!selSeason || !selYearStr) {
            outArea.innerHTML = pamphletHeader + '<p class="text-center text-amber-600 font-bold py-10 bg-amber-50 rounded">⚠️ Please select a Target Year and Season.</p>';
            return;
        }

        const targetYear = parseInt(selYearStr);
        const f1 = parseFloat(document.getElementById('flucR1')?.value) || 2;
        
        let totalWells = 0; let totalRise = 0; let totalFall = 0; let totalNoChange = 0;
        let maxRise = -Infinity; let maxRiseLoc = '';
        let maxFall = -Infinity; let maxFallLoc = '';
        const entityStats = {}; 

        let annualTotal = 0, annualRise = 0, annualFall = 0, annualNoChange = 0;
        let maxAnnualRise = -Infinity, maxAnnualRiseLoc = '';
        let maxAnnualFall = -Infinity, maxAnnualFallLoc = '';

        let currentYearWls = [];

        const wellsArray = Object.values(window.globalFilteredDictionary);
        wellsArray.forEach(well => {
            let relevantRecords = well.records.filter(r => String(r.season).toLowerCase() === String(selSeason).toLowerCase());
            if(relevantRecords.length === 0) return;

            let latestVal = undefined; 
            let lastYearVal = undefined;
            let prevSum = 0; let prevCount = 0;
            
            relevantRecords.forEach(r => {
                if (r.year === targetYear) { latestVal = r.wl; }
                else if (r.year === targetYear - 1) { lastYearVal = r.wl; }
                
                if (r.year >= targetYear - 10 && r.year <= targetYear - 1) { 
                    if(!isNaN(r.wl)) {
                        prevSum += r.wl; 
                        prevCount++; 
                    }
                }
            });

            if (latestVal !== undefined && !isNaN(latestVal)) {
                currentYearWls.push(latestVal);
            }

            if (latestVal !== undefined && lastYearVal !== undefined && !isNaN(latestVal) && !isNaN(lastYearVal)) {
                annualTotal++;
                const annualFluc = lastYearVal - latestVal;
                const locName = well.loc ? well.loc : well.well;
                const fullLoc = mode === 'state' ? `${locName}, ${well.district}` : locName;

                if (annualFluc > 0) { 
                    annualRise++; 
                    if (annualFluc > maxAnnualRise) { maxAnnualRise = annualFluc; maxAnnualRiseLoc = `${fullLoc}, ${well.state}`; } 
                } else if (annualFluc < 0) { 
                    annualFall++; 
                    if (Math.abs(annualFluc) > maxAnnualFall) { maxAnnualFall = Math.abs(annualFluc); maxAnnualFallLoc = `${fullLoc}, ${well.state}`; } 
                } else { 
                    annualNoChange++; 
                }
            }

            if (latestVal === undefined || isNaN(latestVal) || prevCount < 5) return; 

            const avgPrev = prevSum / prevCount;
            const fluctuation = avgPrev - latestVal; 

            let entityKey = 'Overall';
            if(mode === 'state') entityKey = well.state;
            else if (mode === 'dist') entityKey = `${well.district} (${well.state})`; 
            else if (mode === 'block') entityKey = `${well.block} (${well.district})`;
            else if (mode === 'location') entityKey = `${well.well} (${well.block || 'N/A'}, ${well.district || 'N/A'})`;

            if(!entityStats[entityKey]) entityStats[entityKey] = { total: 0, rise: 0, fall: 0, noChange: 0 };
            
            totalWells++;
            entityStats[entityKey].total++;

            const locName = well.loc ? well.loc : well.well;
            const fullLoc = mode === 'state' ? `${locName}, ${well.district}` : locName;

            if(fluctuation > 0) {
                totalRise++; entityStats[entityKey].rise++;
                if(fluctuation > maxRise) { maxRise = fluctuation; maxRiseLoc = `${fullLoc}, ${well.state}`; }
            } else if (fluctuation < 0) {
                totalFall++; entityStats[entityKey].fall++;
                let absFall = Math.abs(fluctuation);
                if(absFall > maxFall) { maxFall = absFall; maxFallLoc = `${fullLoc}, ${well.state}`; }
            } else {
                totalNoChange++; entityStats[entityKey].noChange++;
            }
        });

        if(totalWells === 0 && annualTotal === 0) {
            outArea.innerHTML = pamphletHeader + '<p class="text-center text-amber-600 font-bold py-10 bg-amber-50 rounded">⚠️ No wells met required criteria for Decadal or Annual mapping.</p>';
            return;
        }

        let summaryHtml = pamphletHeader;
        
        if (totalWells > 0) {
            const risePct = ((totalRise / totalWells) * 100).toFixed(1);
            const fallPct = ((totalFall / totalWells) * 100).toFixed(1);
            const noChangePct = ((totalNoChange / totalWells) * 100).toFixed(1);

            let highRise = []; let modRise = []; let lowRise = []; 
            Object.keys(entityStats).forEach(key => {
                const stats = entityStats[key];
                if(stats.total < 5 && mode !== 'national' && mode !== 'location') return; 
                const eRisePct = (stats.rise / stats.total) * 100;
                if(eRisePct > 80) highRise.push(`${key} (${eRisePct.toFixed(1)}%)`);
                else if (eRisePct >= 60) modRise.push(key);
                else if (eRisePct < 50 && (stats.fall / stats.total)*100 > 50) lowRise.push(`${key} (${((stats.fall / stats.total)*100).toFixed(1)}%)`);
            });

            summaryHtml += `<h2 class="text-2xl font-black mb-6 border-b pb-3 text-slate-800 flex items-center gap-2"><svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Decadal Water Level Fluctuation Summary <span class="text-sm font-bold text-slate-500 uppercase tracking-widest ml-2 bg-slate-100 px-2 py-1 rounded">(${selSeason} ${targetYear})</span></h2>`;
            summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">Analysis of decadal groundwater level fluctuations based on <strong>${totalWells.toLocaleString()}</strong> monitoring wells indicates an <strong>${totalRise > totalFall ? 'overall improving' : 'overall declining'}</strong> groundwater scenario.</p>`;
            summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">Out of the total wells analysed, groundwater level rise was observed in <strong>${totalRise.toLocaleString()}</strong> of wells (<strong>${risePct}%</strong>), whereas <strong>${totalFall.toLocaleString()}</strong> wells (<strong>${fallPct}%</strong>) recorded a decline. <strong>${totalNoChange}</strong> wells (<strong>${noChangePct}%</strong>) showed no significant change.</p>`;

            if(mode !== 'national' && mode !== 'location') {
                let entityLabel = mode === 'state' ? 'States/UTs' : (mode === 'dist' ? 'Districts' : 'Blocks/Taluks');
                if(highRise.length > 0) summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">${entityLabel} exhibiting a high proportion of wells with groundwater level rise (>80%) include <strong>${highRise.join(', ')}</strong>.</p>`;
                if(modRise.length > 0) summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">Moderate groundwater improvement (60–80% wells showing rise) was observed in <strong>${modRise.join(', ')}</strong>.</p>`;
                if(lowRise.length > 0) {
                    summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">Regions where a majority of wells recorded groundwater level decline, indicating a persistent falling trend, include: <strong>${lowRise.join(', ')}</strong>.</p>`;
                }
            }

            summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">`;
            if(maxRise !== -Infinity) summaryHtml += `The highest decadal rise was <strong>${maxRise.toFixed(2)} m</strong> in <em>${maxRiseLoc}</em>. `;
            if(maxFall !== -Infinity) summaryHtml += `The highest decadal decline was <strong>${maxFall.toFixed(2)} m</strong> in <em>${maxFallLoc}</em>.`;
            summaryHtml += `</p>`;
        }

        if (currentYearWls.length > 0) {
            const minWl = Math.min(...currentYearWls);
            const maxWl = Math.max(...currentYearWls);
            const avgWl = currentYearWls.reduce((a, b) => a + b, 0) / currentYearWls.length;
            
            const d1 = parseFloat(document.getElementById('distR1')?.value) || 2; const d2 = parseFloat(document.getElementById('distR2')?.value) || 5; const d3 = parseFloat(document.getElementById('distR3')?.value) || 10;
            let b1=0, b2=0, b3=0;
            currentYearWls.forEach(wl => { if(wl<=d1) b1++; else if(wl<=d2) b2++; else if(wl<=d3) b3++; });
            const tot = currentYearWls.length;
            const p1 = (b1/tot*100).toFixed(1); const p2 = (b2/tot*100).toFixed(1); const p3 = (b3/tot*100).toFixed(1);

            summaryHtml += `<h3 class="text-xl font-black mt-8 mb-4 border-b pb-2 text-slate-800">Current Year (${targetYear}) Water Level Summary</h3>`;
            summaryHtml += `<p class="mb-4 text-[15px] leading-[1.8] text-slate-700">For the <strong>${selSeason} ${targetYear}</strong> period, analysis of <strong>${tot}</strong> wells shows water levels ranging from <strong>${minWl.toFixed(2)} mbgl</strong> to <strong>${maxWl.toFixed(2)} mbgl</strong>, with an average depth of <strong>${avgWl.toFixed(2)} mbgl</strong>.</p>`;
            summaryHtml += `<p class="mb-4 text-[15px] leading-[1.8] text-slate-700">The depth distribution is as follows: <strong>${p1}%</strong> of wells are in the 0-${d1}m range, <strong>${p2}%</strong> are in the ${d1}-${d2}m range, and <strong>${p3}%</strong> are in the ${d2}-${d3}m range.</p>`;
        }

        if (annualTotal > 0) {
            const annualRisePct = (annualRise / annualTotal * 100).toFixed(1);
            const annualFallPct = (annualFall / annualTotal * 100).toFixed(1);

            summaryHtml += `<h3 class="text-xl font-black mt-8 mb-4 border-b pb-2 text-slate-800">Annual Comparison: ${targetYear} vs ${targetYear - 1}</h3>`;
            summaryHtml += `<p class="mb-4 text-[15px] leading-[1.8] text-slate-700">Comparing <strong>${selSeason} ${targetYear}</strong> with <strong>${selSeason} ${targetYear - 1}</strong>, out of <strong>${annualTotal}</strong> paired wells, <strong>${annualRise} (${annualRisePct}%)</strong> showed a rise in water levels, while <strong>${annualFall} (${annualFallPct}%)</strong> showed a decline. This suggests a short-term trend of <strong>${annualRise > annualFall ? 'recharge' : 'depletion'}</strong> compared to the previous year.</p>`;
            if (maxAnnualRise > -Infinity || maxAnnualFall > -Infinity) {
                summaryHtml += `<p class="mb-4 text-[15px] leading-[1.8] text-slate-700">`;
                if (maxAnnualRise > -Infinity) summaryHtml += `The maximum annual rise was <strong>${maxAnnualRise.toFixed(2)} m</strong> observed at <em>${maxAnnualRiseLoc}</em>. `;
                if (maxAnnualFall > -Infinity) summaryHtml += `The maximum annual fall was <strong>${maxAnnualFall.toFixed(2)} m</strong> at <em>${maxAnnualFallLoc}</em>.`;
                summaryHtml += `</p>`;
            }
        }

        outArea.innerHTML = summaryHtml;
    } 
    else {
        const seasonA = document.getElementById('summarySeaSeasonA')?.value || '';
        const yearA = document.getElementById('summarySeaYearA')?.value || '';
        const seasonB = document.getElementById('summarySeaSeasonB')?.value || '';
        const yearB = document.getElementById('summarySeaYearB')?.value || '';
        const f1 = parseFloat(document.getElementById('sfR1')?.value) || 2;
        const f2 = parseFloat(document.getElementById('sfR2')?.value) || 4;

        if (!seasonA || !yearA || !seasonB || !yearB) {
            outArea.innerHTML = pamphletHeader + '<p class="text-center text-amber-600 font-bold py-10 bg-amber-50 rounded">⚠️ Please select Period A and Period B.</p>';
            return;
        }

        let totalWellsOverall = Object.keys(window.globalFilteredDictionary).length;
        let validWells = 0; 
        let totalRise = 0, totalFall = 0, totalNoChange = 0;
        let r1 = 0, r2 = 0, rGt = 0;
        let f1_count = 0, f2_count = 0, fGt = 0;
        let maxRise = -Infinity, maxRiseLoc = '';
        let maxFall = -Infinity, maxFallLoc = '';

        const entityStats = {};
        const regionLabel = mode === 'national' ? 'India' : (mode === 'state' ? 'the selected states' : 'the analyzed region');
        const entityLabelName = mode === 'state' ? 'States' : (mode === 'dist' ? 'Districts' : 'Regions');

        Object.values(window.globalFilteredDictionary).forEach(well => {
            let wlA = undefined, wlB = undefined;
            well.records.forEach(r => {
                if (String(r.year) === String(yearA) && String(r.season).toLowerCase() === String(seasonA).toLowerCase()) wlA = r.wl;
                if (String(r.year) === String(yearB) && String(r.season).toLowerCase() === String(seasonB).toLowerCase()) wlB = r.wl;
            });

            if (wlA === undefined || wlB === undefined || isNaN(wlA) || isNaN(wlB)) return;

            validWells++;
            const fluctuation = wlA - wlB; 

            let entityKey = 'Overall';
            if(mode === 'state') entityKey = well.state;
            else if (mode === 'dist') entityKey = `${well.district} (${well.state})`;
            else if (mode === 'block') entityKey = `${well.block} (${well.district})`;

            if(!entityStats[entityKey]) entityStats[entityKey] = { total: 0, rise: 0, fall: 0, noChange: 0, riseGt4: 0, fallGt4: 0, maxR: -Infinity, maxF: -Infinity };
            const stats = entityStats[entityKey];
            stats.total++;

            const locName = well.loc ? well.loc : well.well;
            const fullLoc = mode === 'state' ? `${locName}, ${well.district}` : locName;

            if (fluctuation > 0) {
                totalRise++; stats.rise++;
                if (fluctuation <= f1) r1++;
                else if (fluctuation <= f2) r2++;
                else { rGt++; stats.riseGt4++; }

                if (fluctuation > maxRise) { maxRise = fluctuation; maxRiseLoc = `${fullLoc}, ${well.state}`; }
                if (fluctuation > stats.maxR) stats.maxR = fluctuation;

            } else if (fluctuation < 0) {
                totalFall++; stats.fall++;
                let absFall = Math.abs(fluctuation);
                if (absFall <= f1) f1_count++;
                else if (absFall <= f2) f2_count++;
                else { fGt++; stats.fallGt4++; }

                if (absFall > maxFall) { maxFall = absFall; maxFallLoc = `${fullLoc}, ${well.state}`; }
                if (absFall > stats.maxF) stats.maxF = absFall;

            } else {
                totalNoChange++; stats.noChange++;
            }
        });

        if (validWells === 0) {
            outArea.innerHTML = pamphletHeader + '<p class="text-center text-amber-600 font-bold py-10 bg-amber-50 rounded">⚠️ No wells had valid data in both Period A and Period B for selected parameters.</p>';
            return;
        }

        const risePct = ((totalRise / validWells) * 100).toFixed(2);
        const fallPct = ((totalFall / validWells) * 100).toFixed(2);
        const noChangePct = ((totalNoChange / validWells) * 100).toFixed(2);

        const rr1Pct = ((r1 / validWells) * 100).toFixed(2);
        const rr2Pct = ((r2 / validWells) * 100).toFixed(2);
        const rGtPct = ((rGt / validWells) * 100).toFixed(2);
        const fr1Pct = ((f1_count / validWells) * 100).toFixed(2);
        const fr2Pct = ((f2_count / validWells) * 100).toFixed(2);
        const fGtPct = ((fGt / validWells) * 100).toFixed(2);

        let highRiseEntities = [];
        let highFallEntities = [];
        let significantDeclineEntities = [];
        let largeFlucEntities = [];

        Object.keys(entityStats).forEach(key => {
            const s = entityStats[key];
            if (s.total < 5 && mode !== 'national') return;
            const eRisePct = (s.rise / s.total) * 100;
            const eFallPct = (s.fall / s.total) * 100;
            
            if (eRisePct >= 50) highRiseEntities.push(`${key} (${eRisePct.toFixed(1)}%)`);
            if (eFallPct >= 50) highFallEntities.push(`${key} (${eFallPct.toFixed(1)}%)`);
            if (s.fallGt4 > 0) significantDeclineEntities.push({key: key, count: s.fallGt4});
            if (s.maxR > 50 || s.maxF > 50) largeFlucEntities.push(key);
        });

        significantDeclineEntities.sort((a,b) => b.count - a.count);
        const sigDeclineNames = significantDeclineEntities.slice(0, 8).map(e => e.key);

        let summaryHtml = pamphletHeader;
        summaryHtml += `<h2 class="text-2xl font-black mb-6 border-b pb-3 text-slate-800 flex items-center gap-2"><svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Seasonal Water Level Fluctuation Analysis</h2>`;
        summaryHtml += `<h3 class="text-lg font-bold text-slate-600 mb-4 bg-slate-100 p-3 rounded">Comparison: ${seasonA} ${yearA} vs ${seasonB} ${yearB}</h3>`;
        
        summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">A total of <strong>${totalWellsOverall.toLocaleString()}</strong> monitoring wells were considered across ${regionLabel}, of which <strong>${validWells.toLocaleString()}</strong> wells had valid water-level data available for both <strong>${seasonA} ${yearA}</strong> and <strong>${seasonB} ${yearB}</strong> seasons and were used for fluctuation analysis.</p>`;

        summaryHtml += `<h4 class="text-md font-black text-slate-800 mt-6 mb-2">Overall Scenario</h4>`;
        summaryHtml += `<ul class="list-disc pl-6 mb-4 text-[15px] leading-[1.8] text-slate-700">`;
        summaryHtml += `<li><strong>${totalRise.toLocaleString()}</strong> wells (${risePct}%) recorded a rise in groundwater levels.</li>`;
        summaryHtml += `<li><strong>${totalFall.toLocaleString()}</strong> wells (${fallPct}%) recorded a fall in groundwater levels.</li>`;
        summaryHtml += `<li><strong>${totalNoChange.toLocaleString()}</strong> wells (${noChangePct}%) showed no change.</li>`;
        summaryHtml += `</ul>`;

        let predomStr = totalRise > totalFall ? 'rise' : 'decline';
        let predomStr2 = totalRise > totalFall ? 'rise' : 'fall';
        let maxPct = Math.max(totalRise, totalFall) / validWells * 100;
        summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">Thus, the overall groundwater scenario during ${seasonB} ${yearB} indicates a predominance of water-level ${predomStr}, with nearly all of the analyzed wells showing a ${predomStr2} compared to ${seasonA} ${yearA}.</p>`;

        summaryHtml += `<h4 class="text-md font-black text-slate-800 mt-6 mb-2">Magnitude of Water-Level Rise</h4>`;
        summaryHtml += `<p class="mb-2 text-[15px] text-slate-700">Among the wells showing a rise:</p>`;
        summaryHtml += `<ul class="list-disc pl-6 mb-4 text-[15px] leading-[1.8] text-slate-700">`;
        summaryHtml += `<li><strong>${r1.toLocaleString()}</strong> wells (${rr1Pct}%) recorded a rise of 0–${f1} m.</li>`;
        summaryHtml += `<li><strong>${r2.toLocaleString()}</strong> wells (${rr2Pct}%) recorded a rise of ${f1}–${f2} m.</li>`;
        summaryHtml += `<li><strong>${rGt.toLocaleString()}</strong> wells (${rGtPct}%) recorded a rise of more than ${f2} m.</li>`;
        summaryHtml += `</ul>`;
        if(maxRise !== -Infinity) summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">The maximum rise observed was <strong>${maxRise.toFixed(2)} m</strong> (at ${maxRiseLoc}).</p>`;

        summaryHtml += `<h4 class="text-md font-black text-slate-800 mt-6 mb-2">Magnitude of Water-Level Fall</h4>`;
        summaryHtml += `<p class="mb-2 text-[15px] text-slate-700">Among the wells showing a fall:</p>`;
        summaryHtml += `<ul class="list-disc pl-6 mb-4 text-[15px] leading-[1.8] text-slate-700">`;
        summaryHtml += `<li><strong>${f1_count.toLocaleString()}</strong> wells (${fr1Pct}%) recorded a fall of 0–${f1} m.</li>`;
        summaryHtml += `<li><strong>${f2_count.toLocaleString()}</strong> wells (${fr2Pct}%) recorded a fall of ${f1}–${f2} m.</li>`;
        summaryHtml += `<li><strong>${fGt.toLocaleString()}</strong> wells (${fGtPct}%) recorded a fall of more than ${f2} m.</li>`;
        summaryHtml += `</ul>`;
        if(maxFall !== -Infinity) summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">The maximum fall observed was <strong>${maxFall.toFixed(2)} m</strong> (at ${maxFallLoc}).</p>`;

        if(mode !== 'national') {
            summaryHtml += `<h4 class="text-md font-black text-slate-800 mt-6 mb-2">${entityLabelName}-wise Highlights</h4>`;
            if(highRiseEntities.length > 0) summaryHtml += `<p class="mb-3 text-[15px] leading-[1.8] text-slate-700">${entityLabelName} with a comparatively higher proportion of wells showing water-level rise include <strong>${highRiseEntities.slice(0,10).join(', ')}</strong>.</p>`;
            if(highFallEntities.length > 0) summaryHtml += `<p class="mb-3 text-[15px] leading-[1.8] text-slate-700">${entityLabelName} where water-level fall predominated include <strong>${highFallEntities.slice(0,10).join(', ')}</strong>.</p>`;
            if(sigDeclineNames.length > 0) summaryHtml += `<p class="mb-3 text-[15px] leading-[1.8] text-slate-700">Significant groundwater declines (>${f2} m) were observed in several regions, notably <strong>${sigDeclineNames.join(', ')}</strong>.</p>`;
            if(largeFlucEntities.length > 0) summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700">Very large localized fluctuations were observed in regions like <strong>${largeFlucEntities.slice(0,8).join(', ')}</strong>.</p>`;
        }

        summaryHtml += `<h4 class="text-md font-black text-slate-800 mt-6 mb-2">Conclusion</h4>`;
        summaryHtml += `<p class="mb-5 text-[15px] leading-[1.8] text-slate-700 text-justify">The comparison of ${seasonB} ${yearB} water levels with those of ${seasonA} ${yearA} reveals an overall ${predomStr === 'rise' ? 'improving' : 'declining'} trend in groundwater levels across the evaluated region, with ${Math.max(risePct, fallPct).toFixed(2)}% of analyzed wells recording a ${predomStr2}. Most fluctuations, both rise and fall, were within 0–${f1} m, indicating moderate seasonal variation at the majority of monitoring locations. However, the occurrence of substantial rises and falls (>${f2} m) in several areas highlights the influence of localized hydrogeological conditions, groundwater abstraction, recharge variability, and rainfall distribution during the period.</p>`;

        summaryHtml += `<div id="summary-chart-container" class="w-full h-[400px] mt-8 mb-6 bg-slate-50 border border-slate-200 rounded-xl shadow-inner p-2 no-export"></div>`;

        outArea.innerHTML = summaryHtml;

        let riseCol = document.getElementById('chartColorRise')?.value || '#10b981';
        let fallCol = document.getElementById('chartColorFall')?.value || '#ef4444';
        let pData = validWells > 0 ? [ (rGt/validWells)*100, (r2/validWells)*100, (r1/validWells)*100, (f1_count/validWells)*100, (f2_count/validWells)*100, (fGt/validWells)*100 ] : [0,0,0,0,0,0];
        let formattedData = pData.map((val, i) => ({ y: parseFloat(val.toFixed(2)), color: i < 3 ? riseCol : fallCol }));
        
        Highcharts.chart('summary-chart-container', {
            chart: { type: 'column', backgroundColor: 'transparent', style: { fontFamily: 'Segoe UI, Arial, sans-serif' }, options3d: { enabled: true, alpha: 15, beta: 15, depth: 50, viewDistance: 25 } },
            title: { text: `Water Level Fluctuation (${seasonB} ${yearB} vs ${seasonA} ${yearA})`, style: { fontSize: '15px', fontWeight: 'bold', color: '#1e293b' } },
            xAxis: { categories: [`Rise > ${f2}`, `Rise ${f1} to ${f2}`, `Rise 0 to ${f1}`, `Fall 0 to ${f1}`, `Fall ${f1} to ${f2}`, `Fall > ${f2}`], title: { text: 'Ranges (mbgl)' }, labels: { style: { fontSize: '11px', fontWeight: 'bold' } } },
            yAxis: { title: { text: '% of Wells' } },
            legend: { enabled: false },
            plotOptions: { column: { pointPadding: 0.2, borderWidth: 0, borderRadius: 2, dataLabels: { enabled: true, format: '{y}%', style: { fontSize: '10px', textOutline: 'none' } } } },
            series: [{ name: `Fluctuation`, data: formattedData }],
            exporting: { enabled: false },
            credits: { enabled: false }
        });
    }
};
