/**
 * Cattle Feed Lot Monitor - Data Store
 * Manages all data persistence using localStorage.
 */
const Store = (function () {
    const LOTS_KEY = 'cflm_lots';
    const CATTLE_KEY = 'cflm_cattle';
    const ALERTS_KEY = 'cflm_alerts';
    const INITIALIZED_KEY = 'cflm_initialized';

    const LOT_COUNT = 10;
    const LOT_CAPACITY = 500;

    // --- Helpers ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    function save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function load(key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }

    // --- Lots ---
    function getDefaultLots() {
        const lots = [];
        for (let i = 1; i <= LOT_COUNT; i++) {
            lots.push({
                id: i,
                name: 'Lot ' + i,
                capacity: LOT_CAPACITY
            });
        }
        return lots;
    }

    function getLots() {
        return load(LOTS_KEY) || getDefaultLots();
    }

    function saveLots(lots) {
        save(LOTS_KEY, lots);
    }

    // --- Cattle ---
    function getAllCattle() {
        return load(CATTLE_KEY) || [];
    }

    function saveCattle(cattle) {
        save(CATTLE_KEY, cattle);
    }

    function getCattleById(id) {
        return getAllCattle().find(c => c.id === id) || null;
    }

    function getCattleByLot(lotId) {
        return getAllCattle().filter(c => c.lotId === lotId);
    }

    function getActiveCattleByLot(lotId) {
        return getAllCattle().filter(c =>
            c.lotId === lotId && (c.status === 'active' || c.status === 'medical' || c.status === 'pregnant')
        );
    }

    function addCattle(data) {
        const cattle = getAllCattle();
        const record = {
            id: generateId(),
            tagNumber: data.tagNumber.trim(),
            lotId: parseInt(data.lotId, 10),
            breed: (data.breed || '').trim(),
            weight: data.weight ? parseInt(data.weight, 10) : null,
            dateAdded: data.dateAdded,
            status: data.status || 'active',
            statusDate: new Date().toISOString(),
            notes: (data.notes || '').trim(),
            history: [{
                date: new Date().toISOString(),
                action: 'added',
                status: data.status || 'active',
                notes: 'Entered lot'
            }]
        };
        cattle.push(record);
        saveCattle(cattle);
        return record;
    }

    function updateCattle(id, updates) {
        const cattle = getAllCattle();
        const idx = cattle.findIndex(c => c.id === id);
        if (idx === -1) return null;
        Object.assign(cattle[idx], updates);
        saveCattle(cattle);
        return cattle[idx];
    }

    function changeStatus(id, newStatus, notes) {
        const cattle = getAllCattle();
        const idx = cattle.findIndex(c => c.id === id);
        if (idx === -1) return null;

        const oldStatus = cattle[idx].status;
        cattle[idx].status = newStatus;
        cattle[idx].statusDate = new Date().toISOString();
        if (notes) cattle[idx].notes = notes;

        cattle[idx].history = cattle[idx].history || [];
        cattle[idx].history.push({
            date: new Date().toISOString(),
            action: 'status_change',
            from: oldStatus,
            to: newStatus,
            notes: notes || ''
        });

        saveCattle(cattle);
        return { animal: cattle[idx], oldStatus, newStatus };
    }

    function moveCattle(id, newLotId) {
        const cattle = getAllCattle();
        const idx = cattle.findIndex(c => c.id === id);
        if (idx === -1) return null;

        const oldLotId = cattle[idx].lotId;
        cattle[idx].lotId = parseInt(newLotId, 10);

        cattle[idx].history = cattle[idx].history || [];
        cattle[idx].history.push({
            date: new Date().toISOString(),
            action: 'moved',
            from: 'Lot ' + oldLotId,
            to: 'Lot ' + newLotId,
            notes: ''
        });

        saveCattle(cattle);
        return { animal: cattle[idx], oldLotId, newLotId: parseInt(newLotId, 10) };
    }

    function deleteCattle(id) {
        const cattle = getAllCattle().filter(c => c.id !== id);
        saveCattle(cattle);
    }

    // --- Alerts ---
    function getAlerts() {
        return load(ALERTS_KEY) || [];
    }

    function saveAlerts(alerts) {
        save(ALERTS_KEY, alerts);
    }

    function addAlert(alert) {
        const alerts = getAlerts();
        const record = {
            id: generateId(),
            type: alert.type,
            lotId: alert.lotId || null,
            cattleId: alert.cattleId || null,
            tagNumber: alert.tagNumber || '',
            message: alert.message,
            timestamp: new Date().toISOString(),
            read: false
        };
        alerts.unshift(record);
        saveAlerts(alerts);
        return record;
    }

    function markAlertRead(id) {
        const alerts = getAlerts();
        const alert = alerts.find(a => a.id === id);
        if (alert) {
            alert.read = true;
            saveAlerts(alerts);
        }
    }

    function markAllAlertsRead() {
        const alerts = getAlerts();
        alerts.forEach(a => a.read = true);
        saveAlerts(alerts);
    }

    function clearAlerts() {
        saveAlerts([]);
    }

    function getUnreadCount() {
        return getAlerts().filter(a => !a.read).length;
    }

    // --- Statistics ---
    function getLotStats(lotId) {
        const cattle = getCattleByLot(lotId);
        const occupying = cattle.filter(c =>
            c.status === 'active' || c.status === 'medical' || c.status === 'pregnant'
        );
        return {
            total: occupying.length,
            available: LOT_CAPACITY - occupying.length,
            active: cattle.filter(c => c.status === 'active').length,
            processing: cattle.filter(c => c.status === 'processing').length,
            deceased: cattle.filter(c => c.status === 'deceased').length,
            medical: cattle.filter(c => c.status === 'medical').length,
            pregnant: cattle.filter(c => c.status === 'pregnant').length
        };
    }

    function getOverallStats() {
        const cattle = getAllCattle();
        const occupying = cattle.filter(c =>
            c.status === 'active' || c.status === 'medical' || c.status === 'pregnant'
        );
        return {
            totalCapacity: LOT_COUNT * LOT_CAPACITY,
            totalOccupied: occupying.length,
            totalAvailable: (LOT_COUNT * LOT_CAPACITY) - occupying.length,
            active: cattle.filter(c => c.status === 'active').length,
            processing: cattle.filter(c => c.status === 'processing').length,
            deceased: cattle.filter(c => c.status === 'deceased').length,
            medical: cattle.filter(c => c.status === 'medical').length,
            pregnant: cattle.filter(c => c.status === 'pregnant').length,
            totalCattle: cattle.length
        };
    }

    function getDaysOnFeed(dateAdded) {
        const start = new Date(dateAdded);
        const now = new Date();
        const diff = now - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    // --- Initialization / Seed Data ---
    function isInitialized() {
        return localStorage.getItem(INITIALIZED_KEY) === 'true';
    }

    function markInitialized() {
        localStorage.setItem(INITIALIZED_KEY, 'true');
    }

    function resetAll() {
        localStorage.removeItem(LOTS_KEY);
        localStorage.removeItem(CATTLE_KEY);
        localStorage.removeItem(ALERTS_KEY);
        localStorage.removeItem(INITIALIZED_KEY);
    }

    function seedDemoData() {
        const lots = getDefaultLots();
        saveLots(lots);

        const breeds = ['Angus', 'Hereford', 'Charolais', 'Simmental', 'Limousin', 'Red Angus', 'Brahman', 'Shorthorn'];
        const cattle = [];
        const now = new Date();

        for (let lotId = 1; lotId <= LOT_COUNT; lotId++) {
            const headCount = 40 + Math.floor(Math.random() * 80); // 40-119 per lot
            for (let j = 0; j < headCount; j++) {
                const daysAgo = Math.floor(Math.random() * 180) + 10; // 10-190 days ago
                const dateAdded = new Date(now.getTime() - daysAgo * 86400000);
                const breed = breeds[Math.floor(Math.random() * breeds.length)];
                const weight = 600 + Math.floor(Math.random() * 700); // 600-1300 lbs

                // Mostly active, some with other statuses
                let status = 'active';
                const roll = Math.random();
                if (roll < 0.03) status = 'medical';
                else if (roll < 0.06) status = 'pregnant';
                else if (roll < 0.08) status = 'processing';
                else if (roll < 0.09) status = 'deceased';

                const tagNum = 'T' + String(lotId).padStart(2, '0') + '-' + String(j + 1).padStart(4, '0');

                cattle.push({
                    id: generateId(),
                    tagNumber: tagNum,
                    lotId: lotId,
                    breed: breed,
                    weight: weight,
                    dateAdded: dateAdded.toISOString().split('T')[0],
                    status: status,
                    statusDate: dateAdded.toISOString(),
                    notes: '',
                    history: [{
                        date: dateAdded.toISOString(),
                        action: 'added',
                        status: status,
                        notes: 'Initial entry'
                    }]
                });
            }
        }

        saveCattle(cattle);

        // Seed a few alerts
        const alerts = [
            { type: 'processing', lotId: 2, tagNumber: cattle.find(c => c.lotId === 2 && c.status === 'processing')?.tagNumber || 'T02-0005', message: 'Head moved to processing from Lot 2', timestamp: new Date(now - 3600000).toISOString(), read: false, id: generateId() },
            { type: 'medical', lotId: 5, tagNumber: cattle.find(c => c.lotId === 5 && c.status === 'medical')?.tagNumber || 'T05-0012', message: 'Head placed in medical care in Lot 5', timestamp: new Date(now - 7200000).toISOString(), read: false, id: generateId() },
            { type: 'pregnancy', lotId: 3, tagNumber: cattle.find(c => c.lotId === 3 && c.status === 'pregnant')?.tagNumber || 'T03-0008', message: 'Pregnancy confirmed for head in Lot 3', timestamp: new Date(now - 14400000).toISOString(), read: true, id: generateId() },
        ];
        saveAlerts(alerts);
        markInitialized();
    }

    // --- Lot Sheet (Pen-level data) ---
    const PENS_KEY = 'cflm_pens';

    function getAllPens() {
        return load(PENS_KEY) || [];
    }

    function savePens(pens) {
        save(PENS_KEY, pens);
    }

    function addPen(data) {
        var pens = getAllPens();
        var record = Object.assign({ id: generateId() }, data);
        pens.push(record);
        savePens(pens);
        return record;
    }

    function updatePen(id, updates) {
        var pens = getAllPens();
        var idx = pens.findIndex(function (p) { return p.id === id; });
        if (idx === -1) return null;
        Object.assign(pens[idx], updates);
        savePens(pens);
        return pens[idx];
    }

    function deletePen(id) {
        var pens = getAllPens().filter(function (p) { return p.id !== id; });
        savePens(pens);
    }

    function seedLotSheetData() {
        var pens = [
            { trl:'Ultra', srt:'Strt', prog:'HOL', fo:'', lotNum:51323, pen:'B25', sfPerHd:227, bunkInPerHd:12.4, sex:'O', avgWt:351, dof:308, dors:283, ewt:1228, dateIn:'4/3/2025', dateOut:'5/3/2026', origHdIn:135, locLot:127, locPen:121, locH:0, locB:6, locR:0, sold:3, deadsNo:5, deadsPct:3.70, ratn:'4/4', consNeg1:29.1, cons7d:28.5, consYtd:21.5, curChgs:2.81, ytdChgs:2.57, customer:'ARCADIA CO' },
            { trl:'Ultra', srt:'Strt', prog:'HOL', fo:'', lotNum:51324, pen:'B54', sfPerHd:207, bunkInPerHd:11.3, sex:'O', avgWt:368, dof:308, dors:283, ewt:1296, dateIn:'4/3/2025', dateOut:'4/14/2026', origHdIn:135, locLot:129, locPen:122, locH:0, locB:7, locR:0, sold:1, deadsNo:5, deadsPct:3.70, ratn:'4/4', consNeg1:30.4, cons7d:31.1, consYtd:22.9, curChgs:2.91, ytdChgs:2.73, customer:'ARCADIA CO' },
            { trl:'HR', srt:'Strt', prog:'DEF', fo:'', lotNum:51325, pen:'A13', sfPerHd:198, bunkInPerHd:10.8, sex:'H', avgWt:412, dof:295, dors:270, ewt:1185, dateIn:'4/16/2025', dateOut:'5/10/2026', origHdIn:142, locLot:134, locPen:128, locH:1, locB:4, locR:1, sold:2, deadsNo:6, deadsPct:4.23, ratn:'3/4', consNeg1:27.8, cons7d:27.2, consYtd:20.1, curChgs:2.65, ytdChgs:2.41, customer:'ARCADIA CO' },
            { trl:'Ultra', srt:'Lot', prog:'HOL', fo:'', lotNum:51326, pen:'B30', sfPerHd:215, bunkInPerHd:11.7, sex:'O', avgWt:385, dof:280, dors:255, ewt:1310, dateIn:'4/28/2025', dateOut:'5/20/2026', origHdIn:128, locLot:122, locPen:117, locH:0, locB:5, locR:0, sold:1, deadsNo:4, deadsPct:3.13, ratn:'4/4', consNeg1:31.2, cons7d:30.8, consYtd:23.4, curChgs:2.98, ytdChgs:2.80, customer:'ARCADIA CO' },
            { trl:'HR', srt:'Strt', prog:'DEF', fo:'', lotNum:51327, pen:'A07', sfPerHd:232, bunkInPerHd:12.6, sex:'H', avgWt:398, dof:275, dors:250, ewt:1195, dateIn:'5/1/2025', dateOut:'5/25/2026', origHdIn:118, locLot:112, locPen:107, locH:1, locB:3, locR:1, sold:0, deadsNo:5, deadsPct:4.24, ratn:'3/4', consNeg1:26.5, cons7d:26.0, consYtd:19.3, curChgs:2.55, ytdChgs:2.33, customer:'ARCADIA CO' },
            { trl:'Ultra', srt:'Strt', prog:'HOL', fo:'', lotNum:51328, pen:'B42', sfPerHd:210, bunkInPerHd:11.5, sex:'O', avgWt:355, dof:265, dors:240, ewt:1245, dateIn:'5/14/2025', dateOut:'6/5/2026', origHdIn:140, locLot:135, locPen:129, locH:0, locB:6, locR:0, sold:0, deadsNo:4, deadsPct:2.86, ratn:'4/4', consNeg1:28.9, cons7d:28.3, consYtd:20.8, curChgs:2.72, ytdChgs:2.49, customer:'ARCADIA CO' },
            { trl:'HR', srt:'Lot', prog:'DEF', fo:'', lotNum:51329, pen:'A20', sfPerHd:195, bunkInPerHd:10.6, sex:'H', avgWt:425, dof:252, dors:227, ewt:1205, dateIn:'5/28/2025', dateOut:'6/18/2026', origHdIn:145, locLot:139, locPen:132, locH:2, locB:4, locR:1, sold:1, deadsNo:5, deadsPct:3.45, ratn:'3/4', consNeg1:27.1, cons7d:26.6, consYtd:19.7, curChgs:2.60, ytdChgs:2.38, customer:'ARCADIA CO' },
            { trl:'Ultra', srt:'Strt', prog:'HOL', fo:'', lotNum:51330, pen:'B18', sfPerHd:220, bunkInPerHd:12.0, sex:'O', avgWt:342, dof:240, dors:215, ewt:1218, dateIn:'6/10/2025', dateOut:'7/1/2026', origHdIn:130, locLot:126, locPen:121, locH:0, locB:5, locR:0, sold:0, deadsNo:3, deadsPct:2.31, ratn:'4/4', consNeg1:29.7, cons7d:29.1, consYtd:21.2, curChgs:2.75, ytdChgs:2.52, customer:'ARCADIA CO' },
            { trl:'HR', srt:'Strt', prog:'DEF', fo:'', lotNum:51331, pen:'A35', sfPerHd:204, bunkInPerHd:11.1, sex:'H', avgWt:408, dof:225, dors:200, ewt:1175, dateIn:'6/25/2025', dateOut:'7/15/2026', origHdIn:138, locLot:133, locPen:127, locH:1, locB:4, locR:1, sold:0, deadsNo:4, deadsPct:2.90, ratn:'3/4', consNeg1:26.9, cons7d:26.4, consYtd:19.5, curChgs:2.58, ytdChgs:2.35, customer:'ARCADIA CO' },
            { trl:'Ultra', srt:'Lot', prog:'HOL', fo:'', lotNum:51332, pen:'B09', sfPerHd:225, bunkInPerHd:12.3, sex:'O', avgWt:365, dof:210, dors:185, ewt:1270, dateIn:'7/8/2025', dateOut:'7/28/2026', origHdIn:125, locLot:121, locPen:116, locH:0, locB:5, locR:0, sold:0, deadsNo:3, deadsPct:2.40, ratn:'4/4', consNeg1:30.0, cons7d:29.5, consYtd:22.0, curChgs:2.85, ytdChgs:2.63, customer:'ARCADIA CO' },
            { trl:'HR', srt:'Strt', prog:'DEF', fo:'', lotNum:51333, pen:'A28', sfPerHd:200, bunkInPerHd:10.9, sex:'H', avgWt:418, dof:195, dors:170, ewt:1190, dateIn:'7/22/2025', dateOut:'8/10/2026', origHdIn:148, locLot:143, locPen:136, locH:2, locB:4, locR:1, sold:0, deadsNo:4, deadsPct:2.70, ratn:'3/4', consNeg1:27.3, cons7d:26.8, consYtd:19.9, curChgs:2.62, ytdChgs:2.40, customer:'ARCADIA CO' },
            { trl:'Ultra', srt:'Strt', prog:'HOL', fo:'', lotNum:51334, pen:'B37', sfPerHd:218, bunkInPerHd:11.9, sex:'O', avgWt:378, dof:180, dors:155, ewt:1285, dateIn:'8/5/2025', dateOut:'8/25/2026', origHdIn:132, locLot:128, locPen:123, locH:0, locB:5, locR:0, sold:0, deadsNo:3, deadsPct:2.27, ratn:'4/4', consNeg1:30.8, cons7d:30.2, consYtd:22.5, curChgs:2.88, ytdChgs:2.66, customer:'ARCADIA CO' },
            { trl:'HR', srt:'Lot', prog:'DEF', fo:'', lotNum:51335, pen:'A42', sfPerHd:192, bunkInPerHd:10.5, sex:'H', avgWt:432, dof:165, dors:140, ewt:1210, dateIn:'8/18/2025', dateOut:'9/8/2026', origHdIn:150, locLot:146, locPen:140, locH:1, locB:4, locR:1, sold:0, deadsNo:3, deadsPct:2.00, ratn:'3/4', consNeg1:27.6, cons7d:27.0, consYtd:20.0, curChgs:2.63, ytdChgs:2.42, customer:'ARCADIA CO' },
            { trl:'Ultra', srt:'Strt', prog:'HOL', fo:'', lotNum:51336, pen:'B62', sfPerHd:212, bunkInPerHd:11.6, sex:'O', avgWt:340, dof:150, dors:125, ewt:1235, dateIn:'9/1/2025', dateOut:'9/22/2026', origHdIn:136, locLot:133, locPen:128, locH:0, locB:5, locR:0, sold:0, deadsNo:2, deadsPct:1.47, ratn:'4/4', consNeg1:29.4, cons7d:28.8, consYtd:21.0, curChgs:2.78, ytdChgs:2.56, customer:'ARCADIA CO' },
            { trl:'HR', srt:'Strt', prog:'DEF', fo:'', lotNum:51337, pen:'A15', sfPerHd:202, bunkInPerHd:11.0, sex:'H', avgWt:415, dof:135, dors:110, ewt:1180, dateIn:'9/15/2025', dateOut:'10/5/2026', origHdIn:140, locLot:137, locPen:131, locH:1, locB:4, locR:1, sold:0, deadsNo:2, deadsPct:1.43, ratn:'3/4', consNeg1:27.0, cons7d:26.5, consYtd:19.6, curChgs:2.57, ytdChgs:2.36, customer:'ARCADIA CO' }
        ];

        // Add IDs
        pens.forEach(function (p) { p.id = generateId(); });
        savePens(pens);
    }

    function resetAll() {
        localStorage.removeItem(LOTS_KEY);
        localStorage.removeItem(CATTLE_KEY);
        localStorage.removeItem(ALERTS_KEY);
        localStorage.removeItem(INITIALIZED_KEY);
        localStorage.removeItem(PENS_KEY);
    }

    return {
        LOT_COUNT,
        LOT_CAPACITY,
        getLots,
        getAllCattle,
        getCattleById,
        getCattleByLot,
        getActiveCattleByLot,
        addCattle,
        updateCattle,
        changeStatus,
        moveCattle,
        deleteCattle,
        getAlerts,
        addAlert,
        markAlertRead,
        markAllAlertsRead,
        clearAlerts,
        getUnreadCount,
        getLotStats,
        getOverallStats,
        getDaysOnFeed,
        isInitialized,
        seedDemoData,
        seedLotSheetData,
        resetAll,
        generateId,
        getAllPens,
        savePens,
        addPen,
        updatePen,
        deletePen
    };
})();
