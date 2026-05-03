// static/js/popup.js
// CLDD — Custom Popup System
// Replaces all native alert() / confirm() calls with branded UI components.
//
// Public API:
//   CLDD.toast(message, type, duration)   → non-blocking toast (bottom-center)
//   CLDD.alert(options)                   → modal with one OK button  → Promise<void>
//   CLDD.confirm(options)                 → modal with OK + Cancel    → Promise<boolean>
//
// Types for toast/alert: 'info' | 'success' | 'error' | 'warning'

'use strict';

(function () {

    // ── Inject shared styles once ────────────────────────────────
    const STYLE_ID = 'cldd-popup-styles';
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `

/* ── Keyframes ────────────────────────────────────── */
@keyframes cldd-slide-up {
    from { opacity: 0; transform: translateY(16px) translateX(-50%); }
    to   { opacity: 1; transform: translateY(0)    translateX(-50%); }
}
@keyframes cldd-slide-down {
    from { opacity: 1; transform: translateY(0)    translateX(-50%); }
    to   { opacity: 0; transform: translateY(16px) translateX(-50%); }
}
@keyframes cldd-modal-in {
    from { opacity: 0; transform: scale(0.94) translateY(12px); }
    to   { opacity: 1; transform: scale(1)    translateY(0); }
}
@keyframes cldd-modal-out {
    from { opacity: 1; transform: scale(1)    translateY(0); }
    to   { opacity: 0; transform: scale(0.94) translateY(12px); }
}
@keyframes cldd-backdrop-in  { from { opacity:0 } to { opacity:1 } }
@keyframes cldd-backdrop-out { from { opacity:1 } to { opacity:0 } }

/* ── Toast ────────────────────────────────────────── */
.cldd-toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    white-space: nowrap;
    max-width: calc(100vw - 40px);
    white-space: normal;
    text-align: center;
    animation: cldd-slide-up 0.28s cubic-bezier(.34,1.56,.64,1) forwards;
    pointer-events: none;
}
.cldd-toast.leaving {
    animation: cldd-slide-down 0.22s ease-in forwards;
}
.cldd-toast-icon { font-size: 17px; flex-shrink: 0; }
.cldd-toast.type-info    { background: #334155; }
.cldd-toast.type-success { background: #059669; }
.cldd-toast.type-error   { background: #dc2626; }
.cldd-toast.type-warning { background: #d97706; }

/* ── Backdrop ─────────────────────────────────────── */
.cldd-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: cldd-backdrop-in 0.2s ease forwards;
}
.cldd-backdrop.leaving {
    animation: cldd-backdrop-out 0.18s ease forwards;
}

/* ── Modal box ────────────────────────────────────── */
.cldd-modal {
    background: #fff;
    border-radius: 24px;
    padding: 36px 32px 28px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    animation: cldd-modal-in 0.28s cubic-bezier(.34,1.56,.64,1) forwards;
    text-align: center;
}
.cldd-modal.leaving {
    animation: cldd-modal-out 0.18s ease forwards;
}

/* Title */
.cldd-modal-title {
    font-size: 19px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 10px;
    line-height: 1.3;
}

/* Body */
.cldd-modal-body {
    font-size: 14px;
    color: #475569;
    line-height: 1.65;
    margin-bottom: 28px;
}

/* Button row */
.cldd-modal-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
}

/* Buttons */
.cldd-btn {
    flex: 1;
    padding: 11px 18px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity .15s, transform .1s;
    max-width: 160px;
}
.cldd-btn:hover  { opacity: .88; }
.cldd-btn:active { transform: scale(.97); }

.cldd-btn-primary.type-info    { background:#3b82f6; color:#fff; }
.cldd-btn-primary.type-success { background:#059669; color:#fff; }
.cldd-btn-primary.type-error   { background:#dc2626; color:#fff; }
.cldd-btn-primary.type-warning { background:#d97706; color:#fff; }

.cldd-btn-secondary {
    background: #f1f5f9;
    color: #475569;
    border: 1.5px solid #e2e8f0;
}
        `;
        document.head.appendChild(style);
    }

    // ── Helpers ──────────────────────────────────────────────────

    const ICONS = {
        info:    '<i class="ri-information-line"></i>',
        success: '<i class="ri-check-line"></i>',
        error:   '<i class="ri-error-warning-line"></i>',
        warning: '<i class="ri-warning-line"></i>',
    };

    function getIcon(type) {
        return ICONS[type] || ICONS.info;
    }

    /** Remove an element after its leaving animation finishes. */
    function removeAfterAnim(el, duration = 220) {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), duration);
    }

    // ── Toast ────────────────────────────────────────────────────
    // Stack management: keep track of active toasts so they don't overlap.
    const _toasts = [];

    /**
     * Show a non-blocking toast notification.
     *
     * @param {string} message   Text to display.
     * @param {'info'|'success'|'error'|'warning'} [type='info']
     * @param {number} [duration=3500]  Auto-dismiss delay in ms.
     */
    function toast(message, type = 'info', duration = 3500) {
        // Remove any existing toast of the same type immediately
        _toasts.forEach((t) => { if (t._type === type) dismissToast(t); });

        const el = document.createElement('div');
        el._type = type;
        el.className = `cldd-toast type-${type}`;
        el.innerHTML = `
            <span>${message}</span>
        `;

        // Offset vertically if other toasts are showing
        const offset = _toasts.length * 56;
        el.style.bottom = `${28 + offset}px`;

        document.body.appendChild(el);
        _toasts.push(el);

        const timer = setTimeout(() => dismissToast(el), duration);
        el._timer = timer;

        // Click to dismiss early
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            clearTimeout(el._timer);
            dismissToast(el);
        });
    }

    function dismissToast(el) {
        const idx = _toasts.indexOf(el);
        if (idx !== -1) _toasts.splice(idx, 1);
        removeAfterAnim(el, 240);
        // Re-position remaining toasts
        _toasts.forEach((t, i) => {
            t.style.bottom = `${28 + i * 56}px`;
        });
    }

    // ── Modal (shared builder) ───────────────────────────────────

    /**
     * Build and show a modal. Returns a Promise that resolves when the user acts.
     *
     * @param {object} options
     * @param {string} options.title
     * @param {string} options.message
     * @param {'info'|'success'|'error'|'warning'} [options.type='info']
     * @param {string} [options.okText='OK']
     * @param {string} [options.cancelText='Batal']   Pass null to hide cancel button.
     * @returns {Promise<boolean>}  true = OK pressed, false = Cancel pressed.
     */
    function _buildModal({ title, message, type = 'info', okText = 'OK', cancelText = 'Batal', showIcon = true }) {
        return new Promise((resolve) => {

            // Backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'cldd-backdrop';

            // Modal box
            const modal = document.createElement('div');
            modal.className = 'cldd-modal';

            // Cancel button HTML (optional)
            const cancelHtml = cancelText
                ? `<button class="cldd-btn cldd-btn-secondary" id="cldd-cancel-btn">${cancelText}</button>`
                : '';

            modal.innerHTML = `
                <div class="cldd-modal-title">${title}</div>
                <div class="cldd-modal-body">${message}</div>
                <div class="cldd-modal-actions">
                    ${cancelHtml}
                    <button class="cldd-btn cldd-btn-primary type-${type}" id="cldd-ok-btn">
                        ${okText}
                    </button>
                </div>
            `;

            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);

            // Focus OK by default for keyboard accessibility
            requestAnimationFrame(() => {
                const okBtn = modal.querySelector('#cldd-ok-btn');
                if (okBtn) okBtn.focus();
            });

            function close(result) {
                removeAfterAnim(modal, 200);
                removeAfterAnim(backdrop, 220);
                resolve(result);
            }

            // OK button
            modal.querySelector('#cldd-ok-btn').addEventListener('click', () => close(true));

            // Cancel button
            const cancelBtn = modal.querySelector('#cldd-cancel-btn');
            if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));

            // Click outside modal → cancel
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) close(false);
            });

            // Escape key → cancel
            function onKey(e) {
                if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
                if (e.key === 'Enter')  { close(true);  document.removeEventListener('keydown', onKey); }
            }
            document.addEventListener('keydown', onKey);
        });
    }

    // ── Public: Alert ────────────────────────────────────────────
    /**
     * Show a modal with a single OK button (replacement for window.alert).
     *
     * @param {string|object} options  String = message (info type), or full options object.
     * @returns {Promise<void>}
     *
     * Examples:
     *   await CLDD.alert('File terlalu besar!')
     *   await CLDD.alert({ title:'Perhatian', message:'...', type:'warning', okText:'Mengerti' })
     */
    function alert(options) {
        if (typeof options === 'string') {
            options = { title: 'Informasi', message: options };
        }
        return _buildModal({ ...options, cancelText: null });
    }

    // ── Public: Confirm ──────────────────────────────────────────
    /**
     * Show a modal with OK + Cancel buttons (replacement for window.confirm).
     *
     * @param {string|object} options  String = message, or full options object.
     * @returns {Promise<boolean>}  true if user pressed OK, false if Cancel/Escape.
     *
     * Examples:
     *   const yes = await CLDD.confirm('Hapus gambar ini?')
     *   if (yes) removeImage()
     *
     *   const yes = await CLDD.confirm({
     *       title: 'Hapus Gambar',
     *       message: 'Apakah Anda yakin ingin menghapus gambar ini?',
     *       type: 'warning',
     *       okText: 'Ya, Hapus',
     *       cancelText: 'Batal',
     *   })
     */
    function confirm(options) {
        if (typeof options === 'string') {
            options = { title: 'Konfirmasi', message: options };
        }
        return _buildModal({ cancelText: 'Batal', ...options });
    }

    // ── Expose global namespace ───────────────────────────────────
    window.CLDD = window.CLDD || {};
    window.CLDD.toast   = toast;
    window.CLDD.alert   = alert;
    window.CLDD.confirm = confirm;

    // Convenience shorthands
    window.CLDD.success = (msg, dur) => toast(msg, 'success', dur);
    window.CLDD.error   = (msg, dur) => toast(msg, 'error',   dur);
    window.CLDD.warning = (msg, dur) => toast(msg, 'warning', dur);
    window.CLDD.info    = (msg, dur) => toast(msg, 'info',    dur);

    console.log('%c✅ CLDD popup.js loaded', 'color:#059669;font-weight:600');

})();