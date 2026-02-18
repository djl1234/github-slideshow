/**
 * Cattle Feed Lot Monitor - Alert System
 * Handles alert generation and toast notifications.
 */
const AlertSystem = (function () {

    const ALERT_ICONS = {
        import: '&#128196;',           // document
        death: '&#10060;',             // red X
        medical: '&#128138;',          // syringe
        capacity: '&#128230;',         // package
        info: '&#128276;'              // bell
    };

    function getIcon(type) {
        return ALERT_ICONS[type] || '&#128276;';
    }

    /**
     * Create an alert for high death loss on a lot
     */
    function checkDeathLoss(lotNum, deadsPct) {
        if (deadsPct >= 4.0) {
            var message = 'Lot ' + lotNum + ' has ' + deadsPct.toFixed(2) + '% death loss.';
            Store.addAlert({ type: 'death', lotNum: lotNum, message: message });
            showToast(message, 'death');
            updateBadge();
        }
    }

    /**
     * Show toast notification
     */
    function showToast(message, type) {
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + (type === 'death' ? 'danger' : type === 'warning' ? 'warning' : 'info');

        var icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.innerHTML = getIcon(type);

        var msg = document.createElement('span');
        msg.className = 'toast-message';
        msg.textContent = message;

        var close = document.createElement('button');
        close.className = 'toast-close';
        close.innerHTML = '&times;';
        close.addEventListener('click', function () {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(function () { toast.remove(); }, 300);
        });

        toast.appendChild(icon);
        toast.appendChild(msg);
        toast.appendChild(close);
        container.appendChild(toast);

        // Auto-dismiss after 6 seconds
        setTimeout(function () {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(function () { toast.remove(); }, 300);
            }
        }, 6000);
    }

    /**
     * Update the alert badge count in the header
     */
    function updateBadge() {
        var badge = document.getElementById('alert-badge');
        var count = Store.getUnreadCount();
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
        var d = new Date(isoString);
        var now = new Date();
        var diffMs = now - d;
        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + 'm ago';
        if (diffHours < 24) return diffHours + 'h ago';
        if (diffDays < 7) return diffDays + 'd ago';
        return d.toLocaleDateString();
    }

    return {
        checkDeathLoss: checkDeathLoss,
        showToast: showToast,
        updateBadge: updateBadge,
        formatTime: formatTime,
        getIcon: getIcon
    };
})();
