// --- Groundwater Data Engine: GIS Maps, Leaflet and IDW Overlay Engine ---

window.mapInstance = null;
window.mapMarkersLayer = null;
window.idwLayerGroup = null;
window.uploadedShapefileGeoJSON = null;
window.activeMaskGeoJSON = null; 
window.globalIdwMaskGeoJSON = null;
window.globalHatchGeoJSON = null;
window.shapefileLayer = null;

// Multi-Layer ZIP Shapefile State Manager
window.shapefileLayers = [];
window.stateShapefileIndex = -1;
window.districtShapefileIndex = -1;
window.blockShapefileIndex = -1;

window.stateShapefileGeoJSON = null;
window.districtShapefileGeoJSON = null;
window.blockShapefileGeoJSON = null;

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

    // Restore spatial boundaries on map tab initialization if already loaded in-memory
    if (window.uploadedShapefileGeoJSON) {
        if (window.shapefileLayer) {
            try { window.mapInstance.removeLayer(window.shapefileLayer); } catch(e) {}
        }
        window.shapefileLayer = L.geoJSON(window.uploadedShapefileGeoJSON).addTo(window.mapInstance);
        window.updateShapefileMask();
    }
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

window.isHillyFeature = function(f) {
    if (!f || !f.properties) return false;
    if (f.properties.customHilly === true) return true;
    if (f.properties.customHilly === false) return false;
    
    const excludeHillyBtn = document.getElementById('excludeHillyBtn'); 
    const excludeHilly = excludeHillyBtn ? excludeHillyBtn.checked : false;
    if (!excludeHilly) return false;
    
    const hillyStateKeywords = ['jammu', 'kashmir', 'ladakh', 'ladhak', 'himachal', 'uttarakhand', 'uttraklhand', 'sikkim', 'nagaland', 'mizoram', 'manipur', 'tripura', 'meghalaya', 'meghalya', 'arunachal', 'arunchal'];
    for (let key in f.properties) {
        let valStr = String(f.properties[key]).toLowerCase();
        if (hillyStateKeywords.some(h => valStr.includes(h))) {
            return true;
        }
    }
    return false;
};

window.toggleHillyFeatureInTable = function(index, event) {
    if (event) event.stopPropagation();
    const geojson = (typeof window.getActiveAttribGeoJSON === 'function') ? window.getActiveAttribGeoJSON() : window.uploadedShapefileGeoJSON;
    if (!geojson || !geojson.features) return;
    const feature = geojson.features[index];
    if (!feature) return;
    
    if (!feature.properties) feature.properties = {};
    
    // Determine the current state using isHillyFeature helper
    const currentIsHilly = window.isHillyFeature(feature);
    feature.properties.customHilly = !currentIsHilly;
    
    if (typeof window.renderShapefileAttrTable === 'function') {
        window.renderShapefileAttrTable();
    }
    if (typeof window.updateShapefileMask === 'function') {
        window.updateShapefileMask();
    }
    window.showToast(`Hilly terrain status toggled! Map mask and IDW analysis updated.`, "success");
};

// --- MULTI-LAYER GIS SHAPEFILE MANAGER & EXTRACTOR ---

window.detectShapefileColumns = function(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) return null;
    
    let firstFeat = geojson.features[0];
    let keys = Object.keys(firstFeat.properties || {});
    
    let stateCol = '';
    let distCol = '';
    let blockCol = '';
    
    const stateKeywords = ['state', 'st_name', 'st_nm', 'state_ut', 'state_name', 'name_1', 'st_dec', 'state_desc', 'st_nm_eng'];
    const distKeywords = ['district', 'dist_name', 'dist_nm', 'dist', 'dt_name', 'name_2', 'dist_dec', 'dist_desc', 'dst_eng'];
    const blockKeywords = ['block', 'block_name', 'block_nm', 'tehsil', 'taluk', 'sub_dist', 'subdist', 'name_3', 'sub_district', 'teh_name', 'blk_name'];
    
    keys.forEach(k => {
        let lk = k.toLowerCase().trim();
        if (!stateCol && stateKeywords.some(kw => lk === kw || lk.includes(kw))) stateCol = k;
        if (!distCol && distKeywords.some(kw => lk === kw || lk.includes(kw))) distCol = k;
        if (!blockCol && blockKeywords.some(kw => lk === kw || lk.includes(kw))) blockCol = k;
    });
    
    // Exact or partial fallbacks
    if (!stateCol) {
        stateCol = keys.find(k => k.toLowerCase().includes('state')) || keys[0] || '';
    }
    if (!distCol) {
        distCol = keys.find(k => k.toLowerCase().includes('dist')) || keys[1] || '';
    }
    if (!blockCol) {
        blockCol = keys.find(k => k.toLowerCase().includes('block') || k.toLowerCase().includes('tehsil') || k.toLowerCase().includes('sub')) || keys[2] || '';
    }
    
    return { stateCol, distCol, blockCol };
};

window.getActiveAttribGeoJSON = function() {
    const layerSel = document.getElementById('shpAttribLayerSel');
    const selectedLayerType = layerSel ? layerSel.value : 'state';
    
    if (selectedLayerType === 'state') return window.stateShapefileGeoJSON || window.uploadedShapefileGeoJSON;
    if (selectedLayerType === 'district') return window.districtShapefileGeoJSON || window.uploadedShapefileGeoJSON;
    if (selectedLayerType === 'block') return window.blockShapefileGeoJSON || window.uploadedShapefileGeoJSON;
    return window.uploadedShapefileGeoJSON;
};

window.onShpAttribLayerChange = function() {
    const geojson = window.getActiveAttribGeoJSON();
    if (!geojson || !geojson.features || geojson.features.length === 0) return;
    
    const container = document.getElementById('shpAttributesContainer');
    if (container) container.classList.remove('hidden');
    
    const cols = window.detectShapefileColumns(geojson);
    if (!cols) return;
    
    const stColEl = document.getElementById('detectedStateCol');
    const dtColEl = document.getElementById('detectedDistCol');
    const blColEl = document.getElementById('detectedBlockCol');
    if (stColEl) stColEl.innerText = cols.stateCol || 'N/A';
    if (dtColEl) dtColEl.innerText = cols.distCol || 'N/A';
    if (blColEl) blColEl.innerText = cols.blockCol || 'N/A';
    
    const shpStateSel = document.getElementById('shpStateSel');
    if (shpStateSel) {
        shpStateSel.innerHTML = '<option value="ALL">-- Select State (ALL) --</option>';
        let uniqueStates = new Set();
        geojson.features.forEach(f => {
            if (f.properties && f.properties[cols.stateCol] !== undefined) {
                uniqueStates.add(String(f.properties[cols.stateCol]).trim());
            }
        });
        Array.from(uniqueStates).sort().forEach(s => {
            shpStateSel.add(new Option(s, s));
        });
    }
    
    // Clear rest of selectors
    const shpDistSel = document.getElementById('shpDistSel');
    if (shpDistSel) shpDistSel.innerHTML = '<option value="ALL">-- Select District (ALL) --</option>';
    const shpBlockSel = document.getElementById('shpBlockSel');
    if (shpBlockSel) shpBlockSel.innerHTML = '<option value="ALL">-- Select Block (ALL) --</option>';
    
    window.renderShapefileAttrTable();
};

window.autoAssignShapefileSlots = function() {
    window.stateShapefileIndex = -1;
    window.districtShapefileIndex = -1;
    window.blockShapefileIndex = -1;

    window.shapefileLayers.forEach((layer, idx) => {
        const name = (layer.fileName || "").toLowerCase();
        if (window.stateShapefileIndex === -1 && (name.includes("state") || name.includes("st_") || name.includes("adm1"))) {
            window.stateShapefileIndex = idx;
        } else if (window.districtShapefileIndex === -1 && (name.includes("dist") || name.includes("dt_") || name.includes("adm2"))) {
            window.districtShapefileIndex = idx;
        } else if (window.blockShapefileIndex === -1 && (name.includes("block") || name.includes("taluk") || name.includes("tehsil") || name.includes("sub") || name.includes("adm3"))) {
            window.blockShapefileIndex = idx;
        }
    });

    // Fallbacks
    window.shapefileLayers.forEach((layer, idx) => {
        if (idx === window.stateShapefileIndex || idx === window.districtShapefileIndex || idx === window.blockShapefileIndex) return;
        
        if (window.stateShapefileIndex === -1) {
            window.stateShapefileIndex = idx;
        } else if (window.districtShapefileIndex === -1) {
            window.districtShapefileIndex = idx;
        } else if (window.blockShapefileIndex === -1) {
            window.blockShapefileIndex = idx;
        }
    });
};

window.resolveShapefileSlots = function() {
    window.stateShapefileGeoJSON = window.shapefileLayers[window.stateShapefileIndex] || null;
    window.districtShapefileGeoJSON = window.shapefileLayers[window.districtShapefileIndex] || null;
    window.blockShapefileGeoJSON = window.shapefileLayers[window.blockShapefileIndex] || null;

    window.uploadedShapefileGeoJSON = window.stateShapefileGeoJSON || window.districtShapefileGeoJSON || window.blockShapefileGeoJSON || null;
};

window.onSlotChange = function(type) {
    if (type === 'state') {
        window.stateShapefileIndex = parseInt(document.getElementById('slotStateSel').value);
    } else if (type === 'district') {
        window.districtShapefileIndex = parseInt(document.getElementById('slotDistrictSel').value);
    } else if (type === 'block') {
        window.blockShapefileIndex = parseInt(document.getElementById('slotBlockSel').value);
    }
    
    window.resolveShapefileSlots();
    window.populateSlotSelectors();
    window.updateShapefileMask();
    window.initShapefileAttributesPanel();
    window.updateColors();
};

window.populateSlotSelectors = function() {
    const container = document.getElementById('shapefileAssignerContainer');
    const slotState = document.getElementById('slotStateSel');
    const slotDist = document.getElementById('slotDistrictSel');
    const slotBlock = document.getElementById('slotBlockSel');
    const singleSelect = document.getElementById('singleLayerSelect');

    if (!container) return;

    if (window.shapefileLayers.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    const renderOptions = (selectEl, selectedIndex) => {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        selectEl.add(new Option('-- None --', '-1'));
        window.shapefileLayers.forEach((layer, idx) => {
            const name = layer.fileName || `Layer ${idx + 1}`;
            selectEl.add(new Option(`${name} (${layer.features ? layer.features.length : 0} features)`, String(idx)));
        });
        selectEl.value = String(selectedIndex);
    };

    if (slotState && slotDist && slotBlock) {
        renderOptions(slotState, window.stateShapefileIndex);
        renderOptions(slotDist, window.districtShapefileIndex);
        renderOptions(slotBlock, window.blockShapefileIndex);
    }

    if (singleSelect) {
        singleSelect.innerHTML = '';
        window.shapefileLayers.forEach((layer, idx) => {
            const name = layer.fileName || `Layer ${idx + 1}`;
            singleSelect.add(new Option(`📄 ${name} [${layer.features ? layer.features.length : 0} features]`, String(idx)));
        });
        
        let defaultIdx = window.stateShapefileIndex >= 0 ? window.stateShapefileIndex : 0;
        singleSelect.value = String(defaultIdx);
    }
};

window.onMappingModeChange = function() {
    const modeEl = document.getElementById('shpMappingMode');
    if (!modeEl) return;
    
    window.shapefileMappingMode = modeEl.value;
    const singleContainer = document.getElementById('singleLayerOverrideContainer');
    const multiContainer = document.getElementById('multiLayerSlotsContainer');

    if (window.shapefileMappingMode === 'single') {
        if (singleContainer) singleContainer.classList.remove('hidden');
        if (multiContainer) multiContainer.classList.add('hidden');
        window.onSingleLayerSelectChange();
    } else {
        if (singleContainer) singleContainer.classList.add('hidden');
        if (multiContainer) multiContainer.classList.remove('hidden');
        
        window.resolveShapefileSlots();
        window.updateShapefileMask();
        if (typeof window.initShapefileAttributesPanel === 'function') {
            window.initShapefileAttributesPanel();
        }
        window.updateColors();
    }
};

window.onSingleLayerSelectChange = function() {
    const singleSelect = document.getElementById('singleLayerSelect');
    if (!singleSelect || window.shapefileLayers.length === 0) return;
    
    const idx = parseInt(singleSelect.value);
    if (idx >= 0 && idx < window.shapefileLayers.length) {
        window.uploadedShapefileGeoJSON = window.shapefileLayers[idx];
        window.stateShapefileGeoJSON = window.shapefileLayers[idx];
        window.districtShapefileGeoJSON = null;
        window.blockShapefileGeoJSON = null;
        
        window.updateShapefileMask();
        if (typeof window.initShapefileAttributesPanel === 'function') {
            window.initShapefileAttributesPanel();
        }
        window.updateColors();
    }
};

window.showHugeFileWarningModal = function(fileName, fileSizeMB) {
    const existing = document.getElementById('huge-file-warning-modal');
    if (existing) existing.remove();
    
    const modalHTML = `
    <div id="huge-file-warning-modal" class="fixed inset-0 bg-slate-900/65 flex items-center justify-center z-[9999] p-4 backdrop-blur-xs">
        <div class="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl relative flex flex-col gap-4 text-left font-sans">
            <button onclick="document.getElementById('huge-file-warning-modal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 focus:outline-none">
                <i class="ph-bold ph-x text-lg"></i>
            </button>
            
            <div class="flex items-center gap-3 text-amber-600 border-b border-amber-100 pb-3">
                <div class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0 font-sans">
                    <i class="ph-bold ph-warning text-xl"></i>
                </div>
                <div>
                    <h3 class="font-bold text-slate-800 text-sm">Extremely Large Shapefile Warning</h3>
                    <p class="text-[10px] text-slate-500 font-medium">Uploaded "${fileName}" (${fileSizeMB} MB)</p>
                </div>
            </div>
            
            <div class="space-y-2.5 text-xs text-slate-600 leading-normal">
                <p>Web browsers have rigid RAM limitations and cannot parse or render raw <strong>${fileSizeMB} MB ZIP shapefiles</strong> directly. Trying to draw millions of vertex coordinates will instantly crash the web page or run out of memory.</p>
                
                <div class="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 space-y-2">
                    <span class="block font-bold text-indigo-900 text-[10.5px] uppercase tracking-wide">💡 Easy 1-Minute Fix (Using Mapshaper):</span>
                    <ol class="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-700">
                        <li>Open <a href="https://mapshaper.org" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">mapshaper.org <i class="ph-bold ph-arrow-square-out text-[9px]"></i></a> in a new tab.</li>
                        <li>Drag and drop your <strong>${fileSizeMB} MB .zip file</strong>, then click <strong>Import</strong>.</li>
                        <li>Click the <strong>Simplify</strong> button at the top right header.</li>
                        <li>Check "Prevent shape removal" and click <strong>Apply</strong>.</li>
                        <li>Use the slider at the top to reduce the complexity to <strong>1% to 5%</strong> (this trims unnecessary boundary coordinates and vertex details while keeping the layout extremely crisp).</li>
                        <li>Click <strong>Export</strong> in the top-right, select the <strong>Shapefile</strong> option, and click <strong>Export</strong>.</li>
                        <li>Upload your newly downloaded simplified <strong>.ZIP file</strong> here! It will load in under 1 second!</li>
                    </ol>
                </div>
                
                <p class="text-[10px] text-slate-400 italic">This simplification reduces the file size dramatically (e.g. from 129MB to ~1-2MB) while keeping the same visual precision on the map page, preventing browser crashes.</p>
            </div>
            
            <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <a href="https://mapshaper.org" target="_blank" rel="noopener noreferrer" onclick="document.getElementById('huge-file-warning-modal').remove()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1 hover:text-white hover:no-underline">
                    Go to Mapshaper.org <i class="ph-bold ph-arrow-right"></i>
                </a>
                <button onclick="document.getElementById('huge-file-warning-modal').remove()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs">
                    Dismiss
                </button>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.updateShapefileMask = function() {
    if (!window.shapefileLayer) return;
    
    const stateGeoJSON = window.stateShapefileGeoJSON || window.uploadedShapefileGeoJSON;
    if (!stateGeoJSON || !stateGeoJSON.features) return;

    let distGeoJSON = window.districtShapefileGeoJSON;
    if (distGeoJSON === stateGeoJSON) {
        distGeoJSON = null;
    }
    let blockGeoJSON = window.blockShapefileGeoJSON;
    if (blockGeoJSON === stateGeoJSON || blockGeoJSON === distGeoJSON) {
        blockGeoJSON = null;
    }

    const filterStateEl = document.getElementById('filterState'); const selState = filterStateEl ? filterStateEl.value : 'ALL';
    const filterDistEl = document.getElementById('filterDistrict'); const selDist = filterDistEl ? filterDistEl.value : 'ALL';
    const filterBlockEl = document.getElementById('filterBlock'); const selBlock = filterBlockEl ? filterBlockEl.value : 'ALL';
    const excludeHillyBtn = document.getElementById('excludeHillyBtn'); const excludeHilly = excludeHillyBtn ? excludeHillyBtn.checked : false;
    const hillyStateKeywords = ['jammu', 'kashmir', 'ladakh', 'ladhak', 'himachal', 'uttarakhand', 'uttraklhand', 'sikkim', 'nagaland', 'mizoram', 'manipur', 'tripura', 'meghalaya', 'meghalya', 'arunachal', 'arunchal'];

    const showDistrictBorders = document.getElementById('showDistrictBordersCheck')?.checked ?? true;
    const showBlockBorders = document.getElementById('showBlockBordersCheck')?.checked ?? false;

    const stateCols = window.detectShapefileColumns(stateGeoJSON);
    const distCols = distGeoJSON ? window.detectShapefileColumns(distGeoJSON) : null;
    const blockCols = blockGeoJSON ? window.detectShapefileColumns(blockGeoJSON) : null;

    let renderFeatures = []; 
    let idwFeatures = []; 
    let hatchFeatures = []; 
    let backgroundFeatures = [];

    // Helper to check if name matches
    const nameMatches = (propVal, targetVal) => {
        if (propVal === undefined || propVal === null || targetVal === 'ALL') return targetVal === 'ALL';
        let p = String(propVal).toLowerCase().trim();
        let t = String(targetVal).toLowerCase().trim();
        return p === t || p.includes(t) || t.includes(p);
    };

    // Helper to check if a feature's properties contain any hilly keywords
    const isHillyFeature = (f) => {
        return window.isHillyFeature(f);
    };

    // 1. Process State Features
    turf.featureEach(stateGeoJSON, function(f) {
        const props = Object.assign({}, f.properties);
        const fStateName = stateCols && stateCols.stateCol ? props[stateCols.stateCol] : null;
        
        const isHilly = isHillyFeature(f);
        props._isHilly = isHilly;

        const isStateActive = (selState === 'ALL' || nameMatches(fStateName, selState) || (stateCols && stateCols.stateCol && Array.from(Object.values(f.properties)).some(v => nameMatches(v, selState))));

        // We tag this as state layer
        props._layerType = isStateActive ? (selState === 'ALL' ? 'state' : 'state_active') : 'state_bg';
        props._isActiveState = isStateActive;

        const clonedFeat = Object.assign({}, f, { properties: props });

        if (isStateActive) {
            if (isHilly) {
                renderFeatures.push(clonedFeat);
                hatchFeatures.push(clonedFeat);
            } else {
                renderFeatures.push(clonedFeat);
                if (selState !== 'ALL' && selDist === 'ALL') {
                    idwFeatures.push(clonedFeat);
                } else if (selState === 'ALL') {
                    idwFeatures.push(clonedFeat);
                }
            }
        } else {
            renderFeatures.push(clonedFeat);
            backgroundFeatures.push(clonedFeat);
        }
    });

    // 2. Process District Features (if loaded)
    if (distGeoJSON && distGeoJSON.features && showDistrictBorders) {
        turf.featureEach(distGeoJSON, function(f) {
            const props = Object.assign({}, f.properties);
            const dStateName = distCols && distCols.stateCol ? f.properties[distCols.stateCol] : null;
            const dName = distCols && distCols.distCol ? f.properties[distCols.distCol] : null;

            const isHilly = isHillyFeature(f);
            props._isHilly = isHilly;

            const belongsToState = (selState === 'ALL' || nameMatches(dStateName, selState) || (distCols && distCols.stateCol && Array.from(Object.values(f.properties)).some(v => nameMatches(v, selState))));

            if (belongsToState) {
                const isDistActive = (selDist === 'ALL' || nameMatches(dName, selDist));
                
                if (selState === 'ALL') {
                    props._layerType = 'district_bg';
                } else {
                    props._layerType = isDistActive ? 'district_active' : 'district_sibling';
                }
                props._isActiveState = isDistActive;

                const clonedFeat = Object.assign({}, f, { properties: props });
                renderFeatures.push(clonedFeat);

                if (selState !== 'ALL' && isDistActive && selBlock === 'ALL') {
                    if (isHilly) {
                        hatchFeatures.push(clonedFeat);
                    } else {
                        idwFeatures.push(clonedFeat);
                    }
                }
            }
        });
    }

    // 3. Process Block Features (if loaded)
    if (blockGeoJSON && blockGeoJSON.features && showBlockBorders) {
        turf.featureEach(blockGeoJSON, function(f) {
            const props = Object.assign({}, f.properties);
            const bStateName = blockCols && blockCols.stateCol ? f.properties[blockCols.stateCol] : null;
            const bDistName = blockCols && blockCols.distCol ? f.properties[blockCols.distCol] : null;
            const bName = blockCols && blockCols.blockCol ? f.properties[blockCols.blockCol] : null;

            const isHilly = isHillyFeature(f);
            props._isHilly = isHilly;

            const belongsToState = (selState === 'ALL' || nameMatches(bStateName, selState));
            const belongsToDist = (selDist === 'ALL' || nameMatches(bDistName, selDist));

            if (belongsToState && belongsToDist) {
                const isBlockActive = (selBlock === 'ALL' || nameMatches(bName, selBlock));
                
                props._layerType = isBlockActive ? 'block_active' : 'block_sibling';
                props._isActiveState = isBlockActive;

                const clonedFeat = Object.assign({}, f, { properties: props });
                renderFeatures.push(clonedFeat);

                if (selState !== 'ALL' && selDist !== 'ALL' && isBlockActive) {
                    if (isHilly) {
                        hatchFeatures.push(clonedFeat);
                    } else {
                        idwFeatures.push(clonedFeat);
                    }
                }
            }
        });
    }

    if (idwFeatures.length === 0 && renderFeatures.length > 0) {
        renderFeatures.forEach(f => {
            if (f.properties._isActiveState && !f.properties._isHilly) {
                idwFeatures.push(f);
            }
        });
    }

    window.globalIdwMaskGeoJSON = { type: "FeatureCollection", features: idwFeatures }; 
    window.globalHatchGeoJSON = { type: "FeatureCollection", features: hatchFeatures }; 
    window.globalBackgroundMaskGeoJSON = { type: "FeatureCollection", features: backgroundFeatures };
    window.activeMaskGeoJSON = { type: "FeatureCollection", features: renderFeatures };
    
    window.shapefileLayer.clearLayers(); 
    window.shapefileLayer.addData(window.activeMaskGeoJSON);
    
    const boundaryColorEl = document.getElementById('shpBoundaryColor'); const boundaryColor = boundaryColorEl ? boundaryColorEl.value : '#1e293b';
    const weightEl = document.getElementById('shpWeight'); const weight = weightEl ? parseInt(weightEl.value) : 3;
    if (weightEl) document.getElementById('shpWeightVal').innerText = weight;

    window.shapefileLayer.setStyle(function(feature) {
        const type = feature.properties._layerType;
        const isHilly = feature.properties._isHilly;

        if (isHilly) {
            return { fillColor: 'url(#diagonalHatch)', color: boundaryColor, weight: 1, fillOpacity: 1 };
        }

        switch (type) {
            case 'state_active':
                return { fillColor: '#ffffff', color: boundaryColor, weight: Math.max(3, weight + 1), fillOpacity: 0 };
            case 'state':
                return { fillColor: '#ffffff', color: boundaryColor, weight: weight, fillOpacity: 0 };
            case 'state_bg':
                return { fillColor: '#ffffff', color: '#cbd5e1', weight: 1, fillOpacity: 0 };
            case 'district_bg':
                return { fillColor: '#ffffff', color: '#cbd5e1', weight: 0.5, fillOpacity: 0 };
            case 'district_active':
                return { fillColor: '#ffffff', color: '#4f46e5', weight: Math.max(1.5, weight - 1), fillOpacity: 0 };
            case 'district_sibling':
                return { fillColor: '#ffffff', color: '#818cf8', weight: 1, fillOpacity: 0, dashArray: '3, 3' };
            case 'block_active':
                return { fillColor: '#ffffff', color: '#7c3aed', weight: 1.2, fillOpacity: 0 };
            case 'block_sibling':
                return { fillColor: '#ffffff', color: '#b794f4', weight: 0.75, fillOpacity: 0, dashArray: '2, 2' };
            default:
                return { fillColor: '#ffffff', color: '#cbd5e1', weight: 1, fillOpacity: 0 };
        }
    });

    if (idwFeatures.length > 0 && window.mapInstance) {
        const tempLayer = L.geoJSON({ type: "FeatureCollection", features: idwFeatures });
        window.mapInstance.fitBounds(tempLayer.getBounds(), { padding: [25, 25] });
    } else if (renderFeatures.length > 0 && window.mapInstance) {
        window.mapInstance.fitBounds(window.shapefileLayer.getBounds(), { padding: [10, 10] });
    }
};

window.handleShapefileUpload = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader(); window.showLoader("Parsing Shapefile ZIP...");
    reader.onload = function(e) {
        shp(e.target.result).then(function(geojson) {
            if (window.shapefileLayer && window.mapInstance) window.mapInstance.removeLayer(window.shapefileLayer);
            
            // Re-initialize layers registry on new zip upload
            window.shapefileLayers = [];
            if (Array.isArray(geojson)) {
                window.shapefileLayers = geojson;
            } else if (geojson && geojson.type === 'FeatureCollection') {
                window.shapefileLayers = [{
                    type: "FeatureCollection",
                    fileName: file.name.replace(/\.zip$/i, "") || "Custom Boundary",
                    features: geojson.features
                }];
            } else if (geojson && typeof geojson === 'object') {
                if (geojson.features) {
                    window.shapefileLayers = [{
                        type: "FeatureCollection",
                        fileName: file.name.replace(/\.zip$/i, "") || "Custom Boundary",
                        features: geojson.features
                    }];
                } else {
                    for (let key in geojson) {
                        if (geojson[key] && geojson[key].type === 'FeatureCollection') {
                            const lyr = geojson[key];
                            lyr.fileName = key;
                            window.shapefileLayers.push(lyr);
                        }
                    }
                }
            }
            
            // Auto map state, district, block level boundaries
            window.autoAssignShapefileSlots();
            window.resolveShapefileSlots();
            window.populateSlotSelectors();
            
            if(window.mapInstance) { 
                window.shapefileLayer = L.geoJSON(window.uploadedShapefileGeoJSON).addTo(window.mapInstance); 
                window.updateShapefileMask(); 
            }
            window.hideLoader(); 
            window.showToast("Shapefile layers parsed & loaded successfully.", "success");
            
            // Calculate size of primary loaded layer
            let featCount = 0;
            const primaryL = window.uploadedShapefileGeoJSON;
            if (primaryL && primaryL.features) featCount = primaryL.features.length;
            
            if (typeof window.updateWizardUISuccess === 'function') {
                window.updateWizardUISuccess(file.name, featCount);
            }
            
            // Initialize dynamic shapefile attributes panel
            if (typeof window.initShapefileAttributesPanel === 'function') {
                window.initShapefileAttributesPanel();
            }
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

window.loadSOIBoundaryPreset = function(type) {
    const url = type === 'states' 
        ? 'https://cdn.jsdelivr.net/gh/subhashb/map-of-india@master/india_state.geojson'
        : 'https://cdn.jsdelivr.net/gh/subhashb/map-of-india@master/india_district.geojson';
        
    window.showLoader(`Downloading Official Survey of India ${type} boundaries...`);
    
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Could not fetch preset boundary files from server.");
            return res.json();
        })
        .then(geojson => {
            if (window.shapefileLayer && window.mapInstance) {
                window.mapInstance.removeLayer(window.shapefileLayer);
            }
            
            // Format to standard layer registry style
            const parsedName = type === 'states' ? 'SOI_States_Preset' : 'SOI_Districts_Preset';
            const layerObj = {
                type: "FeatureCollection",
                fileName: parsedName,
                features: geojson.features
            };
            
            // Set up shapefileLayers registry
            window.shapefileLayers = [layerObj];
            
            if (type === 'states') {
                window.stateShapefileIndex = 0;
                window.districtShapefileIndex = -1;
                window.blockShapefileIndex = -1;
            } else {
                window.stateShapefileIndex = -1;
                window.districtShapefileIndex = 0;
                window.blockShapefileIndex = -1;
            }
            
            window.resolveShapefileSlots();
            window.populateSlotSelectors();
            
            if (window.mapInstance) {
                window.shapefileLayer = L.geoJSON(window.uploadedShapefileGeoJSON).addTo(window.mapInstance);
                window.updateShapefileMask();
            }
            
            window.hideLoader();
            window.showToast(`Official SOI ${type} preset loaded successfully!`, "success");
            
            if (typeof window.updateWizardUISuccess === 'function') {
                window.updateWizardUISuccess(parsedName, geojson.features.length);
            }
            if (typeof window.initShapefileAttributesPanel === 'function') {
                window.initShapefileAttributesPanel();
            }
            window.updateColors();
        })
        .catch(err => {
            window.hideLoader();
            console.error(err);
            window.showToast("Connection failed. Please upload custom SOI shapefile ZIP or try again.", "danger");
        });
};
