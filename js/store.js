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
        resetAll,
        generateId
    };
})();
