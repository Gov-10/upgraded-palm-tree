'use strict';

const API_BASE = 'http://127.0.0.1:8000';
let inventoryItems = [];
let allGodowns = [];  // full godown records

// Block form submission and Enter key
document.addEventListener('submit',  e => { e.preventDefault(); e.stopPropagation(); }, true);
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

const itemRowsContainer = document.getElementById('item-rows-container');
const addItemBtn        = document.getElementById('add-item-btn');
const generateBtn       = document.getElementById('generate-btn');

// ── Dates ────────────────────────────────────────────────────────────────────
function resetDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issued_date').value = today;
    const due = new Date();
    due.setDate(due.getDate() + 30);
    document.getElementById('due_date').value = due.toISOString().split('T')[0];
}

// ── Reset entire form ─────────────────────────────────────────────────────────
function resetForm() {
    ['invoice_no','company_name','cust_name','cust_company',
     'cust_phone','cust_email','cust_address',
     'bank_name','account_number','account_name'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    resetDates();
    itemRowsContainer.innerHTML = '';
    createItemRow();
}

// ── Inventory ─────────────────────────────────────────────────────────────────
async function fetchInventory() {
    try {
        const res = await fetch(`${API_BASE}/stock`);
        if (!res.ok) throw new Error();
        inventoryItems = await res.json();
    } catch {
        if (typeof showToast === 'function')
            showToast('Could not load inventory. Is the backend running?', 'error');
    }
}

async function fetchGodowns() {
    try {
        const res = await fetch(`${API_BASE}/godown`);
        if (!res.ok) throw new Error();
        allGodowns = await res.json();
    } catch {
        allGodowns = [];
    }
}

/**
 * Returns a list of godown names that contain a given stock item.
 * Looks in the stock item's `godowns` dict (keys = godown names, values = qty).
 */
function getGodownsForItem(itemName) {
    const stockItem = inventoryItems.find(i => i.item === itemName);
    if (!stockItem || !stockItem.godowns) return [];
    return Object.entries(stockItem.godowns)
        .filter(([, qty]) => qty > 0)
        .map(([name]) => name);
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm() {
    const required = [
        { id: 'invoice_no',   label: 'Invoice Number' },
        { id: 'company_name', label: 'Seller Company Name' },
        { id: 'cust_name',    label: 'Customer Name' },
        { id: 'cust_address', label: 'Customer Address' },
        { id: 'issued_date',  label: 'Date of Issue' },
        { id: 'due_date',     label: 'Due Date' },
    ];
    for (const f of required) {
        const el = document.getElementById(f.id);
        if (!el || !el.value.trim()) {
            if (typeof showToast === 'function') showToast(`"${f.label}" is required.`, 'warning');
            if (el) el.focus();
            return false;
        }
    }
    const rows = itemRowsContainer.querySelectorAll('.item-row');
    if (!rows.length) {
        if (typeof showToast === 'function') showToast('Add at least one item.', 'warning');
        return false;
    }
    for (const row of rows) {
        const inp = row.querySelector('.item-input');
        if (!inp || !inp.value.trim()) {
            if (typeof showToast === 'function') showToast('Select an item for every row.', 'warning');
            inp?.focus();
            return false;
        }
        const godownInp = row.querySelector('.godown-input');
        if (!godownInp || !godownInp.value.trim()) {
            if (typeof showToast === 'function') showToast(`Select a godown for "${inp.value}".`, 'warning');
            godownInp?.focus();
            return false;
        }
        const qty = parseInt(row.querySelector('.qty-input')?.value || '0', 10);
        if (qty < 1) {
            if (typeof showToast === 'function') showToast('Each item needs quantity ≥ 1.', 'warning');
            return false;
        }
    }
    return true;
}

// ── Item rows ─────────────────────────────────────────────────────────────────
function createItemRow() {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <div class="form-group item-select-container" style="flex:2;">
            <label>Item</label>
            <div class="custom-select-wrapper">
                <input type="text" class="item-input" placeholder="Click to select an item..." readonly>
                <div class="custom-dropdown-menu item-dropdown"></div>
            </div>
        </div>
        <div class="form-group godown-select-container" style="flex:1.5;">
            <label>Godown</label>
            <div class="custom-select-wrapper">
                <input type="text" class="godown-input" placeholder="Select item first..." readonly disabled>
                <div class="custom-dropdown-menu godown-dropdown"></div>
            </div>
        </div>
        <div class="form-group" style="width:100px;">
            <label>Quantity</label>
            <input type="number" class="qty-input" value="1" min="1">
        </div>
        <button type="button" class="btn btn-danger remove-item-btn" title="Remove">
            <i class="ti ti-trash"></i>
        </button>`;

    const itemInput     = row.querySelector('.item-input');
    const itemDropdown  = row.querySelector('.item-dropdown');
    const godownInput   = row.querySelector('.godown-input');
    const godownDropdown = row.querySelector('.godown-dropdown');

    // ── Item dropdown
    itemInput.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
            if (m !== itemDropdown) m.classList.remove('show');
        });
        populateItemDropdown(itemDropdown, itemInput, godownInput, godownDropdown);
        itemDropdown.classList.toggle('show');
    });

    // ── Godown dropdown
    godownInput.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (godownInput.disabled) return;
        document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
            if (m !== godownDropdown) m.classList.remove('show');
        });
        godownDropdown.classList.toggle('show');
    });

    row.querySelector('.remove-item-btn').addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (itemRowsContainer.querySelectorAll('.item-row').length > 1) row.remove();
        else if (typeof showToast === 'function') showToast('Need at least one item.', 'warning');
    });

    itemRowsContainer.appendChild(row);
}

function populateItemDropdown(menu, itemInput, godownInput, godownDropdown) {
    menu.innerHTML = '';
    if (!inventoryItems.length) {
        menu.innerHTML = '<div style="padding:10px;color:var(--text-lo);font-size:13px;">No items in inventory</div>';
        return;
    }
    inventoryItems.forEach(item => {
        const opt = document.createElement('div');
        opt.className = 'dropdown-item-option';
        opt.innerHTML = `<span>${item.item}</span><span class="price">₹${Number(item.rate).toLocaleString('en-IN')}</span>`;
        opt.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            itemInput.value = item.item;
            itemInput.dataset.rate = item.rate;
            menu.classList.remove('show');
            // Enable and repopulate the godown dropdown for this item
            activateGodownDropdown(item.item, godownInput, godownDropdown);
        });
        menu.appendChild(opt);
    });
}

function activateGodownDropdown(itemName, godownInput, godownDropdown) {
    const godownNames = getGodownsForItem(itemName);
    godownInput.value = '';
    delete godownInput.dataset.godown;
    godownDropdown.innerHTML = '';

    if (!godownNames.length) {
        godownInput.placeholder = 'No godowns available';
        godownInput.disabled = true;
        return;
    }

    godownInput.placeholder = 'Select a godown...';
    godownInput.disabled = false;

    godownNames.forEach(name => {
        const stockItem = inventoryItems.find(i => i.item === itemName);
        const qty = stockItem?.godowns?.[name] ?? 0;
        const opt = document.createElement('div');
        opt.className = 'dropdown-item-option';
        opt.innerHTML = `<span>${name}</span><span class="price" style="color:var(--blue-light);">${qty} available</span>`;
        opt.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            godownInput.value = name;
            godownInput.dataset.godown = name;
            godownDropdown.classList.remove('show');
        });
        godownDropdown.appendChild(opt);
    });
}

document.addEventListener('click', () =>
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'))
);

addItemBtn.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    createItemRow();
});

// ── Inventory sync helper ─────────────────────────────────────────────────────
async function syncInventory(items, revert = false) {
    try {
        const res = await fetch(`${API_BASE}/sync-invoice-stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, revert })
        });
        if (!res.ok) {
            let msg = `Inventory sync error ${res.status}`;
            try { msg = (await res.json()).detail || msg; } catch (_) {}
            console.error('Inventory sync failed:', msg);
            if (typeof notify === 'function') notify('Inventory sync failed: ' + msg, 'warning');
            return false;
        }
        return true;
    } catch (err) {
        console.error('Inventory sync failed:', err);
        if (typeof notify === 'function') notify('Inventory sync failed.', 'warning');
        return false;
    }
}

// ── GENERATE: step-isolated flat flow ─────────────────────────────────────────
generateBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) return;

    const invoiceNo = document.getElementById('invoice_no').value.trim() || 'draft';

    // Capture all form data up-front (before any async that could change DOM)
    const items = [];
    itemRowsContainer.querySelectorAll('.item-row').forEach(row => {
        const inp       = row.querySelector('.item-input');
        const godownInp = row.querySelector('.godown-input');
        const qty       = row.querySelector('.qty-input');
        items.push({
            desc:   inp.value.trim(),
            qty:    parseInt(qty.value, 10) || 1,
            price:  parseFloat(inp.dataset.rate) || 0,
            godown: godownInp.value.trim()
        });
    });

    const payload = {
        invoice_no:   invoiceNo,
        company_name: document.getElementById('company_name').value.trim(),
        issued_to: {
            name:    document.getElementById('cust_name').value.trim(),
            address: document.getElementById('cust_address').value.split('\n').map(l => l.trim()).filter(Boolean),
            phone:   document.getElementById('cust_phone').value.trim(),
            email:   document.getElementById('cust_email').value.trim(),
        },
        issued_date: document.getElementById('issued_date').value,
        due_date:    document.getElementById('due_date').value,
        items,
        tax_rate: 0.18,
        payment_details: {
            bank:         document.getElementById('bank_name').value.trim(),
            account_no:   document.getElementById('account_number').value.trim(),
            account_name: document.getElementById('account_name').value.trim(),
        },
    };

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 1s linear infinite;"></i> Generating…';

    // ── Step 1: Generate PDF ───────────────────────────────────────────────────
    let blob = null;
    try {
        console.log('[Billing] Step 1 — POST /generate-invoice');
        const res = await fetch(`${API_BASE}/generate-invoice`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        if (!res.ok) {
            let msg = `Error ${res.status}`;
            try { msg = (await res.json()).detail || msg; } catch (_) {}
            throw new Error(msg);
        }
        blob = await res.blob();
    } catch (err) {
        console.error('[Billing] PDF generation failed:', err);
        if (typeof notify === 'function') notify('Failed: ' + err.message, 'error');
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="ti ti-file-invoice"></i> Generate &amp; Download Invoice';
        return; // Can't proceed without a PDF
    }

    // ── Step 2: Trigger download ───────────────────────────────────────────────
    const blobUrl = URL.createObjectURL(blob);
    const anchor  = document.createElement('a');
    anchor.href     = blobUrl;
    anchor.download = `invoice_${invoiceNo}.pdf`;
    anchor.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
    if (typeof notify === 'function') notify('Invoice downloaded successfully!', 'success');

    // ── Step 3: Sync inventory — deduct quantities ─────────────────────────────
    // Runs independently; failure does NOT block voucher creation
    console.log('[Billing] Step 3 — POST /sync-invoice-stock');
    const syncItems = items.map(item => ({
        item_name: item.desc,
        qty:       item.qty,
        godown:    item.godown
    }));
    try {
        const synced = await syncInventory(syncItems, false);
        if (synced) {
            await fetchInventory();
            if (typeof notify === 'function') notify('Inventory synced — quantities deducted.', 'success');
        }
    } catch (syncErr) {
        console.error('[Billing] Inventory sync threw unexpectedly:', syncErr);
    }

    // ── Step 4: Create voucher — fully independent of Step 3 ──────────────────
    console.log('[Billing] Step 4 — POST /add-voucher');
    try {
        const now      = new Date();
        const pad      = n => String(n).padStart(2, '0');
        const voucherNo = `VCH-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

        const voucherItems = items.map(item => ({
            item_name: item.desc,
            qty:       item.qty,
            rate:      item.price,
            godown:    item.godown
        }));
        const amount    = voucherItems.reduce((s, i) => s + (i.qty * i.rate), 0);
        const gstAmount = amount * 0.18;

        const voucherPayload = [{
            voucher_type: 'Sales',
            date:         payload.issued_date,
            voucher_no:   voucherNo,
            party:        payload.issued_to.name,
            items:        voucherItems,
            amount:       amount,
            gst_amount:   gstAmount,
            discount:     0,
            status:       'pending'
        }];

        const vRes = await fetch(`${API_BASE}/add-voucher`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(voucherPayload)
        });

        if (!vRes.ok) {
            let vMsg = `Voucher sync error ${vRes.status}`;
            try { vMsg = (await vRes.json()).detail || vMsg; } catch (_) {}
            console.error('[Billing] add-voucher responded non-ok:', vMsg);
            if (typeof notify === 'function') notify('Voucher sync failed: ' + vMsg, 'warning');
        } else {
            const saved = await vRes.json();
            console.log('[Billing] Voucher created:', saved);
            if (typeof notify === 'function') notify('Voucher synced successfully!', 'success');
            if (Array.isArray(saved)) {
                salesInvoices = [...saved, ...salesInvoices];
                renderInvoiceList();
            }
        }
    } catch (vErr) {
        console.error('[Billing] add-voucher threw unexpectedly:', vErr);
        if (typeof notify === 'function') notify('Voucher sync failed.', 'warning');
    }

    // ── Step 5: Reset form ─────────────────────────────────────────────────────
    resetForm();

    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="ti ti-file-invoice"></i> Generate &amp; Download Invoice';
});


// ── Generated Invoice List Sidebar Logic ──────────────────────────────────────
let salesInvoices = [];

async function fetchSalesInvoices() {
    try {
        const res = await fetch(`${API_BASE}/vouchers`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        salesInvoices = (data || []).filter(v => (v.voucher_type || '').toLowerCase() === 'sales');
        renderInvoiceList();
    } catch (err) {
        console.error("Failed to fetch sales invoices:", err);
    }
}

function renderInvoiceList() {
    const container = document.getElementById('invoice-list-container');
    if (!container) return;

    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    const filtered = salesInvoices.filter(v => {
        if (startDate && v.date < startDate) return false;
        if (endDate && v.date > endDate) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-lo); font-size:13px;">No sales invoices found.</div>';
        return;
    }

    container.innerHTML = filtered.map(v => {
        const formattedAmt = '₹' + Number((v.amount || 0) + (v.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const dateStr = v.date ? new Date(v.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

        let itemsHtml = '';
        if (Array.isArray(v.items) && v.items.length > 0) {
            itemsHtml = v.items.map(item => {
                const name   = item.item_name || item.name || item.itemName || 'Item';
                const qty    = item.qty !== undefined ? item.qty : (item.quantity || 1);
                const godown = item.godown || '—';
                return `<tr><td>${name}</td><td style="text-align:center;color:var(--blue-light);">${godown}</td><td class="qty-col">${qty}</td></tr>`;
            }).join('');
        } else {
            itemsHtml = '<tr><td colspan="3" style="color:var(--text-lo); text-align:center;">No items</td></tr>';
        }

        return `
            <div class="invoice-item-card" data-id="${v.id}">
                <div class="invoice-item-header">
                    <span class="invoice-party-name">${v.party || 'N/A'}</span>
                    <button type="button" class="btn-revert" data-id="${v.id}">Revert</button>
                </div>
                <div class="invoice-item-meta">
                    <span class="invoice-total-amt">${formattedAmt}</span>
                    <span class="invoice-date">${dateStr}</span>
                </div>
                <div class="invoice-details-collapse">
                    <div class="invoice-details-content">
                        <table class="invoice-details-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th style="text-align:center;">Godown</th>
                                    <th style="text-align:right;">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ── Confirmation Modal Dialog Logic ──────────────────────────────────────────
let pendingRevertVoucherId = null;

function showConfirmModal(voucherId) {
    pendingRevertVoucherId = voucherId;
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) confirmModal.classList.add('show');
}

function hideConfirmModal() {
    pendingRevertVoucherId = null;
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) confirmModal.classList.remove('show');
}

(function bindConfirmModalEvents() {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');

    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', hideConfirmModal);
    }

    if (confirmModal) {
        confirmModal.addEventListener('click', function(e) {
            if (e.target === confirmModal) hideConfirmModal();
        });
    }

    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', async function() {
            if (!pendingRevertVoucherId) return;
            const voucherId = pendingRevertVoucherId;
            hideConfirmModal();
            try {
                // 1. Fetch the voucher to get its stored items (including godown)
                const voucherRes = await fetch(`${API_BASE}/vouchers/${voucherId}`);
                let storedItems = [];
                if (voucherRes.ok) {
                    const voucherData = await voucherRes.json();
                    storedItems = Array.isArray(voucherData.items) ? voucherData.items : [];
                } else {
                    console.warn('Could not fetch voucher details for inventory restore.');
                }

                // 2. Restore inventory quantities (revert = true)
                if (storedItems.length > 0) {
                    const syncItems = storedItems.map(i => ({
                        item_name: i.item_name || i.name || i.itemName,
                        qty:       i.qty !== undefined ? i.qty : (i.quantity || 0),
                        godown:    i.godown || null
                    })).filter(i => i.item_name && i.qty > 0);

                    if (syncItems.length > 0) {
                        await syncInventory(syncItems, true);
                        await fetchInventory();
                    }
                }

                // 3. Delete the voucher
                const res = await fetch(`${API_BASE}/vouchers/${voucherId}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    salesInvoices = salesInvoices.filter(v => String(v.id) !== String(voucherId));
                    renderInvoiceList();
                    if (typeof notify === 'function') notify('Invoice reverted & inventory restored!', 'success');
                } else {
                    throw new Error();
                }
            } catch (err) {
                console.error(err);
                if (typeof notify === 'function') notify('Failed to revert voucher.', 'error');
            }
        });
    }
})();

const invoiceListContainer = document.getElementById('invoice-list-container');
if (invoiceListContainer) {
    invoiceListContainer.addEventListener('click', async function (e) {
        const revertBtn = e.target.closest('.btn-revert');
        if (revertBtn) {
            e.stopPropagation();
            const voucherId = revertBtn.getAttribute('data-id');
            showConfirmModal(voucherId);
            return;
        }

        const card = e.target.closest('.invoice-item-card');
        if (card) {
            const collapse = card.querySelector('.invoice-details-collapse');
            if (collapse) {
                const isOpen = collapse.classList.contains('open');
                if (isOpen) {
                    collapse.style.maxHeight = '0px';
                    collapse.classList.remove('open');
                } else {
                    collapse.style.maxHeight = collapse.scrollHeight + 'px';
                    collapse.classList.add('open');
                }
            }
        }
    });
}

['filter-start-date', 'filter-end-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', renderInvoiceList);
    }
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
    resetDates();
    await Promise.all([fetchInventory(), fetchGodowns()]);
    createItemRow();
    await fetchSalesInvoices();
})();
