// --- Groundwater Data Engine: Highcharts Rendering & Customizations ---

window.myChartInstance = null;

window.onChartTypeChange = function() {
    const type = document.getElementById('chartTypeSelect').value;
    if (type === 'depth') {
        document.getElementById('singleYearFilterChart').style.display = 'flex';
        document.getElementById('comparisonYearFilterChart').style.display = 'none';
        document.getElementById('depthChartColors').style.display = 'flex';
        document.getElementById('flucChartColors').style.display = 'none';
    } else {
        document.getElementById('singleYearFilterChart').style.display = 'none';
        document.getElementById('comparisonYearFilterChart').style.display = 'flex';
        document.getElementById('depthChartColors').style.display = 'none';
        document.getElementById('flucChartColors').style.display = 'flex';
    }
    window.markTabDirtyAndRender('charts');
};

window.renderChart = function() {
    const container = document.getElementById('hc-container'); if(!container) return;
    const type = document.getElementById('chartTypeSelect').value;
    
    const filterStateEl = document.getElementById('filterState');
    const selState = filterStateEl ? filterStateEl.value : 'ALL';

    const getSettings = (prefix) => {
        const elF = document.getElementById(prefix + 'Font'); const elC = document.getElementById(prefix + 'Color');
        const elS = document.getElementById(prefix + 'Size'); const elB = document.getElementById(prefix + 'Bold');
        const elI = document.getElementById(prefix + 'Italic'); const elX = document.getElementById(prefix + 'X');
        const elY = document.getElementById(prefix + 'Y');
        let weight = (elB && elB.checked) ? 'bold' : 'normal'; let style = (elI && elI.checked) ? 'italic' : 'normal';
        return { 
            font: elF ? elF.value : 'Arial', 
            color: elC ? elC.value : '#333', 
            size: elS ? elS.value + 'px' : '14px', 
            weight: weight, 
            style: style, 
            x: elX ? parseInt(elX.value) : 0, 
            y: elY ? parseInt(elY.value) : 0 
        };
    };

    const titleConf = getSettings('title'); const xConf = getSettings('xAxis');
    const yConf = getSettings('yAxis'); const legConf = getSettings('legend');

    let is3D = document.getElementById('chart3DToggle') ? document.getElementById('chart3DToggle').checked : false;
    let titleText = document.getElementById('chartTitleInput') ? document.getElementById('chartTitleInput').value : '';
    let xAxisTitleText = document.getElementById('chartXAxisInput') ? document.getElementById('chartXAxisInput').value : '';
    let yAxisTitleText = document.getElementById('chartYAxisInput') ? document.getElementById('chartYAxisInput').value : '';

    let categories = []; let seriesConfig = [];
    let depthColors = [
        document.getElementById('cDepth1')?.value || '#2563eb', document.getElementById('cDepth2')?.value || '#06b6d4',
        document.getElementById('cDepth3')?.value || '#10b981', document.getElementById('cDepth4')?.value || '#f59e0b',
        document.getElementById('cDepth5')?.value || '#ea580c', document.getElementById('cDepth6')?.value || '#ef4444'
    ];

    if (type === 'depth') {
        const year = document.getElementById('chartYear').value; const season = document.getElementById('chartSeason').value;
        if (!year || !season) { container.innerHTML = '<p class="p-5 text-center text-slate-500 font-bold">Please select target Year and Season.</p>'; return; }
        
        const d1 = parseFloat(document.getElementById('distR1')?.value) || 2; const d2 = parseFloat(document.getElementById('distR2')?.value) || 5; const d3 = parseFloat(document.getElementById('distR3')?.value) || 10; const d4 = parseFloat(document.getElementById('distR4')?.value) || 20; const d5 = parseFloat(document.getElementById('distR5')?.value) || 40;
        categories = [`0 - ${d1}`, `> ${d1} - ${d2}`, `> ${d2} - ${d3}`, `> ${d3} - ${d4}`, `> ${d4} - ${d5}`, `> ${d5}`];
        
        let b1=0, b2=0, b3=0, b4=0, b5=0, b6=0, tot=0;
        Object.values(window.globalFilteredDictionary).forEach(w => {
            let r = w.records.find(rec => String(rec.year) === String(year) && String(rec.season).toLowerCase() === String(season).toLowerCase());
            if (r && !isNaN(r.wl)) {
                tot++; if(r.wl<=d1) b1++; else if(r.wl<=d2) b2++; else if(r.wl<=d3) b3++; else if(r.wl<=d4) b4++; else if(r.wl<=d5) b5++; else b6++;
            }
        });

        let pData = tot > 0 ? [ (b1/tot)*100, (b2/tot)*100, (b3/tot)*100, (b4/tot)*100, (b5/tot)*100, (b6/tot)*100 ] : [0,0,0,0,0,0];
        let formattedData = pData.map((val, i) => ({ y: parseFloat(val.toFixed(2)), color: depthColors[i] }));
        
        seriesConfig = [{ name: `${selState === 'ALL' ? 'All States' : selState} (${season} ${year})`, data: formattedData }];

    } else {
        const bYear = parseInt(document.getElementById('chartBaseYear').value); const bSeason = document.getElementById('chartBaseSeason').value;
        const cYear = parseInt(document.getElementById('chartCurrentYear').value); const cSeason = document.getElementById('chartCurrentSeason').value;
        if (!bYear || !bSeason || !cYear || !cSeason) { container.innerHTML = '<p class="p-5 text-center text-slate-500 font-bold">Please select comparison parameters.</p>'; return; }

        const f1 = parseFloat(document.getElementById('flucR1')?.value) || 2; const f2 = parseFloat(document.getElementById('flucR2')?.value) || 4;
        categories = [`Rise > ${f2}`, `Rise ${f1} to ${f2}`, `Rise 0 to ${f1}`, `Fall 0 to ${f1}`, `Fall ${f1} to ${f2}`, `Fall > ${f2}`];
        
        let rrGt=0, rr2=0, rr1=0, fr1=0, fr2=0, frGt=0, tot=0;
        Object.values(window.globalFilteredDictionary).forEach(w => {
            let rB = w.records.find(rec => rec.year === bYear && rec.season === bSeason);
            let rC = w.records.find(rec => rec.year === cYear && rec.season === cSeason);
            if(rB && rC && !isNaN(rB.wl) && !isNaN(rC.wl)) {
                tot++; let fluc = rB.wl - rC.wl;
                if(fluc > 0) { if(fluc <= f1) rr1++; else if(fluc <= f2) rr2++; else rrGt++; }
                else if(fluc < 0) { let abs = Math.abs(fluc); if(abs <= f1) fr1++; else if(abs <= f2) fr2++; else frGt++; }
            }
        });

        let riseCol = document.getElementById('chartColorRise')?.value || '#10b981';
        let fallCol = document.getElementById('chartColorFall')?.value || '#ef4444';
        
        let pData = tot > 0 ? [ (rrGt/tot)*100, (rr2/tot)*100, (rr1/tot)*100, (fr1/tot)*100, (fr2/tot)*100, (frGt/tot)*100 ] : [0,0,0,0,0,0];
        let formattedData = pData.map((val, i) => ({ y: parseFloat(val.toFixed(2)), color: i < 3 ? riseCol : fallCol }));
        
        seriesConfig = [{ name: `Fluctuation (${cSeason} ${cYear} vs ${bSeason} ${bYear})`, data: formattedData }];
    }

    let hcOptions = {
        chart: { type: 'column', backgroundColor: 'transparent', style: { fontFamily: 'Segoe UI, Arial, sans-serif' }, options3d: { enabled: is3D, alpha: 15, beta: 15, depth: 50, viewDistance: 25 } },
        title: { text: titleText, style: { color: titleConf.color, fontSize: titleConf.size, fontWeight: titleConf.weight, fontStyle: titleConf.style, fontFamily: titleConf.font }, x: titleConf.x, y: titleConf.y },
        xAxis: { categories: categories, title: { text: xAxisTitleText, style: { color: xConf.color, fontSize: xConf.size, fontWeight: xConf.weight, fontStyle: xConf.style, fontFamily: xConf.font }, x: xConf.x, y: xConf.y }, labels: { style: { fontSize: '12px', fontWeight: 'bold' } } },
        yAxis: { title: { text: yAxisTitleText, style: { color: yConf.color, fontSize: yConf.size, fontWeight: yConf.weight, fontStyle: yConf.style, fontFamily: yConf.font }, x: yConf.x, y: yConf.y } },
        legend: { 
            enabled: true, 
            align: legConf.x === 0 ? 'center' : undefined, 
            verticalAlign: document.getElementById('legendPos') ? document.getElementById('legendPos').value : 'bottom', 
            floating: document.getElementById('legendFloating') ? document.getElementById('legendFloating').checked : false, 
            x: legConf.x, 
            y: legConf.y, 
            itemStyle: { color: legConf.color, fontSize: legConf.size, fontWeight: legConf.weight, fontStyle: legConf.style, fontFamily: legConf.font } 
        },
        plotOptions: { column: { pointPadding: 0.2, borderWidth: 0, borderRadius: 2, dataLabels: { enabled: true, format: '{y}%', style: { fontSize: '10px' } } } },
        series: seriesConfig,
        exporting: { enabled: true, buttons: { contextButton: { menuItems: ['downloadPNG', 'downloadJPEG', 'downloadPDF', 'downloadSVG'] } } },
        credits: { enabled: false }
    };

    if (window.myChartInstance) window.myChartInstance.destroy();
    window.myChartInstance = Highcharts.chart('hc-container', hcOptions);

    let tableHTML = `<table class="glossy-chart-table"><thead><tr><th>${xAxisTitleText}</th>`; seriesConfig.forEach(s => tableHTML += `<th>${s.name}</th>`); tableHTML += `</tr></thead><tbody>`;
    if(categories.length > 0 && seriesConfig[0].data.length > 0) {
        for(let i=0; i<categories.length; i++) {
            let catColor = type === 'depth' ? depthColors[i] : '#1e3a8a';
            tableHTML += `<tr><td style="color: ${catColor}; font-weight: 900;">${categories[i]}</td>`;
            seriesConfig.forEach(s => { 
                let valObj = s.data[i];
                let val = typeof valObj === 'object' && valObj !== null ? valObj.y : valObj;
                tableHTML += `<td>${val !== undefined ? val : '-'}</td>`; 
            }); 
            tableHTML += `</tr>`;
        }
    } else { tableHTML += `<tr><td colspan="${1 + seriesConfig.length}" class="text-center text-slate-400 py-4">No data rendered.</td></tr>`; }
    tableHTML += `</tbody></table>`; 
    
    const tWrapper = document.getElementById('chartTableWrapper');
    const floatingContent = document.getElementById('floatingChartTableContent');
    if (tWrapper) tWrapper.innerHTML = tableHTML;
    if (floatingContent) floatingContent.innerHTML = tableHTML;
};
