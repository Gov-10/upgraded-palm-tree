'use strict';

const API_BASE = 'http://127.0.0.1:8000';
let inventoryItems = [];

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
        <div class="form-group item-select-container" style="flex:1;">
            <label>Item</label>
            <div class="custom-select-wrapper">
                <input type="text" class="item-input" placeholder="Click to select an item..." readonly>
                <div class="custom-dropdown-menu"></div>
            </div>
        </div>
        <div class="form-group" style="width:110px;">
            <label>Quantity</label>
            <input type="number" class="qty-input" value="1" min="1">
        </div>
        <button type="button" class="btn btn-danger remove-item-btn" title="Remove">
            <i class="ti ti-trash"></i>
        </button>`;

    const itemInput    = row.querySelector('.item-input');
    const dropdownMenu = row.querySelector('.custom-dropdown-menu');

    itemInput.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
            if (m !== dropdownMenu) m.classList.remove('show');
        });
        populateDropdown(dropdownMenu, itemInput);
        dropdownMenu.classList.toggle('show');
    });

    row.querySelector('.remove-item-btn').addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (itemRowsContainer.querySelectorAll('.item-row').length > 1) row.remove();
        else if (typeof showToast === 'function') showToast('Need at least one item.', 'warning');
    });

    itemRowsContainer.appendChild(row);
}

function populateDropdown(menu, inputEl) {
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
            inputEl.value = item.item;
            inputEl.dataset.rate = item.rate;
            menu.classList.remove('show');
        });
        menu.appendChild(opt);
    });
}

document.addEventListener('click', () =>
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'))
);

addItemBtn.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    createItemRow();
});

// ── GENERATE: fetch → download → reset ───────────────────────────────────────
generateBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) return;

    // Capture invoice_no before reset (used for filename)
    const invoiceNo = document.getElementById('invoice_no').value.trim() || 'draft';

    const items = [];
    itemRowsContainer.querySelectorAll('.item-row').forEach(row => {
        const inp = row.querySelector('.item-input');
        const qty = row.querySelector('.qty-input');
        items.push({ desc: inp.value.trim(), qty: parseInt(qty.value, 10) || 1, price: parseFloat(inp.dataset.rate) || 0 });
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

    try {
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

        const blob = await res.blob();

        // ── Download via hidden <a> — blob URL + download attr forces save dialog ──
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `invoice_${invoiceNo}.pdf`;
        a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);

        // ── Reset form ────────────────────────────────────────────────────────
        resetForm();

        if (typeof notify === 'function') notify('Invoice downloaded successfully!', 'success');

    } catch (err) {
        console.error(err);
        if (typeof notify === 'function') notify('Failed: ' + err.message, 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="ti ti-file-invoice"></i> Generate &amp; Download Invoice';
    }
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
    resetDates();
    await fetchInventory();
    createItemRow();
})();
