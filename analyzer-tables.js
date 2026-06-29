// --- Groundwater Data Engine: Additional Tables & Statistical Summaries ---

window.calculateAndRenderSeasonalTable = function() {
    const tBody = document.getElementById('sfTableBody');
    const tFooter = document.getElementById('sfTableFooter');
    const exportBtn = document.getElementById('btnExportSeasonal');
    const exportCSVBtn = document.getElementById('btnExportSeasonalCSV');
    if (!tBody || !tFooter) return;

    const f1 = parseFloat(document.getElementById('sfR1')?.value) || 2;
    const f2 = parseFloat(document.getElementById('sfR2')?.value) || 4;

    document.querySelectorAll('.sf-dyn-r1').forEach(el => el.innerText = f1);
    document.querySelectorAll('.sf-dyn-r2').forEach(el => el.innerText = f2);

    if (Object.keys(window.globalFilteredDictionary).length === 0) {
        tBody.innerHTML = '<tr><td colspan="26" class="py-16 text-center dt-muted font-bold text-base">No data available. Please upload a dataset.</td></tr>';
        tFooter.innerHTML = '';
        if (exportBtn) exportBtn.style.display = 'none';
        if (exportCSVBtn) exportCSVBtn.style.display = 'none';
        return;
    }

    const yearA = document.getElementById('sfYearA')?.value || '';
    const seasonA = document.getElementById('sfSeasonA')?.value || '';
    const yearB = document.getElementById('sfYearB')?.value || '';
    const seasonB = document.getElementById('sfSeasonB')?.value || '';
    const customTitle = document.getElementById('sfTitleInput')?.value || 'Seasonal Water Level Fluctuation Analysis';

    if (!yearA || !seasonA || !yearB || !seasonB) {
        tBody.innerHTML = '<tr><td colspan="26" class="py-16 text-center text-amber-600 font-bold text-base bg-amber-50">⚠️ Please select Year and Season for both Period A and Period B.</td></tr>';
        tFooter.innerHTML = '';
        if (exportBtn) exportBtn.style.display = 'none';
        if (exportCSVBtn) exportCSVBtn.style.display = 'none';
        return;
    }

    const yA = parseInt(yearA); const yB = parseInt(yearB);

    // Dynamic description on banner
    const infoText = document.getElementById('sfCompareInfoText');
    if (infoText) {
        const isSameSeason = (seasonA.toLowerCase() === seasonB.toLowerCase());
        const isSameYear = (yA === yB);
        let desc = '';
        if (isSameSeason && !isSameYear) desc = `📅 Same-season comparison: ${seasonA} ${yA} (Period A) vs ${seasonB} ${yB} (Period B). Rise = water table improved (level rose).`;
        else if (!isSameSeason && !isSameYear) desc = `🔀 Cross-season, cross-year: ${seasonA} ${yA} (Period A) vs ${seasonB} ${yB} (Period B). Captures seasonal + annual shifts.`;
        else if (!isSameSeason && isSameYear) desc = `🌦 Intra-year seasonal: ${seasonA} ${yA} (Period A) vs ${seasonB} ${yB} (Period B). Shows within-year seasonal recharge/depletion.`;
        else desc = `Same period selected for A and B — all wells will show No Change.`;
        infoText.innerText = desc;
    }

    const mode = document.getElementById('sfAggregation')?.value || 'state';
    const thState = document.getElementById('sf-th-state');
    const thDist = document.getElementById('sf-th-dist');
    const thGroup = document.getElementById('sf-th-group-name');
    const mainTitle = document.getElementById('sf-main-title-row');

    let extraCols = mode === 'dist' ? 1 : (mode === 'block' ? 2 : 0);
    if (mode === 'state') {
        if (thState) thState.style.display = 'none'; if (thDist) thDist.style.display = 'none';
        if (thGroup) thGroup.innerText = 'State/UT Name';
    } else if (mode === 'dist') {
        if (thState) thState.style.display = 'table-cell'; if (thDist) thDist.style.display = 'none';
        if (thGroup) thGroup.innerText = 'District Name';
    } else {
        if (thState) thState.style.display = 'table-cell'; if (thDist) thDist.style.display = 'table-cell';
        if (thGroup) thGroup.innerText = 'Block/Taluk Name';
    }

    const titleLabel = `${customTitle} (${seasonB} ${yB} vs ${seasonA} ${yA})`;
    if (mainTitle) { mainTitle.colSpan = 26 + extraCols; mainTitle.innerText = titleLabel; }

    const groupStats = {};
    const wellsArray = Object.values(window.globalFilteredDictionary);

    for (let i = 0; i < wellsArray.length; i++) {
        const well = wellsArray[i];
        const groupKey = mode === 'state' ? well.state
            : (mode === 'dist' ? well.state + '::' + well.district
            : well.state + '::' + well.district + '::' + well.block);

        if (!groupStats[groupKey]) {
            groupStats[groupKey] = {
                meta: { state: well.state, dist: well.district, block: well.block },
                total_wells: 0, wells: 0,
                rise_min: Infinity, rise_max: -Infinity,
                fall_min: Infinity, fall_max: -Infinity,
                r_range1: 0, r_range2: 0, r_gtRange2: 0,
                f_range1: 0, f_range2: 0, f_gtRange2: 0,
                total_rise: 0, total_fall: 0, total_no_change: 0
            };
        }

        const s = groupStats[groupKey];
        s.total_wells++;

        let wlA = undefined; let wlB = undefined;
        for (let j = 0; j < well.records.length; j++) {
            const r = well.records[j];
            if (r.year === yA && String(r.season).toLowerCase() === seasonA.toLowerCase()) wlA = r.wl;
            if (r.year === yB && String(r.season).toLowerCase() === seasonB.toLowerCase()) wlB = r.wl;
        }

        if (wlA === undefined || wlB === undefined || isNaN(wlA) || isNaN(wlB)) continue;

        s.wells++;
        const fluctuation = wlA - wlB;

        if (fluctuation > 0) {
            s.total_rise++;
            if (fluctuation < s.rise_min) s.rise_min = fluctuation;
            if (fluctuation > s.rise_max) s.rise_max = fluctuation;
            if (fluctuation <= f1) s.r_range1++;
            else if (fluctuation <= f2) s.r_range2++;
            else s.r_gtRange2++;
        } else if (fluctuation < 0) {
            s.total_fall++;
            const absFall = Math.abs(fluctuation);
            if (absFall < s.fall_min) s.fall_min = absFall;
            if (absFall > s.fall_max) s.fall_max = absFall;
            if (absFall <= f1) s.f_range1++;
            else if (absFall <= f2) s.f_range2++;
            else s.f_gtRange2++;
        } else {
            s.total_no_change++;
        }
    }

    const safeFormat = (val) => (val === Infinity || val === -Infinity) ? '-' : val.toFixed(2);
    const getPct = (part, total) => total === 0 ? '0.00' : ((part / total) * 100).toFixed(2);

    let totals = {
        total_wells: 0, wells: 0,
        r_r1: 0, r_r2: 0, r_gt: 0, f_r1: 0, f_r2: 0, f_gt: 0,
        t_rise: 0, t_fall: 0, t_no: 0,
        r_min: Infinity, r_max: -Infinity, f_min: Infinity, f_max: -Infinity
    };

    window.globalSeasonalOutputData = [];
    let htmlStr = '';
    let srIndex = 1;
    const sortedKeys = Object.keys(groupStats).sort();

    for (let i = 0; i < sortedKeys.length; i++) {
        const groupKey = sortedKeys[i];
        const s = groupStats[groupKey];
        if (s.total_wells === 0) continue;

        totals.total_wells += s.total_wells; totals.wells += s.wells;
        totals.r_r1 += s.r_range1; totals.r_r2 += s.r_range2; totals.r_gt += s.r_gtRange2;
        totals.f_r1 += s.f_range1; totals.f_r2 += s.f_range2; totals.f_gt += s.f_gtRange2;
        totals.t_rise += s.total_rise; totals.t_fall += s.total_fall; totals.t_no += s.total_no_change;
        if (s.rise_min !== Infinity && s.rise_min < totals.r_min) totals.r_min = s.rise_min;
        if (s.rise_max !== -Infinity && s.rise_max > totals.r_max) totals.r_max = s.rise_max;
        if (s.fall_min !== Infinity && s.fall_min < totals.f_min) totals.f_min = s.fall_min;
        if (s.fall_max !== -Infinity && s.fall_max > totals.f_max) totals.f_max = s.fall_max;

        let dynamicTds = '';
        if (mode === 'dist') dynamicTds = `<td>${s.meta.state}</td>`;
        else if (mode === 'block') dynamicTds = `<td>${s.meta.state}</td><td>${s.meta.dist}</td>`;
        const displayGroupKey = mode === 'state' ? s.meta.state : (mode === 'dist' ? s.meta.dist : s.meta.block);

        const r1p = getPct(s.r_range1, s.wells); const r2p = getPct(s.r_range2, s.wells); const rgtp = getPct(s.r_gtRange2, s.wells);
        const f1p = getPct(s.f_range1, s.wells); const f2p = getPct(s.f_range2, s.wells); const fgtp = getPct(s.f_gtRange2, s.wells);

        htmlStr += `<tr>
            <td>${srIndex}</td>${dynamicTds}
            <td class="text-left font-bold group-key-cell">${displayGroupKey}</td>
            <td>${s.total_wells}</td>
            <td class="dt-highlight font-bold">${s.wells}</td>
            <td class="dt-rise font-normal">${safeFormat(s.rise_min)}</td>
            <td class="dt-rise font-normal">${safeFormat(s.rise_max)}</td>
            <td class="dt-fall font-normal">${safeFormat(s.fall_min)}</td>
            <td class="dt-fall font-normal">${safeFormat(s.fall_max)}</td>
            <td>${s.r_range1}</td><td class="dt-rise">${r1p}</td>
            <td>${s.r_range2}</td><td class="dt-rise">${r2p}</td>
            <td>${s.r_gtRange2}</td><td class="dt-rise">${rgtp}</td>
            <td>${s.f_range1}</td><td class="dt-fall">${f1p}</td>
            <td>${s.f_range2}</td><td class="dt-fall">${f2p}</td>
            <td>${s.f_gtRange2}</td><td class="dt-fall">${fgtp}</td>
            <td class="dt-rise text-[13px]">${s.total_rise}</td>
            <td class="dt-fall text-[13px]">${s.total_fall}</td>
            <td class="dt-muted font-bold">${s.total_no_change}</td>
        </tr>`;

        let rowData = { "Sr No": srIndex++ };
        if (extraCols >= 1) rowData["State Name"] = s.meta.state;
        if (extraCols === 2) rowData["District Name"] = s.meta.dist;
        rowData[thGroup ? thGroup.innerText : 'Group'] = displayGroupKey;
        Object.assign(rowData, {
            "Total Wells": s.total_wells, "Wells Analysed": s.wells,
            "Rise Min (m)": safeFormat(s.rise_min), "Rise Max (m)": safeFormat(s.rise_max),
            "Fall Min (m)": safeFormat(s.fall_min), "Fall Max (m)": safeFormat(s.fall_max),
            [`Rise 0-${f1} (No.)`]: s.r_range1, [`Rise 0-${f1} (%)`]: parseFloat(r1p),
            [`Rise ${f1}-${f2} (No.)`]: s.r_range2, [`Rise ${f1}-${f2} (%)`]: parseFloat(r2p),
            [`Rise >${f2} (No.)`]: s.r_gtRange2, [`Rise >${f2} (%)`]: parseFloat(rgtp),
            [`Fall 0-${f1} (No.)`]: s.f_range1, [`Fall 0-${f1} (%)`]: parseFloat(f1p),
            [`Fall ${f1}-${f2} (No.)`]: s.f_range2, [`Fall ${f1}-${f2} (%)`]: parseFloat(f2p),
            [`Fall >${f2} (No.)`]: s.f_gtRange2, [`Fall >${f2} (%)`]: parseFloat(fgtp),
            "Total Rise": s.total_rise, "Total Fall": s.total_fall, "No Change": s.total_no_change
        });
        window.globalSeasonalOutputData.push(rowData);
    }

    if (htmlStr === '') {
        tBody.innerHTML = `<tr><td colspan="26" class="py-16 text-center text-amber-600 font-bold text-base bg-amber-50">⚠️ No wells found with data in both Period A (${seasonA} ${yA}) and Period B (${seasonB} ${yB}).</td></tr>`;
        tFooter.innerHTML = '';
        if (exportBtn) exportBtn.style.display = 'none';
        if (exportCSVBtn) exportCSVBtn.style.display = 'none';
    } else {
        tBody.innerHTML = htmlStr;

        const r1p_t = getPct(totals.r_r1, totals.wells); const r2p_t = getPct(totals.r_r2, totals.wells); const rgtp_t = getPct(totals.r_gt, totals.wells);
        const f1p_t = getPct(totals.f_r1, totals.wells); const f2p_t = getPct(totals.f_r2, totals.wells); const fgtp_t = getPct(totals.f_gt, totals.wells);

        tFooter.innerHTML = `<tr>
            <td colspan="${2 + extraCols}" class="px-4 py-4 text-right dt-highlight uppercase tracking-wider font-bold">Grand Total</td>
            <td>${totals.total_wells}</td>
            <td class="dt-highlight text-[13px]">${totals.wells}</td>
            <td class="dt-rise font-normal">${safeFormat(totals.r_min)}</td>
            <td class="dt-rise font-normal">${safeFormat(totals.r_max)}</td>
            <td class="dt-fall font-normal">${safeFormat(totals.f_min)}</td>
            <td class="dt-fall font-normal">${safeFormat(totals.f_max)}</td>
            <td>${totals.r_r1}</td><td class="dt-rise">${r1p_t}</td>
            <td>${totals.r_r2}</td><td class="dt-rise">${r2p_t}</td>
            <td>${totals.r_gt}</td><td class="dt-rise">${rgtp_t}</td>
            <td>${totals.f_r1}</td><td class="dt-fall">${f1p_t}</td>
            <td>${totals.f_r2}</td><td class="dt-fall">${f2p_t}</td>
            <td>${totals.f_gt}</td><td class="dt-fall">${fgtp_t}</td>
            <td class="dt-rise text-sm">${totals.t_rise}</td>
            <td class="dt-fall text-sm">${totals.t_fall}</td>
            <td class="dt-muted text-sm">${totals.t_no}</td>
        </tr>`;

        let footerData = { "Sr No": "" };
        if (extraCols >= 1) footerData["State Name"] = "";
        if (extraCols === 2) footerData["District Name"] = "";
        footerData[thGroup ? thGroup.innerText : 'Group'] = "TOTAL";
        Object.assign(footerData, {
            "Total Wells": totals.total_wells, "Wells Analysed": totals.wells,
            "Rise Minimum": safeFormat(totals.r_min), "Rise Maximum": safeFormat(totals.r_max),
            "Fall Minimum": safeFormat(totals.f_min), "Fall Maximum": safeFormat(totals.f_max),
            [`Rise 0-${f1} (No.)`]: totals.r_r1, [`Rise 0-${f1} (%)`]: parseFloat(r1p_t),
            [`Rise ${f1}-${f2} (No.)`]: totals.r_r2, [`Rise ${f1}-${f2} (%)`]: parseFloat(r2p_t),
            [`Rise >${f2} (No.)`]: totals.r_gt, [`Rise >${f2} (%)`]: parseFloat(rgtp_t),
            [`Fall 0-${f1} (No.)`]: totals.f_r1, [`Fall 0-${f1} (%)`]: parseFloat(f1p_t),
            [`Fall ${f1}-${f2} (No.)`]: totals.f_r2, [`Fall ${f1}-${f2} (%)`]: parseFloat(f2p_t),
            [`Fall >${f2} (No.)`]: totals.f_gt, [`Fall >${f2} (%)`]: parseFloat(fgtp_t),
            "Total Rise": totals.t_rise, "Total Fall": totals.t_fall, "No Change": totals.t_no
        });
        window.globalSeasonalOutputData.push(footerData);

        if (exportBtn) exportBtn.style.display = 'inline-flex';
        if (exportCSVBtn) exportCSVBtn.style.display = 'inline-flex';
    }
};

window.calculateAndRenderDistributionTable = function() {
    const tBody = document.getElementById('distributionTableBody'); const tFooter = document.getElementById('distributionTableFooter'); if (!tBody || !tFooter) return;

    const d1 = parseFloat(document.getElementById('distR1')?.value) || 2; const d2 = parseFloat(document.getElementById('distR2')?.value) || 5; const d3 = parseFloat(document.getElementById('distR3')?.value) || 10; const d4 = parseFloat(document.getElementById('distR4')?.value) || 20; const d5 = parseFloat(document.getElementById('distR5')?.value) || 40;
    document.querySelectorAll('.dist-r1').forEach(el => el.innerText = d1); document.querySelectorAll('.dist-r2').forEach(el => el.innerText = d2); document.querySelectorAll('.dist-r3').forEach(el => el.innerText = d3); document.querySelectorAll('.dist-r4').forEach(el => el.innerText = d4); document.querySelectorAll('.dist-r5').forEach(el => el.innerText = d5);

    if(Object.keys(window.globalFilteredDictionary).length === 0) { 
        tBody.innerHTML = '<tr><td colspan="17" class="py-16 text-center dt-muted font-bold text-base">No data available. Please upload a dataset.</td></tr>'; 
        tFooter.innerHTML = ''; 
        return; 
    }
    
    const selYear = document.getElementById('distYear')?.value || ''; const selSeason = document.getElementById('distSeason')?.value || '';
    const customTitle = document.getElementById('distTitleInput')?.value || 'Depth to Water Level Distribution';
    
    let mode = document.getElementById('distAggregation')?.value || 'state';

    let extraCols = mode === 'dist' ? 1 : (mode === 'block' ? 2 : 0);
    const thState = document.getElementById('dist-th-state'); const thDist = document.getElementById('dist-th-dist'); const thGroup = document.getElementById('dist-th-group-name'); const mainTitle = document.getElementById('dist-main-title-row');

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

    if(mainTitle) { mainTitle.colSpan = 17 + extraCols; mainTitle.innerText = `${customTitle} (${selSeason} ${selYear})`; }

    const groupStats = {}; const wellsArray = Object.values(window.globalFilteredDictionary);
    for(let i=0; i<wellsArray.length; i++) {
        let well = wellsArray[i]; 
        let groupKey = mode === 'state' ? well.state : (mode === 'dist' ? well.state + '::' + well.district : well.state + '::' + well.district + '::' + well.block);
        
        if (!groupStats[groupKey]) { groupStats[groupKey] = { meta: { state: well.state, dist: well.district, block: well.block }, wells: 0, min: Infinity, max: -Infinity, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 }; }
        
        const s = groupStats[groupKey]; let wlVal = undefined;
        for(let j=0; j<well.records.length; j++) { 
            if (String(well.records[j].year) === String(selYear) && String(well.records[j].season).toLowerCase() === String(selSeason).toLowerCase()) { 
                wlVal = well.records[j].wl; break; 
            } 
        }
        if (wlVal === undefined || isNaN(wlVal)) continue;

        s.textName = well.wellName || 'N/A';
        s.wells++; if(wlVal < s.min) s.min = wlVal; if(wlVal > s.max) s.max = wlVal;
        if (wlVal <= d1) s.b1++; else if (wlVal <= d2) s.b2++; else if (wlVal <= d3) s.b3++; else if (wlVal <= d4) s.b4++; else if (wlVal <= d5) s.b5++; else s.b6++;
    }

    const safeFormat = (val) => (val === Infinity || val === -Infinity) ? '-' : val.toFixed(2); const getPct = (part, total) => total === 0 ? '0.00' : ((part / total) * 100).toFixed(2);
    let totals = { wells: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, min: Infinity, max: -Infinity };
    window.globalDistributionOutputData = []; let htmlStr = ''; let srIndex = 1; const sortedKeys = Object.keys(groupStats).sort();
    
    for(let i=0; i<sortedKeys.length; i++) {
        let groupKey = sortedKeys[i]; let s = groupStats[groupKey]; if(s.wells === 0) continue; 
        totals.wells += s.wells; totals.b1 += s.b1; totals.b2 += s.b2; totals.b3 += s.b3; totals.b4 += s.b4; totals.b5 += s.b5; totals.b6 += s.b6;
        if (s.min !== Infinity && s.min < totals.min) totals.min = s.min; if (s.max !== -Infinity && s.max > totals.max) totals.max = s.max;

        let dynamicTds = ''; if (mode === 'dist') dynamicTds = `<td>${s.meta.state}</td>`; else if (mode === 'block') dynamicTds = `<td>${s.meta.state}</td><td>${s.meta.dist}</td>`;
        let displayGroupKey = mode === 'state' ? s.meta.state : (mode === 'dist' ? s.meta.dist : s.meta.block);

        htmlStr += `<tr><td>${srIndex}</td>${dynamicTds}<td class="text-left font-bold group-key-cell">${displayGroupKey}</td><td class="dt-highlight font-bold text-[13px]">${s.wells}</td><td class="dt-muted">${safeFormat(s.min)}</td><td class="dt-muted">${safeFormat(s.max)}</td><td>${s.b1}</td><td class="dt-highlight">${getPct(s.b1, s.wells)}</td><td>${s.b2}</td><td class="dt-highlight">${getPct(s.b2, s.wells)}</td><td>${s.b3}</td><td class="dt-highlight">${getPct(s.b3, s.wells)}</td><td>${s.b4}</td><td class="dt-highlight">${getPct(s.b4, s.wells)}</td><td>${s.b5}</td><td class="dt-highlight">${getPct(s.b5, s.wells)}</td><td>${s.b6}</td><td class="dt-highlight">${getPct(s.b6, s.wells)}</td></tr>`;
            
        const rObj = { sr: srIndex++, groupKey: displayGroupKey, wells: s.wells, min: safeFormat(s.min), max: safeFormat(s.max), b1: s.b1, p1: getPct(s.b1, s.wells), b2: s.b2, p2: getPct(s.b2, s.wells), b3: s.b3, p3: getPct(s.b3, s.wells), b4: s.b4, p4: getPct(s.b4, s.wells), b5: s.b5, p5: getPct(s.b5, s.wells), b6: s.b6, p6: getPct(s.b6, s.wells) };
        
        let rowData = {"Sr. No.": rObj.sr}; 
        if (extraCols >= 1) rowData["State Name"] = s.meta.state; 
        if (extraCols === 2) rowData["District Name"] = s.meta.dist;
        rowData[thGroup ? thGroup.innerText : 'Group'] = rObj.groupKey;

        Object.assign(rowData, { "No Analysed": rObj.wells, "DTWL Min": rObj.min, "DTWL Max": rObj.max, [`0 to ${d1} (No.)`]: rObj.b1, [`0 to ${d1} (%)`]: parseFloat(rObj.p1), [`>${d1} to ${d2} (No.)`]: rObj.b2, [`>${d1} to ${d2} (%)`]: parseFloat(rObj.p2), [`>${d2} to ${d3} (No.)`]: rObj.b3, [`>${d2} to ${d3} (%)`]: parseFloat(rObj.p3), [`>${d3} to ${d4} (No.)`]: rObj.b4, [`>${d3} to ${d4} (%)`]: parseFloat(rObj.p4), [`>${d4} to ${d5} (No.)`]: rObj.b5, [`>${d4} to ${d5} (%)`]: parseFloat(rObj.p5), [`> ${d5} (No.)`]: rObj.b6, [`> ${d5} (%)`]: parseFloat(rObj.p6) });
        window.globalDistributionOutputData.push(rowData);
    }

    if (htmlStr === '') { 
        tBody.innerHTML = `<tr><td colspan="17" class="py-16 text-center text-amber-600 font-bold text-base bg-amber-50">⚠️ No distribution data found for selected Year/Season.</td></tr>`; 
        tFooter.innerHTML = ''; 
    } else {
        tBody.innerHTML = htmlStr;
        tFooter.innerHTML = `<tr><td colspan="${2 + extraCols}" class="px-4 py-4 text-right uppercase tracking-wider font-bold">Grand Total</td><td class="dt-highlight font-bold text-sm">${totals.wells}</td><td class="dt-muted font-bold">${safeFormat(totals.min)}</td><td class="dt-muted font-bold">${safeFormat(totals.max)}</td><td>${totals.b1}</td><td class="dt-highlight">${getPct(totals.b1, totals.wells)}</td><td>${totals.b2}</td><td class="dt-highlight">${getPct(totals.b2, totals.wells)}</td><td>${totals.b3}</td><td class="dt-highlight">${getPct(totals.b3, totals.wells)}</td><td>${totals.b4}</td><td class="dt-highlight">${getPct(totals.b4, totals.wells)}</td><td>${totals.b5}</td><td class="dt-highlight">${getPct(totals.b5, totals.wells)}</td><td>${totals.b6}</td><td class="dt-highlight">${getPct(totals.b6, totals.wells)}</td></tr>`;
            
        let footerData = {"Sr. No.": ""}; 
        if (extraCols >= 1) footerData["State Name"] = ""; 
        if (extraCols === 2) footerData["District Name"] = ""; 
        footerData[thGroup ? thGroup.innerText : 'Group'] = "TOTAL";

        Object.assign(footerData, { "No Analysed": totals.wells, "DTWL Min": safeFormat(totals.min), "DTWL Max": safeFormat(totals.max), [`0 to ${d1} (No.)`]: totals.b1, [`0 to ${d1} (%)`]: parseFloat(getPct(totals.b1, totals.wells)), [`>${d1} to ${d2} (No.)`]: totals.b2, [`>${d1} to ${d2} (%)`]: parseFloat(getPct(totals.b2, totals.wells)), [`>${d2} to ${d3} (No.)`]: totals.b3, [`>${d2} to ${d3} (%)`]: parseFloat(getPct(totals.b3, totals.wells)), [`>${d3} to ${d4} (No.)`]: totals.b4, [`>${d3} to ${d4} (%)`]: parseFloat(getPct(totals.b4, totals.wells)), [`>${d4} to ${d5} (No.)`]: totals.b5, [`>${d4} to ${d5} (%)`]: parseFloat(getPct(totals.b5, totals.wells)), [`> ${d5} (No.)`]: totals.b6, [`> ${d5} (%)`]: parseFloat(getPct(totals.b6, totals.wells)) });
        window.globalDistributionOutputData.push(footerData);
    }
    
    const btnExportDist = document.getElementById('btnExportDist'); const btnExportDistCSV = document.getElementById('btnExportDistCSV');
    if (btnExportDist) btnExportDist.style.display = htmlStr !== '' ? 'inline-flex' : 'none'; 
    if (btnExportDistCSV) btnExportDistCSV.style.display = htmlStr !== '' ? 'inline-flex' : 'none';
};
