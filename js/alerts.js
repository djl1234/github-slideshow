/**
 * Cattle Feed Lot Monitor - Alert System
 * Handles alert generation and toast notifications.
 */
const AlertSystem = (function () {

    const ALERT_ICONS = {
        processing: '&#9888;&#65039;',  // warning
        death: '&#10060;',              // red X
        medical: '&#128138;',           // syringe
        pregnancy: '&#128149;',         // heart
        capacity: '&#128230;',          // package
        move: '&#128666;'              // truck
    };

    function getIcon(type) {
        return ALERT_ICONS[type] || '&#128276;';
    }

    /**
     * Create an alert when cattle status changes
     */
    function onStatusChange(animal, oldStatus, newStatus) {
        const lotName = 'Lot ' + animal.lotId;
        let type, message;

        switch (newStatus) {
            case 'processing':
                type = 'processing';
                message = `ALERT: Tag #${animal.tagNumber} moved to PROCESSING from ${lotName}. Was ${oldStatus}.`;
                break;
            case 'deceased':
                type = 'death';
                message = `ALERT: Tag #${animal.tagNumber} reported DECEASED in ${lotName}. Was ${oldStatus}.`;
                break;
            case 'medical':
                type = 'medical';
                message = `Tag #${animal.tagNumber} placed in MEDICAL CARE in ${lotName}.`;
                break;
            case 'pregnant':
                type = 'pregnancy';
                message = `Pregnancy confirmed for Tag #${animal.tagNumber} in ${lotName}.`;
                break;
            case 'active':
                type = 'move';
                message = `Tag #${animal.tagNumber} returned to ACTIVE status in ${lotName}. Was ${oldStatus}.`;
                break;
            default:
                type = 'move';
                message = `Tag #${animal.tagNumber} status changed to ${newStatus} in ${lotName}.`;
        }

        const alert = Store.addAlert({
            type,
            lotId: animal.lotId,
            cattleId: animal.id,
            tagNumber: animal.tagNumber,
            message
        });

        showToast(message, type);
        updateBadge();
        return alert;
    }

    /**
     * Create an alert when cattle is moved between lots
     */
    function onCattleMoved(animal, oldLotId, newLotId) {
        const message = `Tag #${animal.tagNumber} moved from Lot ${oldLotId} to Lot ${newLotId}.`;
        const alert = Store.addAlert({
            type: 'move',
            lotId: newLotId,
            cattleId: animal.id,
            tagNumber: animal.tagNumber,
            message
        });
        showToast(message, 'info');
        updateBadge();
        return alert;
    }

    /**
     * Check lot capacity and alert if near full
     */
    function checkCapacity(lotId) {
        const stats = Store.getLotStats(lotId);
        const pct = (stats.total / Store.LOT_CAPACITY) * 100;

        if (pct >= 95) {
            const message = `Lot ${lotId} is at ${pct.toFixed(0)}% capacity (${stats.total}/${Store.LOT_CAPACITY}). Nearly FULL!`;
            Store.addAlert({
                type: 'capacity',
                lotId,
                message
            });
            showToast(message, 'warning');
            updateBadge();
        } else if (pct >= 85) {
            const message = `Lot ${lotId} is at ${pct.toFixed(0)}% capacity (${stats.total}/${Store.LOT_CAPACITY}).`;
            Store.addAlert({
                type: 'capacity',
                lotId,
                message
            });
            updateBadge();
        }
    }

    /**
     * Show toast notification
     */
    function showToast(message, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + (type === 'death' ? 'danger' : type === 'processing' ? 'warning' : 'info');

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.innerHTML = getIcon(type);

        const msg = document.createElement('span');
        msg.className = 'toast-message';
        msg.textContent = message;

        const close = document.createElement('button');
        close.className = 'toast-close';
        close.innerHTML = '&times;';
        close.addEventListener('click', () => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        });

        toast.appendChild(icon);
        toast.appendChild(msg);
        toast.appendChild(close);
        container.appendChild(toast);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, 6000);
    }

    /**
     * Update the alert badge count in the header
     */
    function updateBadge() {
        const badge = document.getElementById('alert-badge');
        const count = Store.getUnreadCount();
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    /**
     * Format a timestamp for display
     */
    function formatTime(isoString) {
        const d = new Date(isoString);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + 'm ago';
        if (diffHours < 24) return diffHours + 'h ago';
        if (diffDays < 7) return diffDays + 'd ago';
        return d.toLocaleDateString();
    }

    return {
        onStatusChange,
        onCattleMoved,
        checkCapacity,
        showToast,
        updateBadge,
        formatTime,
        getIcon
    };
})();
