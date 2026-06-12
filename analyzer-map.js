// --- Groundwater Data Engine: GIS Maps, Leaflet and IDW Overlay Engine ---

window.mapInstance = null;
window.mapMarkersLayer = null;
window.idwLayerGroup = null;
window.uploadedShapefileGeoJSON = null;
window.activeMaskGeoJSON = null; 
window.globalIdwMaskGeoJSON = null;
window.globalHatchGeoJSON = null;
window.shapefileLayer = null;

window.globalIdwDataUrl = null;
window.globalIdwBbox = null;
window.globalIdwDimensions = null;
window.mapAreaStats = null;

window.initMap = function() {
    if(window.mapInstance) return;
    const mapCont = document.getElementById('mapContainer');
    if(!mapCont) return;

    mapCont.innerHTML = ''; // Clear placeholder text

    window.mapInstance = L.map('mapContainer', { zoomSnap: 0.1, zoomDelta: 0.1, wheelPxPerZoomLevel: 120 }).setView([22.5937, 78.9629], 5); 
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: 'Map: &copy; OpenTopoMap' });
    const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'], attribution: 'Google Streets' });
    const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'], attribution: 'Google Hybrid' });
    
    L.control.scale({position: 'bottomleft', imperial: false, maxWidth: 300}).addTo(window.mapInstance);
    
    osm.addTo(window.mapInstance);
    const baseMaps = { "Google Streets": googleStreets, "Google Hybrid": googleHybrid, "Physical (Topo)": topo, "Standard (OSM)": osm };
    L.control.layers(baseMaps).addTo(window.mapInstance);
    
    const pane = window.mapInstance.getPane('tilePane');
    if (pane) pane.style.display = 'none'; // Default hidden mapping layers
    const baseMapToggle = document.getElementById('toggleBaseMapBtn');
    if(baseMapToggle) baseMapToggle.checked = false;

    window.updateLegend();
    window.updateMapElements();
    window.mapMarkersLayer = L.layerGroup().addTo(window.mapInstance);
    window.idwLayerGroup = L.layerGroup().addTo(window.mapInstance);
};

window.getMapMode = function() {
    return document.getElementById('mapMode') ? document.getElementById('mapMode').value : 'single';
};

window.mapUsesDiff = function() {
    return window.getMapMode() !== 'single';
};

window.updateLegend = function() {
    if (!window.mapInstance) return;
    
    const getCol = (id, def) => { const el = document.getElementById(id); return el ? el.value : def; };
    const getPct = (key) => window.mapAreaStats && window.mapAreaStats[key] !== undefined ? ` <span style="font-weight: normal; color: #475569; font-size: 0.85em;">(${window.mapAreaStats[key].toFixed(0)}% Area)</span>` : '';

    const div = document.getElementById('mapLegendContent');
    if(!div) return;
    
    let html = '';
    if (window.mapUsesDiff()) {
        html += '<strong style="display:block; margin-bottom:8px; font-size:1.1em; color:#1e293b;">Rise / Fall Fluctuation (m)</strong>';
        const f1 = parseFloat(document.getElementById('flucR1')?.value) || 2;
        const f2 = parseFloat(document.getElementById('flucR2')?.value) || 4;
        const rise0_2Col = getCol('mapColRise0_2', '#d1d5db');
        const rise2_4Col = getCol('mapColRise2_4', '#a855f7');
        const riseGt4Col = getCol('mapColRiseGt4', '#2563eb');
        const fall0_2Col = getCol('mapColFall0_2', '#fecaca');
        const fall2_4Col = getCol('mapColFall2_4', '#f87171');
        const fallGt4Col = getCol('mapColFallGt4', '#7f1d1d');
        html += `<i style="background: ${rise0_2Col}"></i> Rise 0 - ${f1}${getPct('rise_0_f1')}<br>`;
        html += `<i style="background: ${rise2_4Col}"></i> Rise ${f1} - ${f2}${getPct('rise_f1_f2')}<br>`;
        html += `<i style="background: ${riseGt4Col}"></i> Rise > ${f2}${getPct('rise_strong')}<br>`;
        html += `<i style="background: ${fall0_2Col}"></i> Fall 0 - ${f1}${getPct('fall_0_f1')}<br>`;
        html += `<i style="background: ${fall2_4Col}"></i> Fall ${f1} - ${f2}${getPct('fall_f1_f2')}<br>`;
        html += `<i style="background: ${fallGt4Col}"></i> Fall > ${f2}${getPct('fall_strong')}<br>`;
    } else {
        html += '<strong style="display:block; margin-bottom:8px; font-size:1.1em; color:#1e293b;">Depth to water level (in mbgl)</strong>';
        html += `<i style="background: ${getCol('col0_2', '#2563eb')}"></i> 0 - 2${getPct('0_2')}<br>`;
        html += `<i style="background: ${getCol('col2_5', '#16a34a')}"></i> 2 - 5${getPct('2_5')}<br>`;
        html += `<i style="background: ${getCol('col5_10', '#fde047')}"></i> 5 - 10${getPct('5_10')}<br>`;
        html += `<i style="background: ${getCol('col10_20', '#f97316')}"></i> 10 - 20${getPct('10_20')}<br>`;
        html += `<i style="background: ${getCol('col20_40', '#ef4444')}"></i> 20 - 40${getPct('20_40')}<br>`;
        html += `<i style="background: ${getCol('col_gt40', '#7f1d1d')}"></i> > 40${getPct('gt40')}<br>`;
    }
    const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='#ffffff'/><path d='M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4' stroke='#475569' stroke-width='1.5'/></svg>`;
    const encodedSvg = encodeURIComponent(svgContent).replace(/'/g, "%27").replace(/"/g, "%22");
    const svgHatch = `url("data:image/svg+xml;charset=utf-8,${encodedSvg}")`;
    html += `<div style="clear: both; padding-top: 6px; margin-top: 6px; border-top: 1px solid #cbd5e1;"><i style='background: ${svgHatch}; border: 1px solid rgba(0,0,0,0.5);'></i> Hilly Area / No Data Area${getPct('hilly')}</div>`;
    div.innerHTML = html;
};

window.updateMapElements = function() {
    const naCheck = document.getElementById('showNorthArrow');
    const naOverlay = document.getElementById('northArrowOverlay');
    if (naOverlay) {
        naOverlay.style.display = (naCheck && naCheck.checked) ? 'block' : 'none';
    }

    const borderCheck = document.getElementById('showMapBorder');
    const mapCont = document.getElementById('mapContainer');
    if (mapCont) {
        if (borderCheck && borderCheck.checked) mapCont.classList.add('map-frame-border');
        else mapCont.classList.remove('map-frame-border');
    }

    const legSize = document.getElementById('mapLegendSize');
    const legOverlay = document.getElementById('mapLegendOverlay');
    if (legOverlay && legSize) {
        legOverlay.style.fontSize = legSize.value + 'px';
    }

    const frameCheck = document.getElementById('showPrintFrame');
    const frameOverlay = document.getElementById('printFrameGuide');
    if (frameOverlay) {
        frameOverlay.style.display = (frameCheck && frameCheck.checked) ? 'block' : 'none';
    }
};

window.getWlColor = function(wl) {
    const getCol = (id, def) => { const el = document.getElementById(id); return el ? el.value : def; };
    if (!window.mapUsesDiff()) {
        if (wl <= 2) return getCol('col0_2', '#2563eb');
        if (wl <= 5) return getCol('col2_5', '#16a34a');
        if (wl <= 10) return getCol('col5_10', '#fde047');
        if (wl <= 20) return getCol('col10_20', '#f97316');
        if (wl <= 40) return getCol('col20_40', '#ef4444');
        return getCol('col_gt40', '#7f1d1d');
    }
    const f1 = parseFloat(document.getElementById('flucR1')?.value) || 2;
    const f2 = parseFloat(document.getElementById('flucR2')?.value) || 4;
    if (wl > f2) return getCol('mapColRiseGt4', '#2563eb');
    if (wl > f1) return getCol('mapColRise2_4', '#a855f7');
    if (wl > 0) return getCol('mapColRise0_2', '#d1d5db');
    if (wl < -f2) return getCol('mapColFallGt4', '#7f1d1d');
    if (wl < -f1) return getCol('mapColFall2_4', '#f87171');
    if (wl < 0) return getCol('mapColFall0_2', '#fecaca');
    return '#94a3b8';
};

window.hexToRgb = function(hex) { 
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); 
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : {r: 0, g: 0, b: 0}; 
};

window.updateColors = function(skipSave = false) {
    window.updateMapTitle();
    window.updateMapMarkers(); window.updateLegend();
    if (window.idwLayerGroup && window.idwLayerGroup.getLayers().length > 0) window.generateSmoothIDW();
    if (!skipSave && typeof window.saveUserPreferences === 'function') window.saveUserPreferences();
};

window.toggleHillyState = function() { 
    window.updateShapefileMask(); 
    window.updateColors(); 
};

window.updateShapefileMask = function() {
    if (!window.shapefileLayer || !window.uploadedShapefileGeoJSON) return;
    const filterStateEl = document.getElementById('filterState'); const selState = filterStateEl ? filterStateEl.value : 'ALL';
    const excludeHillyBtn = document.getElementById('excludeHillyBtn'); const excludeHilly = excludeHillyBtn ? excludeHillyBtn.checked : false;
    const hillyStateKeywords = ['jammu', 'kashmir', 'ladakh', 'himachal', 'uttarakhand', 'sikkim', 'nagaland', 'mizoram', 'manipur', 'tripura', 'meghalaya', 'arunachal'];

    let renderFeatures = []; let idwFeatures = []; let hatchFeatures = [];

    turf.featureEach(window.uploadedShapefileGeoJSON, function(f) {
        let matchState = false;
        if (selState !== 'ALL') { 
            for (let key in f.properties) { 
                if (String(f.properties[key]).toLowerCase() === selState.toLowerCase()) { matchState = true; break; } 
            } 
        } else { 
            matchState = true; 
        }
        if (!matchState) return;

        let isHilly = false;
        if (excludeHilly) {
            for (let key in f.properties) {
                let valStr = String(f.properties[key]).toLowerCase();
                if (hillyStateKeywords.some(h => valStr.includes(h))) { isHilly = true; break; }
            }
        }
        f.properties._isHilly = isHilly;
        if (isHilly) { renderFeatures.push(f); hatchFeatures.push(f); } else { renderFeatures.push(f); idwFeatures.push(f); }
    });
    
    window.globalIdwMaskGeoJSON = { type: "FeatureCollection", features: idwFeatures }; 
    window.globalHatchGeoJSON = { type: "FeatureCollection", features: hatchFeatures }; 
    window.activeMaskGeoJSON = { type: "FeatureCollection", features: renderFeatures };
    
    window.shapefileLayer.clearLayers(); window.shapefileLayer.addData(window.activeMaskGeoJSON);
    const boundaryColorEl = document.getElementById('shpBoundaryColor'); const boundaryColor = boundaryColorEl ? boundaryColorEl.value : '#1e293b';
    const weightEl = document.getElementById('shpWeight'); const weight = weightEl ? parseInt(weightEl.value) : 3;
    if (weightEl) document.getElementById('shpWeightVal').innerText = weight;

    window.shapefileLayer.setStyle(function(feature) {
        if (feature.properties._isHilly) return { fillColor: 'url(#diagonalHatch)', color: boundaryColor, weight: 1, fillOpacity: 1 };
        else return { fillColor: '#ffffff', color: boundaryColor, weight: weight, fillOpacity: 0 };
    });
    if(renderFeatures.length > 0 && window.mapInstance) window.mapInstance.fitBounds(window.shapefileLayer.getBounds(), { padding: [10, 10] });
};

window.handleShapefileUpload = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader(); window.showLoader("Parsing Shapefile ZIP...");
    reader.onload = function(e) {
        shp(e.target.result).then(function(geojson) {
            if (window.shapefileLayer && window.mapInstance) window.mapInstance.removeLayer(window.shapefileLayer);
            window.uploadedShapefileGeoJSON = geojson;
            if(window.mapInstance) { 
                window.shapefileLayer = L.geoJSON(geojson).addTo(window.mapInstance); 
                window.updateShapefileMask(); 
            }
            window.hideLoader(); 
            window.showToast("Shapefile loaded successfully.", "success");
        }).catch(err => { 
            window.hideLoader(); 
            alert("Error parsing shapefile: " + err); 
        });
    }; 
    reader.readAsArrayBuffer(file);
};

window.togglePoints = function() {
    const toggleEl = document.getElementById('togglePointsBtn'); const isChecked = toggleEl ? toggleEl.checked : true;
    if(!window.mapInstance) return;
    if (isChecked && window.mapMarkersLayer) window.mapInstance.addLayer(window.mapMarkersLayer); 
    else if (!isChecked && window.mapMarkersLayer) window.mapInstance.removeLayer(window.mapMarkersLayer);
};

window.toggleBaseMap = function() {
    if (!window.mapInstance) return;
    const toggleEl = document.getElementById('toggleBaseMapBtn'); const isChecked = toggleEl ? toggleEl.checked : true;
    const pane = window.mapInstance.getPane('tilePane'); 
    if (pane) pane.style.display = isChecked ? '' : 'none';
    const mapContainer = document.getElementById('mapContainer'); 
    if (mapContainer) mapContainer.style.backgroundColor = isChecked ? '#f8fafc' : '#ffffff';
};

window.getValidPointsForMap = function() {
    const mode = window.getMapMode();
    const excludeHillyBtn = document.getElementById('excludeHillyBtn'); const excludeHilly = excludeHillyBtn ? excludeHillyBtn.checked : false;
    const hillyStates = ['jammu', 'kashmir', 'ladakh', 'himachal', 'uttarakhand', 'sikkim', 'nagaland', 'mizoram', 'manipur', 'tripura', 'meghalaya', 'arunachal'];
    const wellsArray = Object.values(window.globalFilteredDictionary); let validPoints = [];

    const pushPoint = (w, value) => {
        const nw = parseFloat(value);
        if (w.lat === null || w.lon === null || isNaN(w.lat) || isNaN(w.lon)) return;
        if (excludeHilly) { let sName = String(w.state).toLowerCase(); if (hillyStates.some(h => sName.includes(h))) return; }
        if (nw === undefined || nw === null || isNaN(nw)) return;
        validPoints.push({ lat: w.lat, lon: w.lon, wl: nw, details: w });
    };

    if (mode === 'single') {
        const mapYearEl = document.getElementById('mapYear'); const mapSeasonEl = document.getElementById('mapSeason');
        const selYear = mapYearEl ? String(mapYearEl.value).trim() : ''; const selSeason = mapSeasonEl ? String(mapSeasonEl.value).trim().toLowerCase() : '';
        if (!selYear || !selSeason || selYear === 'undefined' || selSeason === 'undefined') return [];

        wellsArray.forEach(w => {
            let targetRec = w.records.find(r => String(r.year).trim() === selYear && String(r.season).trim().toLowerCase() === selSeason);
            if (targetRec) pushPoint(w, targetRec.wl);
        });
    } else if (mode === 'periodCompare') {
        const yearAEl = document.getElementById('mapYearA'); const seasonAEl = document.getElementById('mapSeasonA');
        const yearBEl = document.getElementById('mapYearB'); const seasonBEl = document.getElementById('mapSeasonB');
        const yearA = yearAEl ? String(yearAEl.value).trim() : ''; const seasonA = seasonAEl ? String(seasonAEl.value).trim().toLowerCase() : '';
        const yearB = yearBEl ? String(yearBEl.value).trim() : ''; const seasonB = seasonBEl ? String(seasonBEl.value).trim().toLowerCase() : '';
        if (!yearA || !seasonA || !yearB || !seasonB) return [];

        wellsArray.forEach(w => {
            let recA = w.records.find(r => String(r.year).trim() === yearA && String(r.season).trim().toLowerCase() === seasonA);
            let recB = w.records.find(r => String(r.year).trim() === yearB && String(r.season).trim().toLowerCase() === seasonB);
            if (recA && recB) pushPoint(w, recA.wl - recB.wl);
        });
    } else if (mode === 'decadal') {
        const yearEl = document.getElementById('mapDecYear'); const seasonEl = document.getElementById('mapDecSeason');
        const targetYear = yearEl ? parseInt(String(yearEl.value).trim()) : NaN; const selSeason = seasonEl ? String(seasonEl.value).trim().toLowerCase() : '';
        if (isNaN(targetYear) || !selSeason) return [];

        wellsArray.forEach(w => {
            const current = w.records.find(r => String(r.year).trim() === String(targetYear) && String(r.season).trim().toLowerCase() === selSeason);
            const historical = w.records.filter(r => {
                const ry = parseInt(String(r.year).trim());
                return !isNaN(ry) && ry >= targetYear - 10 && ry <= targetYear - 1 && String(r.season).trim().toLowerCase() === selSeason;
            });
            if (!current || historical.length < 5) return;
            let sum = historical.reduce((acc, r) => acc + (parseFloat(r.wl) || 0), 0);
            let mean = sum / historical.length;
            pushPoint(w, mean - current.wl);
        });
    }

    return validPoints;
};

window.updateMapMarkers = function() {
    if (!window.mapInstance || !window.mapMarkersLayer) return;
    window.mapMarkersLayer.clearLayers();

    const ptSizeEl = document.getElementById('mapPointSize'); const pointSize = ptSizeEl ? parseInt(ptSizeEl.value) || 6 : 6;
    const validPoints = window.getValidPointsForMap(); if (validPoints.length === 0) return;

    const bounds = [];
    validPoints.forEach(p => {
        bounds.push([p.lat, p.lon]); const markerColor = window.getWlColor(p.wl);
        const popupContent = `<div style="font-family: 'Segoe UI', sans-serif;"><h3 style="margin: 0 0 5px; color: #1e293b; font-weight: 900;">${p.details.well}</h3><p style="margin: 2px 0; font-size: 12px;"><strong>State:</strong> ${p.details.state}</p><p style="margin: 2px 0; font-size: 12px;"><strong>District:</strong> ${p.details.district}</p><hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 8px 0;"><p style="margin: 0; font-size: 13px;"><strong>Water Level:</strong> <span style="color: ${markerColor}; font-weight: 900;">${p.wl} mbgl</span></p></div>`;
        const circle = L.circleMarker([p.lat, p.lon], { radius: pointSize, fillColor: markerColor, color: '#ffffff', weight: 0.5, opacity: 0.8, fillOpacity: 0.9 }).bindPopup(popupContent);
        circle.addTo(window.mapMarkersLayer);
    });
    
    if (!window.uploadedShapefileGeoJSON && bounds.length > 0) window.mapInstance.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
};

window.drawGeoJSONToCanvas = function(geoJson, ctx, mapInstance, minX, maxX, minY, maxY, width, height) {
    turf.featureEach(geoJson, function (feature) {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
            polys.forEach(polygon => {
                polygon.forEach(ring => {
                    ring.forEach((coord, index) => {
                        let proj = mapInstance.project([coord[1], coord[0]], 0);
                        const px = ((proj.x - minX) / (maxX - minX)) * width; const py = ((proj.y - minY) / (maxY - minY)) * height;
                        if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    });
                });
            });
        }
    });
};

window.getCanvasHatchPattern = function(ctx) {
    let pCanvas = document.createElement('canvas'); pCanvas.width = 12; pCanvas.height = 12;
    let pCtx = pCanvas.getContext('2d'); pCtx.fillStyle = '#ffffff'; pCtx.fillRect(0, 0, 12, 12);
    pCtx.strokeStyle = '#475569'; pCtx.lineWidth = 1; pCtx.beginPath();
    pCtx.moveTo(-2, 2); pCtx.lineTo(4, -4); pCtx.moveTo(0, 12); pCtx.lineTo(12, 0); pCtx.moveTo(8, 14); pCtx.lineTo(14, 8); pCtx.stroke();
    return ctx.createPattern(pCanvas, 'repeat');
};

window.generateSmoothIDW = function() {
    if (!window.mapInstance) return;
    const validPoints = window.getValidPointsForMap();
    if (validPoints.length < 3) { window.showToast("Not enough valid points for IDW plotting.", "error"); return; }

    window.showLoader("Generating Fast Interpolation Raster...");
    
    setTimeout(() => {
        window.idwLayerGroup.clearLayers();

        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        let fullMaskGeoJSON = null;
        if (window.globalIdwMaskGeoJSON || window.globalHatchGeoJSON) {
            let allFeatures = [];
            if (window.globalIdwMaskGeoJSON) allFeatures.push(...window.globalIdwMaskGeoJSON.features);
            if (window.globalHatchGeoJSON) allFeatures.push(...window.globalHatchGeoJSON.features);
            if (allFeatures.length > 0) fullMaskGeoJSON = { type: "FeatureCollection", features: allFeatures };
        }

        if (fullMaskGeoJSON && fullMaskGeoJSON.features.length > 0) {
            const bbox = turf.bbox(fullMaskGeoJSON);
            minLon = bbox[0]; minLat = bbox[1]; maxLon = bbox[2]; maxLat = bbox[3];
        } else {
            validPoints.forEach(p => { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon); });
            const padLat = (maxLat - minLat) * 0.1 || 0.1; const padLon = (maxLon - minLon) * 0.1 || 0.1;
            minLat -= padLat; maxLat += padLat; minLon -= padLon; maxLon += padLon;
        }

        const nw = window.mapInstance.project([maxLat, minLon], 0); const se = window.mapInstance.project([minLat, maxLon], 0);
        const minX = nw.x, maxX = se.x; const minY = nw.y, maxY = se.y; 

        const densityEl = document.getElementById('idwDensity'); const canvasWidth = densityEl ? (parseInt(densityEl.value) || 400) : 400;
        const ratio = Math.abs(maxY - minY) / Math.abs(maxX - minX); const canvasHeight = Math.floor(canvasWidth * ratio);

        const canvas = document.createElement('canvas'); canvas.width = canvasWidth; canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const projectedPoints = validPoints.map(p => {
            const pt = window.mapInstance.project([p.lat, p.lon], 0);
            return { x: ((pt.x - minX) / (maxX - minX)) * canvasWidth, y: ((pt.y - minY) / (maxY - minY)) * canvasHeight, v: p.wl };
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasWidth; tempCanvas.height = canvasHeight;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        const imgData = tempCtx.createImageData(canvasWidth, canvasHeight);
        const data = imgData.data;
        const method = document.getElementById('idwMethod') ? document.getElementById('idwMethod').value : 'nn';
        const diffMode = window.mapUsesDiff();
        let stats = diffMode ? { total:0, rise_0_f1:0, rise_f1_f2:0, rise_strong:0, fall_0_f1:0, fall_f1_f2:0, fall_strong:0, hilly:0 } : { total:0, '0_2':0, '2_5':0, '5_10':0, '10_20':0, '20_40':0, 'gt40':0, 'hilly':0 };

        const getColStr = (id, def) => { const el = document.getElementById(id); return el ? el.value : def; };
        const flucR1 = parseFloat(document.getElementById('flucR1')?.value) || 2;
        const flucR2 = parseFloat(document.getElementById('flucR2')?.value) || 4;

        for (let y = 0; y < canvasHeight; y++) {
            for (let x = 0; x < canvasWidth; x++) {
                let val = 0;
                if (method === 'idw') {
                    let num = 0, den = 0;
                    for (let i = 0; i < projectedPoints.length; i++) {
                        const p = projectedPoints[i];
                        const d2 = (x - p.x)*(x - p.x) + (y - p.y)*(y - p.y);
                        if (d2 === 0) { val = p.v; num = p.v; den = 1; break; }
                        const w = 1 / d2;
                        num += p.v * w; den += w;
                    }
                    val = num / den;
                } else {
                    let closestD = Infinity;
                    for (let i = 0; i < projectedPoints.length; i++) {
                        const p = projectedPoints[i];
                        const d2 = (x - p.x)*(x - p.x) + (y - p.y)*(y - p.y);
                        if (d2 < closestD) { closestD = d2; val = p.v; }
                    }
                }

                const idx = (y * canvasWidth + x) * 4;
                let r=0, g=0, b=0, a=220;
                if (!diffMode) {
                    if (val <= 2) { let c = window.hexToRgb(getColStr('col0_2', '#2563eb')); r=c.r; g=c.g; b=c.b; stats['0_2']++; }
                    else if (val <= 5) { let c = window.hexToRgb(getColStr('col2_5', '#16a34a')); r=c.r; g=c.g; b=c.b; stats['2_5']++; }
                    else if (val <= 10) { let c = window.hexToRgb(getColStr('col5_10', '#fde047')); r=c.r; g=c.g; b=c.b; stats['5_10']++; }
                    else if (val <= 20) { let c = window.hexToRgb(getColStr('col10_20', '#f97316')); r=c.r; g=c.g; b=c.b; stats['10_20']++; }
                    else if (val <= 40) { let c = window.hexToRgb(getColStr('col20_40', '#ef4444')); r=c.r; g=c.g; b=c.b; stats['20_40']++; }
                    else { let c = window.hexToRgb(getColStr('col_gt40', '#7f1d1d')); r=c.r; g=c.g; b=c.b; stats['gt40']++; }
                } else {
                    const rise0_2Col = getColStr('mapColRise0_2', '#d1d5db');
                    const rise2_4Col = getColStr('mapColRise2_4', '#a855f7');
                    const riseGt4Col = getColStr('mapColRiseGt4', '#2563eb');
                    const fall0_2Col = getColStr('mapColFall0_2', '#fecaca');
                    const fall2_4Col = getColStr('mapColFall2_4', '#f87171');
                    const fallGt4Col = getColStr('mapColFallGt4', '#7f1d1d');
                    if (val > flucR2) { let c = window.hexToRgb(riseGt4Col); r=c.r; g=c.g; b=c.b; stats.rise_strong++; }
                    else if (val > flucR1) { let c = window.hexToRgb(rise2_4Col); r=c.r; g=c.g; b=c.b; stats.rise_f1_f2++; }
                    else if (val > 0) { let c = window.hexToRgb(rise0_2Col); r=c.r; g=c.g; b=c.b; stats.rise_0_f1++; }
                    else if (val < -flucR2) { let c = window.hexToRgb(fallGt4Col); r=c.r; g=c.g; b=c.b; stats.fall_strong++; }
                    else if (val < -flucR1) { let c = window.hexToRgb(fall2_4Col); r=c.r; g=c.g; b=c.b; stats.fall_f1_f2++; }
                    else if (val < 0) { let c = window.hexToRgb(fall0_2Col); r=c.r; g=c.g; b=c.b; stats.fall_0_f1++; }
                }
                stats.total++;
                data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = a;
            }
        }
        tempCtx.putImageData(imgData, 0, 0);

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        const clipIdw = document.getElementById('clipIdwBtn')?.checked ?? false;

        if (clipIdw && window.globalIdwMaskGeoJSON && window.globalIdwMaskGeoJSON.features.length > 0) {
            ctx.save();
            ctx.beginPath();
            window.drawGeoJSONToCanvas(window.globalIdwMaskGeoJSON, ctx, window.mapInstance, minX, maxX, minY, maxY, canvasWidth, canvasHeight);
            ctx.clip('evenodd');
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        } else {
            ctx.drawImage(tempCanvas, 0, 0);
        }

        if (window.globalHatchGeoJSON && window.globalHatchGeoJSON.features.length > 0) {
            ctx.save();
            ctx.beginPath();
            window.drawGeoJSONToCanvas(window.globalHatchGeoJSON, ctx, window.mapInstance, minX, maxX, minY, maxY, canvasWidth, canvasHeight);
            ctx.clip('evenodd');
            ctx.fillStyle = window.getCanvasHatchPattern(ctx);
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.restore();
        }

        let hillyAreaSqM = 0;
        if (window.globalHatchGeoJSON && window.globalHatchGeoJSON.features.length > 0) {
            hillyAreaSqM = turf.area(window.globalHatchGeoJSON);
        }
        let idwAreaSqM = 0;
        if (window.globalIdwMaskGeoJSON && window.globalIdwMaskGeoJSON.features.length > 0) {
            idwAreaSqM = turf.area(window.globalIdwMaskGeoJSON);
        }
        let totalAreaSqM = hillyAreaSqM + idwAreaSqM;
        
        let hillyPct = 0;
        let idwPctMultiplier = 100;
        if (totalAreaSqM > 0) {
            hillyPct = (hillyAreaSqM / totalAreaSqM) * 100;
            idwPctMultiplier = (idwAreaSqM / totalAreaSqM) * 100;
        }

        if (window.mapUsesDiff()) {
            window.mapAreaStats = {
                rise_0_f1: stats.total > 0 ? (stats.rise_0_f1 / stats.total) * idwPctMultiplier : 0,
                rise_f1_f2: stats.total > 0 ? (stats.rise_f1_f2 / stats.total) * idwPctMultiplier : 0,
                rise_strong: stats.total > 0 ? (stats.rise_strong / stats.total) * idwPctMultiplier : 0,
                fall_0_f1: stats.total > 0 ? (stats.fall_0_f1 / stats.total) * idwPctMultiplier : 0,
                fall_f1_f2: stats.total > 0 ? (stats.fall_f1_f2 / stats.total) * idwPctMultiplier : 0,
                fall_strong: stats.total > 0 ? (stats.fall_strong / stats.total) * idwPctMultiplier : 0,
                hilly: hillyPct
            };
        } else {
            window.mapAreaStats = {
                '0_2': stats.total > 0 ? (stats['0_2']/stats.total) * idwPctMultiplier : 0,
                '2_5': stats.total > 0 ? (stats['2_5']/stats.total) * idwPctMultiplier : 0,
                '5_10': stats.total > 0 ? (stats['5_10']/stats.total) * idwPctMultiplier : 0,
                '10_20': stats.total > 0 ? (stats['10_20']/stats.total) * idwPctMultiplier : 0,
                '20_40': stats.total > 0 ? (stats['20_40']/stats.total) * idwPctMultiplier : 0,
                'gt40': stats.total > 0 ? (stats['gt40']/stats.total) * idwPctMultiplier : 0,
                'hilly': hillyPct
            };
        }

        window.updateLegend();

        window.globalIdwDataUrl = canvas.toDataURL("image/png");
        window.globalIdwBbox = [[minLat, minLon], [maxLat, maxLon]];
        window.globalIdwDimensions = {width: canvasWidth, height: canvasHeight, minX: minLon, maxX: maxLon, minY: minLat, maxY: maxLat};
        
        L.imageOverlay(window.globalIdwDataUrl, window.globalIdwBbox, { opacity: 0.85, zIndex: 10 }).addTo(window.idwLayerGroup);
        window.hideLoader();
    }, 100);
};

window.exportIDW = function() {
    if (!window.globalIdwDataUrl || !window.globalIdwBbox || !window.globalIdwDimensions) { window.showToast("Please generate an IDW map first.", "error"); return; }
    
    const zip = new JSZip();
    const dataUrlParts = window.globalIdwDataUrl.split(',');
    if(dataUrlParts.length !== 2) return;
    const dataUrl = dataUrlParts[1];
    
    zip.file("IDW_Map.png", dataUrl, {base64: true});

    const minX = window.globalIdwDimensions.minX; const maxX = window.globalIdwDimensions.maxX;
    const minY = window.globalIdwDimensions.minY; const maxY = window.globalIdwDimensions.maxY;
    
    const tabContent = `!table\n!version 300\n!charset WindowsLatin1\n\nDefinition Table\n  File "IDW_Map.png"\n  Type "RASTER"\n  ( ${minX}, ${maxY} ) (0,0) Label "Pt 1",\n  ( ${maxX}, ${maxY} ) (${window.globalIdwDimensions.width},0) Label "Pt 2",\n  ( ${minX}, ${minY} ) (0,${window.globalIdwDimensions.height}) Label "Pt 3",\n  ( ${maxX}, ${minY} ) (${window.globalIdwDimensions.width},${window.globalIdwDimensions.height}) Label "Pt 4"\n  CoordSys Earth Projection 1, 104\n  Units "degree"\n`;
    zip.file("IDW_Map.tab", tabContent);
    
    const xRes = (maxX - minX) / window.globalIdwDimensions.width;
    const yRes = (minY - maxY) / window.globalIdwDimensions.height;
    const pgwContent = `${xRes}\n0.00000\n0.00000\n${yRes}\n${minX + (xRes/2)}\n${maxY + (yRes/2)}\n`;
    zip.file("IDW_Map.pgw", pgwContent);

    zip.generateAsync({type:"blob"}).then(function(content) {
        saveAs(content, "IDW_GIS_Export.zip");
    });
};

window.exportIDWShapefile = function() {
    const validPoints = window.getValidPointsForMap();
    if (validPoints.length < 3) { window.showToast("Not enough valid points to generate shapefile.", "error"); return; }

    window.showLoader("Generating Vector Contours...");
    
    setTimeout(() => {
        try {
            let points = turf.featureCollection(validPoints.map(p => turf.point([p.lon, p.lat], { wl: p.wl })));
            let options = { gridType: 'points', property: 'wl', units: 'degrees', weight: 2 };
            let grid = turf.interpolate(points, 0.1, options);

            let breaks = [0, 2, 5, 10, 20, 40, 9999];
            let lines = turf.isobands(grid, breaks, { zProperty: 'wl' });

            let finalFeatures = [];
            if (window.globalIdwMaskGeoJSON && window.globalIdwMaskGeoJSON.features.length > 0) {
                turf.featureEach(lines, function (line) {
                    turf.featureEach(window.globalIdwMaskGeoJSON, function (mask) {
                        try {
                            let intersected = turf.intersect(line, mask);
                            if (intersected) {
                                intersected.properties = line.properties;
                                finalFeatures.push(intersected);
                            }
                        } catch(e) {}
                    });
                });
            } else {
                finalFeatures = lines.features;
            }

            if(finalFeatures.length === 0) finalFeatures = lines.features;

            let finalCollection = turf.featureCollection(finalFeatures);
            let shpOptions = {
                folder: 'IDW_Contours',
                types: { polygon: 'IDW_Depth_Zones' }
            };
            
            shpwrite.download(finalCollection, shpOptions);
            window.hideLoader();
        } catch(e) {
            window.hideLoader();
            window.showToast("Error generating shapefile: " + e.message, "error");
        }
    }, 100);
};

window.onMapModeChange = function() {
    const mode = window.getMapMode();
    const singleCtrls = document.querySelectorAll('.map-single-controls');
    const compareCtrls = document.getElementById('mapPeriodCompareControls');
    const decadalCtrls = document.getElementById('mapDecadalControls');
    const infoEl = document.getElementById('mapModeInfo');

    if (infoEl) {
        if (mode === 'single') {
            infoEl.textContent = 'Single Depth: displays static Water Table mbgl depths for point records.';
        } else if (mode === 'periodCompare') {
            infoEl.textContent = 'Period Comparison: displays the water table change (rise or fall) between two chosen periods.';
        } else if (mode === 'decadal') {
            infoEl.textContent = 'Decadal Fluc: displays the deviation of the selected target year/season from its decadal average.';
        }
    }

    singleCtrls.forEach(el => {
        el.style.display = (mode === 'single') ? 'flex' : 'none';
    });

    if (compareCtrls) {
        compareCtrls.style.display = (mode === 'periodCompare') ? 'block' : 'none';
    }

    if (decadalCtrls) {
        decadalCtrls.style.display = (mode === 'decadal') ? 'block' : 'none';
    }

    window.updateMapTitle();
    window.markTabDirtyAndRender('map');
};

window.updateMapTitle = function() {
    const mainEl = document.getElementById('mapTitleMain');
    const subEl = document.getElementById('mapTitleSub');
    if (!mainEl || !subEl) return;

    const mode = window.getMapMode();
    if (mode === 'single') {
        mainEl.innerText = "Depth to Water Level Map";
        const yr = document.getElementById('mapYear')?.value || '';
        const sn = document.getElementById('mapSeason')?.value || '';
        subEl.innerText = (yr || sn) ? `${sn} ${yr}` : "";
    } else if (mode === 'periodCompare') {
        mainEl.innerText = "Groundwater Fluctuation Map";
        const yrA = document.getElementById('mapYearA')?.value || '';
        const snA = document.getElementById('mapSeasonA')?.value || '';
        const yrB = document.getElementById('mapYearB')?.value || '';
        const snB = document.getElementById('mapSeasonB')?.value || '';
        subEl.innerText = (yrA && yrB) ? `${snB} ${yrB} vs ${snA} ${yrA}` : "";
    } else if (mode === 'decadal') {
        mainEl.innerText = "Decadal Water Level Fluctuation Map";
        const yr = document.getElementById('mapDecYear')?.value || '';
        const sn = document.getElementById('mapDecSeason')?.value || '';
        subEl.innerText = (yr || sn) ? `${sn} ${yr} vs Decadal Mean` : "";
    }
};
