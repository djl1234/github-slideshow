/**
 * Cattle Feed Lot Monitor - Main Application
 * All data derives from pen-level yard sheet records (imported via PDF).
 */
(function () {
    'use strict';

    // --- Initialize ---
    document.addEventListener('DOMContentLoaded', function () {
        initNavigation();
        initModals();
        initEventHandlers();
        initLotSheetHandlers();
        renderDashboard();
        AlertSystem.updateBadge();
        updateHeaderSubtitle();
        populateLotDropdown();
    });

    // --- Navigation ---
    function initNavigation() {
        document.querySelectorAll('.nav-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                var view = this.getAttribute('data-view');
                switchView(view);
            });
        });
    }

    function switchView(viewName) {
        document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });

        var tab = document.querySelector('.nav-tab[data-view="' + viewName + '"]');
        var view = document.getElementById('view-' + viewName);
        if (tab) tab.classList.add('active');
        if (view) view.classList.add('active');

        switch (viewName) {
            case 'dashboard': renderDashboard(); break;
            case 'lotsheet': renderLotSheet(); break;
            case 'lots': renderLotDetail(); break;
            case 'alerts': renderAlerts(); break;
            case 'reports': renderReports(); break;
        }
    }

    // --- Header subtitle (dynamic from data) ---
    function updateHeaderSubtitle() {
        var stats = Store.getOverallStats();
        var el = document.getElementById('header-subtitle');
        if (stats.totalLots === 0) {
            el.textContent = 'No yard sheets imported yet';
        } else {
            el.textContent = stats.totalLots + ' Lots \u00B7 ' +
                stats.totalHeadOnFeed.toLocaleString() + ' Head on Feed';
        }
    }

    // --- Dashboard ---
    function renderDashboard() {
        renderSummaryCards();
        renderLotsGrid();
    }

    function renderSummaryCards() {
        var stats = Store.getOverallStats();
        var container = document.getElementById('summary-cards');

        if (stats.totalPens === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128203;</div>' +
                '<p>No data yet. Import yard sheet PDFs to get started.</p></div>';
            return;
        }

        container.innerHTML = [
            summaryCard(stats.totalHeadOnFeed.toLocaleString(), 'Head on Feed', ''),
            summaryCard(stats.totalLots.toLocaleString(), 'Lots', 'card-info'),
            summaryCard(stats.totalPens.toLocaleString(), 'Pens', ''),
            summaryCard(stats.totalOrigHdIn.toLocaleString(), 'Orig Hd In', ''),
            summaryCard(stats.totalSold.toLocaleString(), 'Sold', 'card-warning'),
            summaryCard(stats.totalDeads.toLocaleString(), 'Deads', 'card-danger'),
            summaryCard(stats.totalLocH.toLocaleString(), 'Hospital', 'card-medical'),
            summaryCard(String(stats.avgDof), 'Avg DOF', '')
        ].join('');
    }

    function summaryCard(value, label, extraClass) {
        return '<div class="summary-card ' + extraClass + '">' +
            '<div class="card-value">' + value + '</div>' +
            '<div class="card-label">' + label + '</div></div>';
    }

    function renderLotsGrid() {
        var container = document.getElementById('lots-grid');
        var lots = Store.getLotsFromPens();

        if (lots.length === 0) {
            container.innerHTML = '';
            return;
        }

        var html = '';
        lots.forEach(function (lot) {
            var deadsPct = lot.origHdIn > 0
                ? ((lot.deadsNo / lot.origHdIn) * 100).toFixed(2) : '0.00';
            var avgDof = 0;
            var totalDof = 0;
            lot.pens.forEach(function (p) { totalDof += (p.dof || 0); });
            avgDof = lot.pens.length > 0 ? Math.round(totalDof / lot.pens.length) : 0;

            html += '<div class="lot-card" data-lot-num="' + lot.lotNum + '">' +
                '<div class="lot-card-header"><h3>Lot ' + lot.lotNum + '</h3>' +
                '<span class="lot-count">' + lot.locLot + ' hd</span></div>' +
                '<div class="lot-card-body">' +
                '<div class="lot-stats">' +
                lotStatItem('Orig Hd In', lot.origHdIn) +
                lotStatItem('Current Hd', lot.locLot) +
                lotStatItem('In Pen', lot.locPen) +
                lotStatItem('Hospital', lot.locH) +
                lotStatItem('Sold', lot.sold) +
                lotStatItem('Deads', lot.deadsNo + ' (' + deadsPct + '%)') +
                lotStatItem('Avg DOF', avgDof) +
                lotStatItem('Pens', lot.pens.length) +
                '</div>';

            if (lot.customer) {
                html += '<div class="lot-customer">' + escapeHtml(lot.customer) + '</div>';
            }

            html += '</div></div>';
        });
        container.innerHTML = html;

        // Click handler to navigate to lot detail
        container.querySelectorAll('.lot-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var lotNum = parseInt(this.getAttribute('data-lot-num'), 10);
                document.getElementById('lot-select').value = lotNum;
                switchView('lots');
            });
        });
    }

    function lotStatItem(label, value) {
        return '<div class="lot-stat"><span class="stat-label">' + label + '</span><span class="stat-value">' + value + '</span></div>';
    }

    // --- Lot Detail ---
    function renderLotDetail() {
        var lotNum = parseInt(document.getElementById('lot-select').value, 10);
        if (!lotNum) {
            var lots = Store.getLotsFromPens();
            if (lots.length > 0) {
                lotNum = lots[0].lotNum;
                document.getElementById('lot-select').value = lotNum;
            }
        }
        if (!lotNum) {
            document.getElementById('lot-detail-content').innerHTML =
                '<div class="empty-state"><div class="empty-icon">&#128203;</div><p>No lots available. Import yard sheet PDFs first.</p></div>';
            return;
        }

        var stats = Store.getLotStats(lotNum);
        var pens = Store.getPensByLot(lotNum);
        var content = document.getElementById('lot-detail-content');

        var headerHtml = '<div class="lot-detail-header">' +
            '<h2>Lot ' + lotNum + '</h2>' +
            '<div class="lot-detail-stats">' +
            lotDetailStat(stats.origHdIn, 'Orig Hd In') +
            lotDetailStat(stats.locLot, 'Current Hd') +
            lotDetailStat(stats.locPen, 'In Pen') +
            lotDetailStat(stats.locH, 'Hospital') +
            lotDetailStat(stats.locB, 'Loc B') +
            lotDetailStat(stats.locR, 'Loc R') +
            lotDetailStat(stats.sold, 'Sold') +
            lotDetailStat(stats.deadsNo, 'Deads') +
            lotDetailStat(stats.deadsPct + '%', 'Dead %') +
            lotDetailStat(stats.avgDof, 'Avg DOF') +
            '</div></div>';

        // Pen table for this lot
        var tableHtml = buildPenDetailTable(pens);

        content.innerHTML = headerHtml + tableHtml;
    }

    function lotDetailStat(value, label) {
        return '<div class="lot-detail-stat"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>';
    }

    function buildPenDetailTable(pens) {
        if (pens.length === 0) {
            return '<div class="empty-state"><p>No pens in this lot.</p></div>';
        }

        var html = '<table class="data-table"><thead><tr>';
        html += '<th>Pen</th><th>Trl</th><th>Prog</th><th>Sx</th>';
        html += '<th>Orig Hd In</th><th>Loc Lot</th><th>In Pen</th><th>H</th><th>B</th><th>R</th>';
        html += '<th>Sold</th><th>Deads</th><th>Dead%</th>';
        html += '<th>Avg Wt</th><th>DOF</th><th>EWT</th>';
        html += '<th>Date In</th><th>Date Out</th><th>Customer</th>';
        html += '</tr></thead><tbody>';

        pens.forEach(function (p) {
            html += '<tr>';
            html += '<td><strong>' + escapeHtml(p.pen || '') + '</strong></td>';
            html += '<td>' + escapeHtml(p.trl || '') + '</td>';
            html += '<td>' + escapeHtml(p.prog || '') + '</td>';
            html += '<td>' + escapeHtml(p.sex || '') + '</td>';
            html += '<td>' + (p.origHdIn || 0) + '</td>';
            html += '<td>' + (p.locLot || 0) + '</td>';
            html += '<td>' + (p.locPen || 0) + '</td>';
            html += '<td>' + (p.locH || 0) + '</td>';
            html += '<td>' + (p.locB || 0) + '</td>';
            html += '<td>' + (p.locR || 0) + '</td>';
            html += '<td>' + (p.sold || 0) + '</td>';
            html += '<td>' + (p.deadsNo || 0) + '</td>';
            html += '<td>' + (p.deadsPct != null ? p.deadsPct.toFixed(2) : '0.00') + '%</td>';
            html += '<td>' + (p.avgWt || '') + '</td>';
            html += '<td><strong>' + (p.dof || '') + '</strong></td>';
            html += '<td>' + (p.ewt || '') + '</td>';
            html += '<td>' + escapeHtml(p.dateIn || '') + '</td>';
            html += '<td>' + escapeHtml(p.dateOut || '') + '</td>';
            html += '<td>' + escapeHtml(p.customer || '') + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    // --- Alerts View ---
    function renderAlerts() {
        var alerts = Store.getAlerts();
        var container = document.getElementById('alerts-list');

        if (alerts.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128276;</div><p>No alerts yet.</p></div>';
            return;
        }

        var html = '';
        alerts.forEach(function (alert) {
            var unread = !alert.read ? 'unread' : '';
            var typeClass = 'alert-' + alert.type;
            html += '<div class="alert-item ' + unread + ' ' + typeClass + '" data-alert-id="' + alert.id + '">';
            html += '<span class="alert-icon">' + AlertSystem.getIcon(alert.type) + '</span>';
            html += '<div class="alert-body">';
            html += '<div class="alert-message">' + escapeHtml(alert.message) + '</div>';
            html += '<div class="alert-time">' + AlertSystem.formatTime(alert.timestamp) + '</div>';
            html += '</div>';
            if (!alert.read) {
                html += '<div class="alert-actions"><button class="btn btn-sm btn-mark-read" data-alert-id="' + alert.id + '">Mark Read</button></div>';
            }
            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll('.btn-mark-read').forEach(function (btn) {
            btn.addEventListener('click', function () {
                Store.markAlertRead(this.getAttribute('data-alert-id'));
                renderAlerts();
                AlertSystem.updateBadge();
            });
        });
    }

    // --- Reports View ---
    function renderReports() {
        renderLotSummaryReport();
        renderLocationReport();
        renderDaysOnFeedReport();
    }

    function renderLotSummaryReport() {
        var table = document.getElementById('capacity-report');
        var lots = Store.getLotsFromPens();

        if (lots.length === 0) {
            table.innerHTML = '<tbody><tr><td>No data. Import yard sheets first.</td></tr></tbody>';
            return;
        }

        var html = '<thead><tr><th>Lot</th><th>Pens</th><th>Orig Hd In</th><th>Current Hd</th><th>Sold</th><th>Deads</th><th>Dead %</th><th>Customer</th></tr></thead><tbody>';
        var totals = { origHdIn: 0, locLot: 0, sold: 0, deadsNo: 0, pens: 0 };

        lots.forEach(function (lot) {
            var deadsPct = lot.origHdIn > 0 ? ((lot.deadsNo / lot.origHdIn) * 100).toFixed(2) : '0.00';
            totals.origHdIn += lot.origHdIn;
            totals.locLot += lot.locLot;
            totals.sold += lot.sold;
            totals.deadsNo += lot.deadsNo;
            totals.pens += lot.pens.length;
            html += '<tr><td>Lot ' + lot.lotNum + '</td><td>' + lot.pens.length + '</td><td>' + lot.origHdIn + '</td><td>' + lot.locLot + '</td><td>' + lot.sold + '</td><td>' + lot.deadsNo + '</td><td>' + deadsPct + '%</td><td>' + escapeHtml(lot.customer || '') + '</td></tr>';
        });

        var totalDeadsPct = totals.origHdIn > 0 ? ((totals.deadsNo / totals.origHdIn) * 100).toFixed(2) : '0.00';
        html += '</tbody><tfoot><tr><td><strong>TOTAL (' + lots.length + ' lots)</strong></td><td><strong>' + totals.pens + '</strong></td><td><strong>' + totals.origHdIn.toLocaleString() + '</strong></td><td><strong>' + totals.locLot.toLocaleString() + '</strong></td><td><strong>' + totals.sold + '</strong></td><td><strong>' + totals.deadsNo + '</strong></td><td><strong>' + totalDeadsPct + '%</strong></td><td></td></tr></tfoot>';
        table.innerHTML = html;
    }

    function renderLocationReport() {
        var table = document.getElementById('status-report');
        var lots = Store.getLotsFromPens();

        if (lots.length === 0) {
            table.innerHTML = '<tbody><tr><td>No data.</td></tr></tbody>';
            return;
        }

        var html = '<thead><tr><th>Lot</th><th>Loc Lot (Total)</th><th>In Pen</th><th>Hospital (H)</th><th>Loc B</th><th>Loc R</th></tr></thead><tbody>';
        var totals = { locLot: 0, locPen: 0, locH: 0, locB: 0, locR: 0 };

        lots.forEach(function (lot) {
            totals.locLot += lot.locLot;
            totals.locPen += lot.locPen;
            totals.locH += lot.locH;
            totals.locB += lot.locB;
            totals.locR += lot.locR;
            html += '<tr><td>Lot ' + lot.lotNum + '</td><td>' + lot.locLot + '</td><td>' + lot.locPen + '</td><td>' + lot.locH + '</td><td>' + lot.locB + '</td><td>' + lot.locR + '</td></tr>';
        });

        html += '</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td><strong>' + totals.locLot + '</strong></td><td><strong>' + totals.locPen + '</strong></td><td><strong>' + totals.locH + '</strong></td><td><strong>' + totals.locB + '</strong></td><td><strong>' + totals.locR + '</strong></td></tr></tfoot>';
        table.innerHTML = html;
    }

    function renderDaysOnFeedReport() {
        var table = document.getElementById('dof-report');
        var pens = Store.getAllPens();

        if (pens.length === 0) {
            table.innerHTML = '<tbody><tr><td>No data.</td></tr></tbody>';
            return;
        }

        var buckets = {
            '0-60 days': 0,
            '61-120 days': 0,
            '121-180 days': 0,
            '181-240 days': 0,
            '241-300 days': 0,
            '300+ days': 0
        };

        pens.forEach(function (p) {
            var dof = p.dof || 0;
            if (dof <= 60) buckets['0-60 days']++;
            else if (dof <= 120) buckets['61-120 days']++;
            else if (dof <= 180) buckets['121-180 days']++;
            else if (dof <= 240) buckets['181-240 days']++;
            else if (dof <= 300) buckets['241-300 days']++;
            else buckets['300+ days']++;
        });

        var html = '<thead><tr><th>Days on Feed</th><th>Pen Count</th><th>% of Pens</th></tr></thead><tbody>';
        var total = pens.length;

        Object.keys(buckets).forEach(function (key) {
            var count = buckets[key];
            var pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
            html += '<tr><td>' + key + '</td><td>' + count + '</td><td>' + pct + '%</td></tr>';
        });

        html += '</tbody><tfoot><tr><td>TOTAL</td><td>' + total + '</td><td>100%</td></tr></tfoot>';
        table.innerHTML = html;
    }

    // --- Modals ---
    function initModals() {
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(function (btn) {
            btn.addEventListener('click', function () {
                this.closest('.modal').classList.add('hidden');
            });
        });

        document.querySelectorAll('.modal').forEach(function (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === this) this.classList.add('hidden');
            });
        });
    }

    // --- Event Handlers ---
    function initEventHandlers() {
        // Header import button opens import modal
        document.getElementById('btn-import-header').addEventListener('click', function () {
            resetImportModal();
            document.getElementById('modal-import').classList.remove('hidden');
        });

        // Alerts button navigates to alerts view
        document.getElementById('btn-alerts').addEventListener('click', function () {
            switchView('alerts');
        });

        // Mark all alerts read
        document.getElementById('btn-mark-all-read').addEventListener('click', function () {
            Store.markAllAlertsRead();
            renderAlerts();
            AlertSystem.updateBadge();
        });

        // Clear all alerts
        document.getElementById('btn-clear-alerts').addEventListener('click', function () {
            if (confirm('Clear all alerts? This cannot be undone.')) {
                Store.clearAlerts();
                renderAlerts();
                AlertSystem.updateBadge();
            }
        });

        // Lot selector change
        document.getElementById('lot-select').addEventListener('change', renderLotDetail);
    }

    // --- Helpers ---
    function populateLotDropdown() {
        var lots = Store.getLotsFromPens();
        var lotSelect = document.getElementById('lot-select');
        lotSelect.innerHTML = '';
        lots.forEach(function (lot) {
            var opt = document.createElement('option');
            opt.value = lot.lotNum;
            opt.textContent = 'Lot ' + lot.lotNum + (lot.customer ? ' - ' + lot.customer : '');
            lotSelect.appendChild(opt);
        });
    }

    function refreshCurrentView() {
        var activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) {
            switchView(activeTab.getAttribute('data-view'));
        }
        AlertSystem.updateBadge();
        updateHeaderSubtitle();
        populateLotDropdown();
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function debounce(fn, delay) {
        var timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, delay);
        };
    }

    // ============================================
    // LOT SHEET VIEW
    // ============================================

    function renderLotSheet() {
        var pens = Store.getAllPens();
        var search = document.getElementById('lotsheet-search').value.toLowerCase();
        var sexFilter = document.getElementById('lotsheet-sex-filter').value;
        var progFilter = document.getElementById('lotsheet-prog-filter').value;

        if (search) {
            pens = pens.filter(function (p) {
                return String(p.lotNum).indexOf(search) !== -1 ||
                    p.pen.toLowerCase().indexOf(search) !== -1 ||
                    (p.customer || '').toLowerCase().indexOf(search) !== -1 ||
                    p.trl.toLowerCase().indexOf(search) !== -1;
            });
        }

        if (sexFilter !== 'all') {
            pens = pens.filter(function (p) { return p.sex === sexFilter; });
        }

        if (progFilter !== 'all') {
            pens = pens.filter(function (p) { return p.prog === progFilter; });
        }

        // Sort by lot number
        pens.sort(function (a, b) { return a.lotNum - b.lotNum; });

        var container = document.getElementById('lotsheet-table-container');
        container.innerHTML = buildLotSheetTable(pens);
        attachLotSheetActions(container);
    }

    function buildLotSheetTable(pens) {
        if (pens.length === 0) {
            return '<div class="empty-state"><div class="empty-icon">&#128203;</div><p>No lot data found. Import yard sheet PDFs to populate the lot sheet.</p></div>';
        }

        var html = '<table class="lotsheet-table">';

        // Group header row
        html += '<thead>';
        html += '<tr class="lotsheet-group-row">';
        html += '<th colspan="6"></th>';
        html += '<th colspan="2" class="group-header">Capacity</th>';
        html += '<th colspan="5" class="group-header">Animal Info</th>';
        html += '<th colspan="2" class="group-header">Dates</th>';
        html += '<th></th>';
        html += '<th colspan="5" class="group-header">Location</th>';
        html += '<th></th>';
        html += '<th colspan="2" class="group-header">Deads</th>';
        html += '<th></th>';
        html += '<th colspan="3" class="group-header">Consumption (AsFed Lbs)</th>';
        html += '<th colspan="2" class="group-header">Charges</th>';
        html += '<th></th>';
        html += '<th></th>';
        html += '</tr>';

        // Column header row
        html += '<tr class="lotsheet-header-row">';
        html += '<th>Trl</th>';
        html += '<th>Srt</th>';
        html += '<th>Prog</th>';
        html += '<th>FO</th>';
        html += '<th>Lot</th>';
        html += '<th>Pen</th>';
        html += '<th>Sf/Hd</th>';
        html += '<th>Bunk In/Hd</th>';
        html += '<th>Sx</th>';
        html += '<th>AvWt</th>';
        html += '<th>DOF</th>';
        html += '<th>DORS</th>';
        html += '<th>EWT</th>';
        html += '<th>Date In</th>';
        html += '<th>Date Out</th>';
        html += '<th>Orig Hd In</th>';
        html += '<th>Lot</th>';
        html += '<th>Pen</th>';
        html += '<th>H</th>';
        html += '<th>B</th>';
        html += '<th>R</th>';
        html += '<th>Sold</th>';
        html += '<th>No</th>';
        html += '<th>%</th>';
        html += '<th>Ratn</th>';
        html += '<th>-1</th>';
        html += '<th>7d</th>';
        html += '<th>YTD</th>';
        html += '<th>Cur Chgs</th>';
        html += '<th>YTD Chgs</th>';
        html += '<th>Customer</th>';
        html += '<th>Actions</th>';
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        var totals = {
            sfPerHd: 0, origHdIn: 0, locLot: 0, locPen: 0, locH: 0, locB: 0, locR: 0,
            sold: 0, deadsNo: 0, count: pens.length
        };

        pens.forEach(function (p) {
            var dof = p.dof || calcDOF(p.dateIn);
            var dors = p.dors || (dof > 25 ? dof - 25 : 0);

            html += '<tr data-pen-id="' + p.id + '">';
            html += '<td>' + escapeHtml(p.trl || '') + '</td>';
            html += '<td>' + escapeHtml(p.srt || '') + '</td>';
            html += '<td>' + escapeHtml(p.prog || '') + '</td>';
            html += '<td>' + escapeHtml(p.fo || '') + '</td>';
            html += '<td class="cell-lot"><strong>' + (p.lotNum || '') + '</strong></td>';
            html += '<td class="cell-pen"><strong>' + escapeHtml(p.pen || '') + '</strong></td>';
            html += '<td class="cell-num">' + (p.sfPerHd || '') + '</td>';
            html += '<td class="cell-num">' + (p.bunkInPerHd || '') + '</td>';
            html += '<td class="cell-sex">' + escapeHtml(p.sex || '') + '</td>';
            html += '<td class="cell-num">' + (p.avgWt || '') + '</td>';
            html += '<td class="cell-num cell-dof"><strong>' + dof + '</strong></td>';
            html += '<td class="cell-num">' + dors + '</td>';
            html += '<td class="cell-num">' + (p.ewt || '') + '</td>';
            html += '<td class="cell-date">' + escapeHtml(p.dateIn || '') + '</td>';
            html += '<td class="cell-date">' + escapeHtml(p.dateOut || '') + '</td>';
            html += '<td class="cell-num">' + (p.origHdIn || '') + '</td>';
            html += '<td class="cell-num cell-loc">' + (p.locLot || '') + '</td>';
            html += '<td class="cell-num cell-loc">' + (p.locPen || '') + '</td>';
            html += '<td class="cell-num cell-loc">' + (p.locH || 0) + '</td>';
            html += '<td class="cell-num cell-loc">' + (p.locB || 0) + '</td>';
            html += '<td class="cell-num cell-loc">' + (p.locR || 0) + '</td>';
            html += '<td class="cell-num">' + (p.sold || 0) + '</td>';
            html += '<td class="cell-num cell-deads">' + (p.deadsNo || 0) + '</td>';
            html += '<td class="cell-num cell-deads">' + (p.deadsPct != null ? p.deadsPct.toFixed(2) : '0.00') + '</td>';
            html += '<td class="cell-ratn">' + escapeHtml(p.ratn || '') + '</td>';
            html += '<td class="cell-num cell-cons">' + (p.consNeg1 != null ? p.consNeg1.toFixed(1) : '') + '</td>';
            html += '<td class="cell-num cell-cons">' + (p.cons7d != null ? p.cons7d.toFixed(1) : '') + '</td>';
            html += '<td class="cell-num cell-cons">' + (p.consYtd != null ? p.consYtd.toFixed(1) : '') + '</td>';
            html += '<td class="cell-num cell-chgs">$' + (p.curChgs != null ? p.curChgs.toFixed(2) : '0.00') + '</td>';
            html += '<td class="cell-num cell-chgs">$' + (p.ytdChgs != null ? p.ytdChgs.toFixed(2) : '0.00') + '</td>';
            html += '<td>' + escapeHtml(p.customer || '') + '</td>';
            html += '<td class="action-btns">';
            html += '<button class="btn btn-sm btn-secondary btn-edit-pen" data-id="' + p.id + '">Edit</button> ';
            html += '<button class="btn btn-sm btn-danger btn-delete-pen" data-id="' + p.id + '">Del</button>';
            html += '</td>';
            html += '</tr>';

            totals.origHdIn += (p.origHdIn || 0);
            totals.locLot += (p.locLot || 0);
            totals.locPen += (p.locPen || 0);
            totals.locH += (p.locH || 0);
            totals.locB += (p.locB || 0);
            totals.locR += (p.locR || 0);
            totals.sold += (p.sold || 0);
            totals.deadsNo += (p.deadsNo || 0);
        });

        html += '</tbody>';

        // Footer totals
        var totalDeadsPct = totals.origHdIn > 0 ? ((totals.deadsNo / totals.origHdIn) * 100).toFixed(2) : '0.00';
        html += '<tfoot><tr>';
        html += '<td colspan="15"><strong>TOTALS (' + pens.length + ' lots)</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.origHdIn + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.locLot + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.locPen + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.locH + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.locB + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.locR + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.sold + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totals.deadsNo + '</strong></td>';
        html += '<td class="cell-num"><strong>' + totalDeadsPct + '</strong></td>';
        html += '<td colspan="7"></td>';
        html += '</tr></tfoot>';

        html += '</table>';
        return html;
    }

    function calcDOF(dateStr) {
        if (!dateStr) return 0;
        var parts = dateStr.split('/');
        if (parts.length < 3) return 0;
        var d = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        var now = new Date();
        return Math.floor((now - d) / (1000 * 60 * 60 * 24));
    }

    function attachLotSheetActions(container) {
        container.querySelectorAll('.btn-edit-pen').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openEditPen(this.getAttribute('data-id'));
            });
        });
        container.querySelectorAll('.btn-delete-pen').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = this.getAttribute('data-id');
                if (confirm('Delete this lot entry? This cannot be undone.')) {
                    Store.deletePen(id);
                    renderLotSheet();
                    refreshCurrentView();
                }
            });
        });
    }

    function openAddPen() {
        document.getElementById('modal-pen-title').textContent = 'Add Lot';
        document.getElementById('form-pen').reset();
        document.getElementById('pen-id').value = '';
        document.getElementById('pen-loch').value = '0';
        document.getElementById('pen-locb').value = '0';
        document.getElementById('pen-locr').value = '0';
        document.getElementById('pen-sold').value = '0';
        document.getElementById('pen-deadsno').value = '0';
        document.getElementById('pen-deadspct').value = '0';
        document.getElementById('modal-pen').classList.remove('hidden');
    }

    function openEditPen(id) {
        var pens = Store.getAllPens();
        var pen = pens.find(function (p) { return p.id === id; });
        if (!pen) return;

        document.getElementById('modal-pen-title').textContent = 'Edit Lot ' + pen.lotNum + ' - Pen ' + pen.pen;
        document.getElementById('pen-id').value = pen.id;
        document.getElementById('pen-trl').value = pen.trl || 'Ultra';
        document.getElementById('pen-srt').value = pen.srt || 'Strt';
        document.getElementById('pen-prog').value = pen.prog || 'HOL';
        document.getElementById('pen-lotnum').value = pen.lotNum || '';
        document.getElementById('pen-pen').value = pen.pen || '';
        document.getElementById('pen-sex').value = pen.sex || 'O';
        document.getElementById('pen-sfperhd').value = pen.sfPerHd || '';
        document.getElementById('pen-bunkinperhd').value = pen.bunkInPerHd || '';
        document.getElementById('pen-avgwt').value = pen.avgWt || '';
        document.getElementById('pen-ewt').value = pen.ewt || '';
        document.getElementById('pen-orighdin').value = pen.origHdIn || '';
        document.getElementById('pen-datein').value = pen.dateIn || '';
        document.getElementById('pen-dateout').value = pen.dateOut || '';
        document.getElementById('pen-loclot').value = pen.locLot || '';
        document.getElementById('pen-locpen').value = pen.locPen || '';
        document.getElementById('pen-loch').value = pen.locH || 0;
        document.getElementById('pen-locb').value = pen.locB || 0;
        document.getElementById('pen-locr').value = pen.locR || 0;
        document.getElementById('pen-sold').value = pen.sold || 0;
        document.getElementById('pen-deadsno').value = pen.deadsNo || 0;
        document.getElementById('pen-deadspct').value = pen.deadsPct || 0;
        document.getElementById('pen-consneg1').value = pen.consNeg1 || '';
        document.getElementById('pen-cons7d').value = pen.cons7d || '';
        document.getElementById('pen-consytd').value = pen.consYtd || '';
        document.getElementById('pen-curchgs').value = pen.curChgs || '';
        document.getElementById('pen-ytdchgs').value = pen.ytdChgs || '';
        document.getElementById('pen-customer').value = pen.customer || '';
        document.getElementById('modal-pen').classList.remove('hidden');
    }

    function initLotSheetHandlers() {
        // Add pen button
        document.getElementById('btn-add-pen').addEventListener('click', openAddPen);

        // Lot sheet search and filters
        document.getElementById('lotsheet-search').addEventListener('input', debounce(renderLotSheet, 300));
        document.getElementById('lotsheet-sex-filter').addEventListener('change', renderLotSheet);
        document.getElementById('lotsheet-prog-filter').addEventListener('change', renderLotSheet);

        // Add/Edit pen form
        document.getElementById('form-pen').addEventListener('submit', function (e) {
            e.preventDefault();
            var id = document.getElementById('pen-id').value;
            var data = {
                trl: document.getElementById('pen-trl').value,
                srt: document.getElementById('pen-srt').value,
                prog: document.getElementById('pen-prog').value,
                fo: '',
                lotNum: parseInt(document.getElementById('pen-lotnum').value, 10),
                pen: document.getElementById('pen-pen').value.trim(),
                sex: document.getElementById('pen-sex').value,
                sfPerHd: parseInt(document.getElementById('pen-sfperhd').value, 10) || 0,
                bunkInPerHd: parseFloat(document.getElementById('pen-bunkinperhd').value) || 0,
                avgWt: parseInt(document.getElementById('pen-avgwt').value, 10) || 0,
                ewt: parseInt(document.getElementById('pen-ewt').value, 10) || 0,
                origHdIn: parseInt(document.getElementById('pen-orighdin').value, 10) || 0,
                dateIn: document.getElementById('pen-datein').value.trim(),
                dateOut: document.getElementById('pen-dateout').value.trim(),
                locLot: parseInt(document.getElementById('pen-loclot').value, 10) || 0,
                locPen: parseInt(document.getElementById('pen-locpen').value, 10) || 0,
                locH: parseInt(document.getElementById('pen-loch').value, 10) || 0,
                locB: parseInt(document.getElementById('pen-locb').value, 10) || 0,
                locR: parseInt(document.getElementById('pen-locr').value, 10) || 0,
                sold: parseInt(document.getElementById('pen-sold').value, 10) || 0,
                deadsNo: parseInt(document.getElementById('pen-deadsno').value, 10) || 0,
                deadsPct: parseFloat(document.getElementById('pen-deadspct').value) || 0,
                ratn: '',
                consNeg1: parseFloat(document.getElementById('pen-consneg1').value) || 0,
                cons7d: parseFloat(document.getElementById('pen-cons7d').value) || 0,
                consYtd: parseFloat(document.getElementById('pen-consytd').value) || 0,
                curChgs: parseFloat(document.getElementById('pen-curchgs').value) || 0,
                ytdChgs: parseFloat(document.getElementById('pen-ytdchgs').value) || 0,
                customer: document.getElementById('pen-customer').value.trim()
            };

            // Calculate DOF and DORS
            data.dof = calcDOF(data.dateIn);
            data.dors = data.dof > 25 ? data.dof - 25 : 0;

            // Calculate deads %
            if (data.origHdIn > 0 && data.deadsNo > 0) {
                data.deadsPct = parseFloat(((data.deadsNo / data.origHdIn) * 100).toFixed(2));
            }

            if (id) {
                Store.updatePen(id, data);
            } else {
                Store.addPen(data);
            }

            document.getElementById('modal-pen').classList.add('hidden');
            renderLotSheet();
            refreshCurrentView();
        });

        // --- PDF Import Handlers ---
        initPDFImportHandlers();
    }

    // ============================================
    // PDF IMPORT HANDLERS
    // ============================================

    var _pendingImportPens = [];

    function initPDFImportHandlers() {
        var fileInput = document.getElementById('pdf-file-input');
        var importBtn = document.getElementById('btn-import-pdf');
        var browseBtn = document.getElementById('btn-browse-files');
        var dropzone = document.getElementById('import-dropzone');
        var cancelBtn = document.getElementById('btn-import-cancel');
        var saveBtn = document.getElementById('btn-import-save');

        // "Import PDFs" button in toolbar opens the import modal
        importBtn.addEventListener('click', function () {
            resetImportModal();
            document.getElementById('modal-import').classList.remove('hidden');
        });

        // "Browse Files" button inside modal triggers the file input
        browseBtn.addEventListener('click', function () {
            fileInput.click();
        });

        // File input change handler
        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                processImportFiles(fileInput.files);
            }
        });

        // Drag & drop handlers
        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                processImportFiles(e.dataTransfer.files);
            }
        });

        // Cancel import
        cancelBtn.addEventListener('click', function () {
            _pendingImportPens = [];
            document.getElementById('modal-import').classList.add('hidden');
        });

        // Save imported data
        saveBtn.addEventListener('click', function () {
            if (_pendingImportPens.length === 0) return;

            var replace = document.getElementById('import-replace').checked;
            var count = PDFImport.saveImportedPens(_pendingImportPens, replace);
            _pendingImportPens = [];
            document.getElementById('modal-import').classList.add('hidden');

            // Refresh everything
            refreshCurrentView();
            AlertSystem.showToast('Imported ' + count + ' lot records from yard sheets.', 'import');
        });
    }

    function resetImportModal() {
        _pendingImportPens = [];
        document.getElementById('import-dropzone').classList.remove('hidden');
        document.getElementById('import-processing').classList.add('hidden');
        document.getElementById('import-preview').classList.add('hidden');
        document.getElementById('import-replace').checked = false;
        document.getElementById('pdf-file-input').value = '';
    }

    function processImportFiles(files) {
        var dropzone = document.getElementById('import-dropzone');
        var processing = document.getElementById('import-processing');
        var statusText = document.getElementById('import-status-text');

        // Show processing state
        dropzone.classList.add('hidden');
        processing.classList.remove('hidden');

        var pdfCount = Array.from(files).filter(function (f) {
            return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        }).length;

        statusText.textContent = 'Reading ' + pdfCount + ' PDF file' + (pdfCount !== 1 ? 's' : '') + '...';

        PDFImport.importFiles(files).then(function (result) {
            processing.classList.add('hidden');
            _pendingImportPens = result.pens;
            showImportPreview(result);
        }).catch(function (err) {
            processing.classList.add('hidden');
            dropzone.classList.remove('hidden');
            AlertSystem.showToast('Import failed: ' + err.message, 'death');
        });
    }

    function showImportPreview(result) {
        var preview = document.getElementById('import-preview');
        preview.classList.remove('hidden');

        // Summary
        document.getElementById('import-file-count').textContent = result.fileCount + ' file' + (result.fileCount !== 1 ? 's' : '') + ' processed';
        document.getElementById('import-row-count').textContent = result.pens.length + ' lot record' + (result.pens.length !== 1 ? 's' : '') + ' found';

        // Errors
        var errorContainer = document.getElementById('import-errors');
        var errorCount = document.getElementById('import-error-count');
        if (result.errors.length > 0) {
            errorCount.classList.remove('hidden');
            errorCount.textContent = result.errors.length + ' error' + (result.errors.length !== 1 ? 's' : '');
            errorContainer.classList.remove('hidden');
            var errorHtml = '<div class="import-error-list">';
            result.errors.forEach(function (err) {
                errorHtml += '<div class="import-error-item">';
                errorHtml += '<strong>' + escapeHtml(err.file) + ':</strong> ' + escapeHtml(err.error);
                errorHtml += '</div>';
            });
            errorHtml += '</div>';
            errorContainer.innerHTML = errorHtml;
        } else {
            errorCount.classList.add('hidden');
            errorContainer.classList.add('hidden');
        }

        // Preview table
        var tableContainer = document.getElementById('import-preview-table');
        if (result.pens.length === 0) {
            tableContainer.innerHTML = '<div class="empty-state"><p>No lot data could be extracted from the PDF' + (result.fileCount !== 1 ? 's' : '') + '.</p>' +
                '<p style="font-size:0.8rem;color:var(--color-text-light);">The parser looks for tabular data with columns like Lot, Pen, DOF, Hd, Wt, Date. If your yard sheets use a different format, you can manually add lots or try a different file.</p></div>';
            document.getElementById('btn-import-save').disabled = true;
            return;
        }

        document.getElementById('btn-import-save').disabled = false;
        tableContainer.innerHTML = buildImportPreviewTable(result.pens);
    }

    function buildImportPreviewTable(pens) {
        var html = '<table class="lotsheet-table">';
        html += '<thead><tr class="lotsheet-header-row">';
        html += '<th>Source</th>';
        html += '<th>Trl</th><th>Srt</th><th>Prog</th>';
        html += '<th>Lot</th><th>Pen</th>';
        html += '<th>Sx</th><th>AvWt</th><th>DOF</th><th>EWT</th>';
        html += '<th>Date In</th><th>Date Out</th>';
        html += '<th>Orig Hd In</th>';
        html += '<th>Customer</th>';
        html += '</tr></thead><tbody>';

        pens.forEach(function (p) {
            html += '<tr>';
            html += '<td class="cell-date">' + escapeHtml(p._sourceFile || '') + '</td>';
            html += '<td>' + escapeHtml(p.trl || '') + '</td>';
            html += '<td>' + escapeHtml(p.srt || '') + '</td>';
            html += '<td>' + escapeHtml(p.prog || '') + '</td>';
            html += '<td class="cell-lot"><strong>' + (p.lotNum || '') + '</strong></td>';
            html += '<td class="cell-pen"><strong>' + escapeHtml(p.pen || '') + '</strong></td>';
            html += '<td class="cell-sex">' + escapeHtml(p.sex || '') + '</td>';
            html += '<td class="cell-num">' + (p.avgWt || '') + '</td>';
            html += '<td class="cell-num cell-dof"><strong>' + (p.dof || '') + '</strong></td>';
            html += '<td class="cell-num">' + (p.ewt || '') + '</td>';
            html += '<td class="cell-date">' + escapeHtml(p.dateIn || '') + '</td>';
            html += '<td class="cell-date">' + escapeHtml(p.dateOut || '') + '</td>';
            html += '<td class="cell-num">' + (p.origHdIn || '') + '</td>';
            html += '<td>' + escapeHtml(p.customer || '') + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }
})();
