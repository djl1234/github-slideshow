/**
 * Cattle Feed Lot Monitor - Data Store
 * Manages all data persistence using localStorage.
 * Single source of truth: pen-level data imported from PDF yard sheets.
 */
const Store = (function () {
    const PENS_KEY = 'cflm_pens';
    const ALERTS_KEY = 'cflm_alerts';

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

    // --- Pen-level data (yard sheet rows) ---
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

    function getPensByLot(lotNum) {
        return getAllPens().filter(function (p) { return p.lotNum === lotNum; });
    }

    // --- Lots (derived from pen data) ---
    function getLotsFromPens() {
        var pens = getAllPens();
        var lotMap = {};

        pens.forEach(function (p) {
            var num = p.lotNum;
            if (!num) return;
            if (!lotMap[num]) {
                lotMap[num] = {
                    lotNum: num,
                    pens: [],
                    origHdIn: 0,
                    locLot: 0,
                    locPen: 0,
                    locH: 0,
                    locB: 0,
                    locR: 0,
                    sold: 0,
                    deadsNo: 0,
                    customer: ''
                };
            }
            var lot = lotMap[num];
            lot.pens.push(p);
            lot.origHdIn += (p.origHdIn || 0);
            lot.locLot += (p.locLot || 0);
            lot.locPen += (p.locPen || 0);
            lot.locH += (p.locH || 0);
            lot.locB += (p.locB || 0);
            lot.locR += (p.locR || 0);
            lot.sold += (p.sold || 0);
            lot.deadsNo += (p.deadsNo || 0);
            // Use the first pen's customer if not set
            if (!lot.customer && p.customer) lot.customer = p.customer;
        });

        return Object.keys(lotMap).map(function (k) { return lotMap[k]; })
            .sort(function (a, b) { return a.lotNum - b.lotNum; });
    }

    // --- Statistics (derived from pen data) ---
    function getOverallStats() {
        var pens = getAllPens();
        var totalOrigHdIn = 0;
        var totalLocLot = 0;
        var totalLocH = 0;
        var totalLocB = 0;
        var totalLocR = 0;
        var totalSold = 0;
        var totalDeads = 0;
        var totalDof = 0;
        var penCount = pens.length;

        pens.forEach(function (p) {
            totalOrigHdIn += (p.origHdIn || 0);
            totalLocLot += (p.locLot || 0);
            totalLocH += (p.locH || 0);
            totalLocB += (p.locB || 0);
            totalLocR += (p.locR || 0);
            totalSold += (p.sold || 0);
            totalDeads += (p.deadsNo || 0);
            totalDof += (p.dof || 0);
        });

        var lots = getLotsFromPens();

        return {
            totalLots: lots.length,
            totalPens: penCount,
            totalOrigHdIn: totalOrigHdIn,
            totalHeadOnFeed: totalLocLot,
            totalLocH: totalLocH,
            totalLocB: totalLocB,
            totalLocR: totalLocR,
            totalSold: totalSold,
            totalDeads: totalDeads,
            avgDof: penCount > 0 ? Math.round(totalDof / penCount) : 0
        };
    }

    function getLotStats(lotNum) {
        var pens = getPensByLot(lotNum);
        var stats = {
            penCount: pens.length,
            origHdIn: 0,
            locLot: 0,
            locPen: 0,
            locH: 0,
            locB: 0,
            locR: 0,
            sold: 0,
            deadsNo: 0,
            deadsPct: 0,
            avgDof: 0
        };

        var totalDof = 0;
        pens.forEach(function (p) {
            stats.origHdIn += (p.origHdIn || 0);
            stats.locLot += (p.locLot || 0);
            stats.locPen += (p.locPen || 0);
            stats.locH += (p.locH || 0);
            stats.locB += (p.locB || 0);
            stats.locR += (p.locR || 0);
            stats.sold += (p.sold || 0);
            stats.deadsNo += (p.deadsNo || 0);
            totalDof += (p.dof || 0);
        });

        stats.avgDof = pens.length > 0 ? Math.round(totalDof / pens.length) : 0;
        stats.deadsPct = stats.origHdIn > 0
            ? parseFloat(((stats.deadsNo / stats.origHdIn) * 100).toFixed(2))
            : 0;

        return stats;
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
            lotNum: alert.lotNum || null,
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

    // --- Reset ---
    function resetAll() {
        localStorage.removeItem(PENS_KEY);
        localStorage.removeItem(ALERTS_KEY);
    }

    return {
        generateId,
        getAllPens,
        savePens,
        addPen,
        updatePen,
        deletePen,
        getPensByLot,
        getLotsFromPens,
        getOverallStats,
        getLotStats,
        getAlerts,
        addAlert,
        markAlertRead,
        markAllAlertsRead,
        clearAlerts,
        getUnreadCount,
        resetAll
    };
})();
