/**
 * Cattle Feed Lot Monitor - Main Application
 * Handles UI rendering, navigation, and user interactions.
 */
(function () {
    'use strict';

    // --- Initialize ---
    document.addEventListener('DOMContentLoaded', function () {
        if (!Store.isInitialized()) {
            Store.seedDemoData();
        }
        initNavigation();
        initModals();
        initEventHandlers();
        renderDashboard();
        AlertSystem.updateBadge();
        populateLotDropdowns();
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
            case 'lots': renderLotDetail(); break;
            case 'cattle': renderCattleTable(); break;
            case 'alerts': renderAlerts(); break;
            case 'reports': renderReports(); break;
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
        container.innerHTML = [
            summaryCard(stats.totalOccupied.toLocaleString(), 'Total Head On Feed', ''),
            summaryCard(stats.totalAvailable.toLocaleString(), 'Available Openings', 'card-info'),
            summaryCard(stats.active.toLocaleString(), 'Active', ''),
            summaryCard(stats.processing.toLocaleString(), 'Processing', 'card-warning'),
            summaryCard(stats.deceased.toLocaleString(), 'Deceased', 'card-danger'),
            summaryCard(stats.medical.toLocaleString(), 'Medical Care', 'card-medical'),
            summaryCard(stats.pregnant.toLocaleString(), 'Pregnant', 'card-pregnant')
        ].join('');
    }

    function summaryCard(value, label, extraClass) {
        return '<div class="summary-card ' + extraClass + '">' +
            '<div class="card-value">' + value + '</div>' +
            '<div class="card-label">' + label + '</div></div>';
    }

    function renderLotsGrid() {
        var container = document.getElementById('lots-grid');
        var lots = Store.getLots();
        var html = '';
        lots.forEach(function (lot) {
            var stats = Store.getLotStats(lot.id);
            var pct = (stats.total / lot.capacity) * 100;
            var fillClass = pct >= 95 ? 'full' : pct >= 80 ? 'high' : '';

            html += '<div class="lot-card" data-lot-id="' + lot.id + '">' +
                '<div class="lot-card-header"><h3>' + lot.name + '</h3>' +
                '<span class="lot-count">' + stats.total + ' / ' + lot.capacity + '</span></div>' +
                '<div class="lot-card-body">' +
                '<div class="capacity-bar"><div class="capacity-fill ' + fillClass + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
                '<div class="lot-stats">' +
                lotStatItem('Active', stats.active) +
                lotStatItem('Available', stats.available) +
                lotStatItem('Medical', stats.medical) +
                lotStatItem('Pregnant', stats.pregnant) +
                lotStatItem('Processing', stats.processing) +
                lotStatItem('Deceased', stats.deceased) +
                '</div></div></div>';
        });
        container.innerHTML = html;

        // Click handler to navigate to lot detail
        container.querySelectorAll('.lot-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var lotId = parseInt(this.getAttribute('data-lot-id'), 10);
                document.getElementById('lot-select').value = lotId;
                switchView('lots');
            });
        });
    }

    function lotStatItem(label, value) {
        return '<div class="lot-stat"><span class="stat-label">' + label + '</span><span class="stat-value">' + value + '</span></div>';
    }

    // --- Lot Detail ---
    function renderLotDetail() {
        var lotId = parseInt(document.getElementById('lot-select').value, 10) || 1;
        var stats = Store.getLotStats(lotId);
        var cattle = Store.getCattleByLot(lotId);
        var lot = Store.getLots().find(function (l) { return l.id === lotId; });
        var pct = ((stats.total / lot.capacity) * 100).toFixed(1);

        var content = document.getElementById('lot-detail-content');

        var headerHtml = '<div class="lot-detail-header">' +
            '<h2>' + lot.name + '</h2>' +
            '<div class="capacity-bar" style="margin:12px 0"><div class="capacity-fill ' +
            (pct >= 95 ? 'full' : pct >= 80 ? 'high' : '') +
            '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
            '<div class="lot-detail-stats">' +
            lotDetailStat(stats.total, 'Occupied') +
            lotDetailStat(stats.available, 'Available') +
            lotDetailStat(pct + '%', 'Capacity') +
            lotDetailStat(stats.active, 'Active') +
            lotDetailStat(stats.medical, 'Medical') +
            lotDetailStat(stats.pregnant, 'Pregnant') +
            lotDetailStat(stats.processing, 'Processing') +
            lotDetailStat(stats.deceased, 'Deceased') +
            '</div></div>';

        // Cattle in this lot that are still occupying space
        var activeCattle = cattle.filter(function (c) {
            return c.status === 'active' || c.status === 'medical' || c.status === 'pregnant';
        });

        var tableHtml = buildCattleTable(activeCattle, true);

        content.innerHTML = headerHtml + tableHtml;
        attachTableActions(content);
    }

    function lotDetailStat(value, label) {
        return '<div class="lot-detail-stat"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>';
    }

    // --- All Cattle Table ---
    function renderCattleTable() {
        var cattle = Store.getAllCattle();
        var search = document.getElementById('cattle-search').value.toLowerCase();
        var statusFilter = document.getElementById('cattle-status-filter').value;
        var lotFilter = document.getElementById('cattle-lot-filter').value;

        if (search) {
            cattle = cattle.filter(function (c) {
                return c.tagNumber.toLowerCase().indexOf(search) !== -1 ||
                    c.breed.toLowerCase().indexOf(search) !== -1 ||
                    ('lot ' + c.lotId).indexOf(search) !== -1;
            });
        }

        if (statusFilter !== 'all') {
            cattle = cattle.filter(function (c) { return c.status === statusFilter; });
        }

        if (lotFilter !== 'all') {
            cattle = cattle.filter(function (c) { return c.lotId === parseInt(lotFilter, 10); });
        }

        // Sort by lot, then tag
        cattle.sort(function (a, b) {
            if (a.lotId !== b.lotId) return a.lotId - b.lotId;
            return a.tagNumber.localeCompare(b.tagNumber);
        });

        var container = document.getElementById('cattle-table-container');
        container.innerHTML = buildCattleTable(cattle, false);
        attachTableActions(container);
    }

    function buildCattleTable(cattle, hideLotColumn) {
        if (cattle.length === 0) {
            return '<div class="empty-state"><div class="empty-icon">&#128004;</div><p>No cattle found.</p></div>';
        }

        var html = '<table class="data-table"><thead><tr>';
        html += '<th>Tag #</th>';
        if (!hideLotColumn) html += '<th>Lot</th>';
        html += '<th>Breed</th><th>Weight (lbs)</th><th>Status</th><th>Days on Feed</th><th>Date On Feed</th><th>Actions</th>';
        html += '</tr></thead><tbody>';

        cattle.forEach(function (c) {
            var dof = Store.getDaysOnFeed(c.dateAdded);
            html += '<tr data-id="' + c.id + '">';
            html += '<td><strong>' + escapeHtml(c.tagNumber) + '</strong></td>';
            if (!hideLotColumn) html += '<td>Lot ' + c.lotId + '</td>';
            html += '<td>' + escapeHtml(c.breed || '-') + '</td>';
            html += '<td>' + (c.weight ? c.weight.toLocaleString() : '-') + '</td>';
            html += '<td><span class="status-badge status-' + c.status + '">' + c.status + '</span></td>';
            html += '<td><strong>' + dof + '</strong> days</td>';
            html += '<td>' + formatDate(c.dateAdded) + '</td>';
            html += '<td class="action-btns">';
            html += '<button class="btn btn-sm btn-secondary btn-edit" data-id="' + c.id + '">Edit</button> ';
            html += '<button class="btn btn-sm btn-secondary btn-status" data-id="' + c.id + '">Status</button> ';
            html += '<button class="btn btn-sm btn-secondary btn-move" data-id="' + c.id + '">Move</button>';
            html += '</td></tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    function attachTableActions(container) {
        container.querySelectorAll('.btn-edit').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openEditCattle(this.getAttribute('data-id'));
            });
        });
        container.querySelectorAll('.btn-status').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openChangeStatus(this.getAttribute('data-id'));
            });
        });
        container.querySelectorAll('.btn-move').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openMoveCattle(this.getAttribute('data-id'));
            });
        });
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
        renderCapacityReport();
        renderStatusReport();
        renderDaysOnFeedReport();
    }

    function renderCapacityReport() {
        var table = document.getElementById('capacity-report');
        var lots = Store.getLots();
        var html = '<thead><tr><th>Lot</th><th>Capacity</th><th>Occupied</th><th>Available</th><th>% Full</th></tr></thead><tbody>';
        var totalOccupied = 0;
        var totalAvailable = 0;
        var totalCapacity = 0;

        lots.forEach(function (lot) {
            var stats = Store.getLotStats(lot.id);
            var pct = ((stats.total / lot.capacity) * 100).toFixed(1);
            totalOccupied += stats.total;
            totalAvailable += stats.available;
            totalCapacity += lot.capacity;
            html += '<tr><td>' + lot.name + '</td><td>' + lot.capacity + '</td><td>' + stats.total + '</td><td>' + stats.available + '</td><td>' + pct + '%</td></tr>';
        });

        var totalPct = ((totalOccupied / totalCapacity) * 100).toFixed(1);
        html += '</tbody><tfoot><tr><td>TOTAL</td><td>' + totalCapacity.toLocaleString() + '</td><td>' + totalOccupied.toLocaleString() + '</td><td>' + totalAvailable.toLocaleString() + '</td><td>' + totalPct + '%</td></tr></tfoot>';
        table.innerHTML = html;
    }

    function renderStatusReport() {
        var table = document.getElementById('status-report');
        var lots = Store.getLots();
        var html = '<thead><tr><th>Lot</th><th>Active</th><th>Medical</th><th>Pregnant</th><th>Processing</th><th>Deceased</th></tr></thead><tbody>';
        var totals = { active: 0, medical: 0, pregnant: 0, processing: 0, deceased: 0 };

        lots.forEach(function (lot) {
            var stats = Store.getLotStats(lot.id);
            totals.active += stats.active;
            totals.medical += stats.medical;
            totals.pregnant += stats.pregnant;
            totals.processing += stats.processing;
            totals.deceased += stats.deceased;
            html += '<tr><td>' + lot.name + '</td><td>' + stats.active + '</td><td>' + stats.medical + '</td><td>' + stats.pregnant + '</td><td>' + stats.processing + '</td><td>' + stats.deceased + '</td></tr>';
        });

        html += '</tbody><tfoot><tr><td>TOTAL</td><td>' + totals.active + '</td><td>' + totals.medical + '</td><td>' + totals.pregnant + '</td><td>' + totals.processing + '</td><td>' + totals.deceased + '</td></tr></tfoot>';
        table.innerHTML = html;
    }

    function renderDaysOnFeedReport() {
        var table = document.getElementById('dof-report');
        var cattle = Store.getAllCattle().filter(function (c) {
            return c.status === 'active' || c.status === 'medical' || c.status === 'pregnant';
        });

        var buckets = {
            '0-30 days': 0,
            '31-60 days': 0,
            '61-90 days': 0,
            '91-120 days': 0,
            '121-150 days': 0,
            '151-180 days': 0,
            '180+ days': 0
        };

        cattle.forEach(function (c) {
            var dof = Store.getDaysOnFeed(c.dateAdded);
            if (dof <= 30) buckets['0-30 days']++;
            else if (dof <= 60) buckets['31-60 days']++;
            else if (dof <= 90) buckets['61-90 days']++;
            else if (dof <= 120) buckets['91-120 days']++;
            else if (dof <= 150) buckets['121-150 days']++;
            else if (dof <= 180) buckets['151-180 days']++;
            else buckets['180+ days']++;
        });

        var html = '<thead><tr><th>Days on Feed</th><th>Head Count</th><th>% of Active Herd</th></tr></thead><tbody>';
        var total = cattle.length;

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
        // Close modal on X or Cancel
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(function (btn) {
            btn.addEventListener('click', function () {
                this.closest('.modal').classList.add('hidden');
            });
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(function (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === this) this.classList.add('hidden');
            });
        });
    }

    function openAddCattle() {
        document.getElementById('modal-cattle-title').textContent = 'Add Cattle';
        var form = document.getElementById('form-cattle');
        form.reset();
        document.getElementById('cattle-id').value = '';
        document.getElementById('cattle-date-added').value = new Date().toISOString().split('T')[0];
        populateFormLotDropdown('cattle-lot');
        document.getElementById('modal-cattle').classList.remove('hidden');
    }

    function openEditCattle(id) {
        var animal = Store.getCattleById(id);
        if (!animal) return;

        document.getElementById('modal-cattle-title').textContent = 'Edit Cattle - ' + animal.tagNumber;
        document.getElementById('cattle-id').value = animal.id;
        document.getElementById('cattle-tag').value = animal.tagNumber;
        document.getElementById('cattle-breed').value = animal.breed || '';
        document.getElementById('cattle-weight').value = animal.weight || '';
        document.getElementById('cattle-date-added').value = animal.dateAdded;
        document.getElementById('cattle-status').value = animal.status;
        document.getElementById('cattle-notes').value = animal.notes || '';
        populateFormLotDropdown('cattle-lot');
        document.getElementById('cattle-lot').value = animal.lotId;
        document.getElementById('modal-cattle').classList.remove('hidden');
    }

    function openChangeStatus(id) {
        var animal = Store.getCattleById(id);
        if (!animal) return;

        document.getElementById('status-cattle-id').value = animal.id;
        document.getElementById('status-cattle-info').textContent = 'Tag #' + animal.tagNumber + ' in Lot ' + animal.lotId + ' (currently ' + animal.status + ')';
        document.getElementById('new-status').value = animal.status;
        document.getElementById('status-notes').value = '';
        document.getElementById('modal-status').classList.remove('hidden');
    }

    function openMoveCattle(id) {
        var animal = Store.getCattleById(id);
        if (!animal) return;

        document.getElementById('move-cattle-id').value = animal.id;
        document.getElementById('move-cattle-info').textContent = 'Tag #' + animal.tagNumber + ' currently in Lot ' + animal.lotId;

        var select = document.getElementById('move-target-lot');
        select.innerHTML = '';
        Store.getLots().forEach(function (lot) {
            if (lot.id !== animal.lotId) {
                var stats = Store.getLotStats(lot.id);
                var opt = document.createElement('option');
                opt.value = lot.id;
                opt.textContent = lot.name + ' (' + stats.available + ' available)';
                select.appendChild(opt);
            }
        });

        document.getElementById('modal-move').classList.remove('hidden');
    }

    // --- Event Handlers ---
    function initEventHandlers() {
        // Add cattle button
        document.getElementById('btn-add-cattle').addEventListener('click', openAddCattle);

        // Alerts button navigates to alerts view
        document.getElementById('btn-alerts').addEventListener('click', function () {
            switchView('alerts');
        });

        // Add/Edit cattle form
        document.getElementById('form-cattle').addEventListener('submit', function (e) {
            e.preventDefault();
            var id = document.getElementById('cattle-id').value;
            var data = {
                tagNumber: document.getElementById('cattle-tag').value,
                lotId: document.getElementById('cattle-lot').value,
                breed: document.getElementById('cattle-breed').value,
                weight: document.getElementById('cattle-weight').value,
                dateAdded: document.getElementById('cattle-date-added').value,
                status: document.getElementById('cattle-status').value,
                notes: document.getElementById('cattle-notes').value
            };

            if (id) {
                // Edit existing
                var oldAnimal = Store.getCattleById(id);
                var oldStatus = oldAnimal.status;
                Store.updateCattle(id, data);
                if (data.status !== oldStatus) {
                    var updated = Store.getCattleById(id);
                    AlertSystem.onStatusChange(updated, oldStatus, data.status);
                }
            } else {
                // Add new
                var lotStats = Store.getLotStats(parseInt(data.lotId, 10));
                if (lotStats.available <= 0) {
                    AlertSystem.showToast('Lot ' + data.lotId + ' is FULL. Cannot add cattle.', 'death');
                    return;
                }
                var newAnimal = Store.addCattle(data);
                if (data.status !== 'active') {
                    AlertSystem.onStatusChange(newAnimal, 'new', data.status);
                }
                AlertSystem.checkCapacity(parseInt(data.lotId, 10));
            }

            document.getElementById('modal-cattle').classList.add('hidden');
            refreshCurrentView();
        });

        // Change status form
        document.getElementById('form-status').addEventListener('submit', function (e) {
            e.preventDefault();
            var id = document.getElementById('status-cattle-id').value;
            var newStatus = document.getElementById('new-status').value;
            var notes = document.getElementById('status-notes').value;

            var result = Store.changeStatus(id, newStatus, notes);
            if (result) {
                AlertSystem.onStatusChange(result.animal, result.oldStatus, result.newStatus);
                AlertSystem.checkCapacity(result.animal.lotId);
            }

            document.getElementById('modal-status').classList.add('hidden');
            refreshCurrentView();
        });

        // Move cattle form
        document.getElementById('form-move').addEventListener('submit', function (e) {
            e.preventDefault();
            var id = document.getElementById('move-cattle-id').value;
            var newLotId = document.getElementById('move-target-lot').value;

            var result = Store.moveCattle(id, newLotId);
            if (result) {
                AlertSystem.onCattleMoved(result.animal, result.oldLotId, result.newLotId);
                AlertSystem.checkCapacity(result.newLotId);
            }

            document.getElementById('modal-move').classList.add('hidden');
            refreshCurrentView();
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

        // Cattle search and filters
        document.getElementById('cattle-search').addEventListener('input', debounce(renderCattleTable, 300));
        document.getElementById('cattle-status-filter').addEventListener('change', renderCattleTable);
        document.getElementById('cattle-lot-filter').addEventListener('change', renderCattleTable);
    }

    // --- Helpers ---
    function populateLotDropdowns() {
        var lots = Store.getLots();

        // Lot select in Lot Detail view
        var lotSelect = document.getElementById('lot-select');
        lotSelect.innerHTML = '';
        lots.forEach(function (lot) {
            var opt = document.createElement('option');
            opt.value = lot.id;
            opt.textContent = lot.name;
            lotSelect.appendChild(opt);
        });

        // Lot filter in All Cattle view
        var lotFilter = document.getElementById('cattle-lot-filter');
        var firstOpt = lotFilter.querySelector('option[value="all"]');
        lotFilter.innerHTML = '';
        lotFilter.appendChild(firstOpt || createOption('all', 'All Lots'));
        lots.forEach(function (lot) {
            lotFilter.appendChild(createOption(lot.id, lot.name));
        });
    }

    function populateFormLotDropdown(selectId) {
        var select = document.getElementById(selectId);
        select.innerHTML = '';
        Store.getLots().forEach(function (lot) {
            var stats = Store.getLotStats(lot.id);
            var opt = document.createElement('option');
            opt.value = lot.id;
            opt.textContent = lot.name + ' (' + stats.available + ' available)';
            select.appendChild(opt);
        });
    }

    function createOption(value, text) {
        var opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        return opt;
    }

    function refreshCurrentView() {
        var activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) {
            switchView(activeTab.getAttribute('data-view'));
        }
        AlertSystem.updateBadge();
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function debounce(fn, delay) {
        var timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, delay);
        };
    }
})();
