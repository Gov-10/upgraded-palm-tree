const API_BASE = 'http://127.0.0.1:8000';

// Live vouchers cache â€“ populated from the API
let vouchers = [];

const statusColor = { verified: '#10B981', pending: '#F59E0B', cleared: '#2563EB' };
const tbody = document.getElementById('voucher-tbody');

// Metric card element references (matched by order in the HTML grid)
const metricCards = document.querySelectorAll('.glass-card');

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function formatCurrency(num) {
    return '\u20B9' + Number(num).toLocaleString('en-IN');
}

function normaliseType(raw) {
    raw = (raw || '').trim().toLowerCase();
    const map = { sales: 'Sales', purchase: 'Purchase', journal: 'Journal', payment: 'Payment', receipt: 'Receipt' };
    return map[raw] || 'Sales';
}

function normaliseStatus(raw) {
    raw = (raw || '').trim().toLowerCase();
    const map = { pending: 'pending', verified: 'verified', cleared: 'cleared' };
    return map[raw] || 'pending';
}

function toInputDate(raw) {
    if (!raw || raw === 'NA') return new Date().toISOString().slice(0, 10);
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
}

/** Pretty-print a stored date string for display in the table */
function displayDate(raw) {
    if (!raw) return 'â€”';
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return raw; // already formatted
}

/* ------------------------------------------------------------------ */
/*  Metrics                                                             */
/* ------------------------------------------------------------------ */
function updateMetrics() {
    const total    = vouchers.length;
    const purchase = vouchers.filter(v => v.voucher_type.toLowerCase() === 'purchase').length;
    const sales    = vouchers.filter(v => v.voucher_type.toLowerCase() === 'sales').length;
    const pending  = vouchers.filter(v => v.status.toLowerCase() === 'pending').length;

    // The four stat cards are the first 4 .glass-card elements in the page
    const cards = document.querySelectorAll('.console-content > div:first-child .glass-card');
    if (cards.length >= 4) {
        cards[0].querySelector('div:nth-child(2)').textContent = total.toLocaleString('en-IN');
        cards[1].querySelector('div:nth-child(2)').textContent = purchase.toLocaleString('en-IN');
        cards[2].querySelector('div:nth-child(2)').textContent = sales.toLocaleString('en-IN');
        cards[3].querySelector('div:nth-child(2)').textContent = pending.toLocaleString('en-IN');
        // update pending card colour
        cards[3].querySelector('div:nth-child(2)').style.color = pending > 0 ? '#F59E0B' : '#f8fafc';
    }
}

/* ------------------------------------------------------------------ */
/*  Render table                                                        */
/* ------------------------------------------------------------------ */
function renderVouchers() {
    tbody.innerHTML = '';

    const query      = (document.getElementById('search-input')?.value ?? '').toLowerCase().trim();
    const typeFilter = document.getElementById('filter-type')?.value ?? 'All Types';

    const filtered = vouchers.filter(function(v) {
        const matchesType  = typeFilter === 'All Types' || v.voucher_type.toLowerCase() === typeFilter.toLowerCase();
        const searchTarget = (v.voucher_no + v.party + v.amount + v.gst_amount).toLowerCase();
        return matchesType && searchTarget.includes(query);
    });

    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7" style="padding:24px;text-align:center;color:#64748b;">No vouchers found.</td>';
        tbody.appendChild(tr);
        return;
    }

    filtered.forEach(function(v) {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom:1px solid rgba(255,255,255,0.05);transition:background .2s;';
        tr.onmouseenter = function() { tr.style.background = 'rgba(255,255,255,0.03)'; };
        tr.onmouseleave = function() { tr.style.background = ''; };
        tr.innerHTML =
            '<td style="padding:14px 20px;color:#60a5fa;font-weight:600;font-family:monospace;">' + v.voucher_no + '</td>' +
            '<td style="padding:14px 20px;color:#94a3b8;">' + displayDate(v.date) + '</td>' +
            '<td style="padding:14px 20px;"><span style="background:rgba(37,99,235,.1);color:#60a5fa;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;">' + v.voucher_type + '</span></td>' +
            '<td style="padding:14px 20px;color:#f8fafc;">' + v.party + '</td>' +
            '<td style="padding:14px 20px;text-align:right;font-weight:700;color:#f8fafc;">' + formatCurrency(v.amount) + '</td>' +
            '<td style="padding:14px 20px;text-align:right;color:#94a3b8;">' + formatCurrency(v.gst_amount) + '</td>' +
            '<td style="padding:14px 20px;"><span style="color:' + (statusColor[v.status.toLowerCase()] || '#94a3b8') + ';font-weight:600;font-size:12px;text-transform:capitalize;">' + v.status + '</span></td>';
        tbody.appendChild(tr);
    });
}

/* ------------------------------------------------------------------ */
/*  Fetch vouchers from the API on load                                 */
/* ------------------------------------------------------------------ */
async function loadVouchers() {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#64748b;">Loading vouchersâ€¦</td></tr>';
    try {
        const res = await fetch(API_BASE + '/vouchers');
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const data = await res.json();
        vouchers = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('[Vouchers] Load failed:', err);
        tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#f87171;">Failed to load vouchers. Is the backend running?</td></tr>';
        return;
    }
    renderVouchers();
    updateMetrics();
}

loadVouchers();
document.getElementById('search-input').addEventListener('input', renderVouchers);
document.getElementById('filter-type').addEventListener('change', renderVouchers);

/* ------------------------------------------------------------------ */
/*  Modal open / close                                                  */
/* ------------------------------------------------------------------ */
const newVoucherBtn  = document.getElementById('new-voucher-btn');
const modalOverlay   = document.getElementById('new-voucher-modal');
const modalCloseBtn  = document.getElementById('modal-close-btn');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const newVoucherForm = document.getElementById('new-voucher-form');

document.getElementById('v-date').valueAsDate = new Date();

function openModal() {
    modalOverlay.classList.add('show');
    document.getElementById('v-date').valueAsDate = new Date();
}

function closeModal() {
    modalOverlay.classList.remove('show');
    newVoucherForm.reset();
    resetOCRState();
}

newVoucherBtn.addEventListener('click', openModal);
modalCloseBtn.addEventListener('click', closeModal);
btnModalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) closeModal();
});

/* ------------------------------------------------------------------ */
/*  OCR â€“ element references                                            */
/* ------------------------------------------------------------------ */
const ocrDropArea      = document.getElementById('ocr-drop-area');
const ocrFileInput     = document.getElementById('ocr-file-input');
const ocrUploadTrigger = document.getElementById('ocr-upload-trigger');
const ocrDropTitle     = document.getElementById('ocr-drop-title');
const ocrDropDesc      = document.getElementById('ocr-drop-desc');
const ocrFileInfo      = document.getElementById('ocr-file-info');
const ocrFilename      = document.getElementById('ocr-filename');
const ocrLoader        = document.getElementById('ocr-loader');

// "Upload File" button triggers hidden file input
ocrUploadTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    ocrFileInput.click();
});

// Clicking the drop area (outside the button) also opens file picker
ocrDropArea.addEventListener('click', function(e) {
    if (e.target !== ocrUploadTrigger && !ocrUploadTrigger.contains(e.target)) {
        ocrFileInput.click();
    }
});

// File selected via picker
ocrFileInput.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
        handleOCRFile(e.target.files[0]);
    }
});

// Drag highlight
['dragenter', 'dragover'].forEach(function(evt) {
    ocrDropArea.addEventListener(evt, function(e) {
        e.preventDefault();
        e.stopPropagation();
        ocrDropArea.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(function(evt) {
    ocrDropArea.addEventListener(evt, function(e) {
        e.preventDefault();
        e.stopPropagation();
        ocrDropArea.classList.remove('dragover');
    }, false);
});

// Drop event
ocrDropArea.addEventListener('drop', function(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleOCRFile(files[0]);
    }
});

function resetOCRState() {
    ocrDropTitle.style.display = 'block';
    ocrDropDesc.style.display  = 'block';
    ocrDropDesc.textContent    = 'Supports PDF, PNG, JPG (Max 10MB)';
    ocrDropDesc.style.color    = '#64748b';
    ocrFileInfo.style.display  = 'none';
    ocrLoader.style.display    = 'none';
    ocrFileInput.value         = '';
}

function showOCRLoader() {
    ocrDropTitle.style.display = 'none';
    ocrDropDesc.style.display  = 'none';
    ocrFileInfo.style.display  = 'none';
    ocrLoader.style.display    = 'flex';
}

function showOCRSuccess(filename) {
    ocrLoader.style.display   = 'none';
    ocrFileInfo.style.display = 'flex';
    ocrFilename.textContent   = filename;
}

function showOCRError(msg) {
    ocrLoader.style.display    = 'none';
    ocrDropTitle.style.display = 'block';
    ocrDropDesc.style.display  = 'block';
    ocrDropDesc.textContent    = '\u26a0 ' + msg;
    ocrDropDesc.style.color    = '#f87171';
}

/* ------------------------------------------------------------------ */
/*  OCR â€“ read file as binary stream â†’ POST /extract_ocr               */
/* ------------------------------------------------------------------ */
async function handleOCRFile(file) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
        showOCRError('Unsupported file type. Please upload PDF, JPG or PNG.');
        return;
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
        showOCRError('File exceeds 10 MB limit. Please use a smaller file.');
        return;
    }

    showOCRLoader();

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        const response = await fetch(API_BASE + '/extract_ocr', {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: arrayBuffer,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error('Server error ' + response.status + ': ' + errText);
        }

        const raw = await response.json();
        let reportList = null;

        if (raw && Array.isArray(raw.reports)) {
            reportList = raw;
        } else if (raw && typeof raw.text === 'string') {
            reportList = JSON.parse(raw.text);
        } else if (raw && raw.candidates && raw.candidates.length > 0) {
            const textContent =
                raw.candidates[0] &&
                raw.candidates[0].content &&
                raw.candidates[0].content.parts &&
                raw.candidates[0].content.parts[0] &&
                raw.candidates[0].content.parts[0].text;
            if (!textContent) throw new Error('No text content found in OCR response.');
            reportList = JSON.parse(textContent);
        } else {
            throw new Error('Unexpected response shape from /extract_ocr endpoint.');
        }

        const reports = reportList && reportList.reports;
        if (!reports || reports.length === 0) {
            throw new Error('OCR returned no data. Try a clearer or higher-quality document.');
        }

        autofillForm(reports[0]);
        showOCRSuccess(file.name);

    } catch (err) {
        console.error('[OCR] Error:', err);
        showOCRError(err.message || 'OCR processing failed. Please try again.');
    }
}

/* ------------------------------------------------------------------ */
/*  Autofill form fields from an ExtractionSchema record               */
/* ------------------------------------------------------------------ */
function autofillForm(record) {
    const typeEl   = document.getElementById('v-type');
    const dateEl   = document.getElementById('v-date');
    const noEl     = document.getElementById('v-no');
    const partyEl  = document.getElementById('v-party');
    const amountEl = document.getElementById('v-amount');
    const gstEl    = document.getElementById('v-gst');
    const statusEl = document.getElementById('v-status');

    typeEl.value   = normaliseType(record.voucher_type);
    dateEl.value   = toInputDate(record.date);
    noEl.value     = (record.voucher_no && record.voucher_no !== 'NA') ? record.voucher_no : '';
    partyEl.value  = (record.party && record.party !== 'NA') ? record.party : '';
    amountEl.value = (record.amount  !== undefined && record.amount  !== 0) ? record.amount  : '';
    gstEl.value    = (record.gst_amount !== undefined && record.gst_amount !== 0) ? record.gst_amount : '';
    statusEl.value = normaliseStatus(record.status);

    var fields = [typeEl, dateEl, noEl, partyEl, amountEl, gstEl, statusEl];
    fields.forEach(function(el) {
        el.style.transition  = 'box-shadow 0.3s ease, border-color 0.3s ease';
        el.style.borderColor = '#10B981';
        el.style.boxShadow   = '0 0 0 2px rgba(16, 185, 129, 0.3)';
        setTimeout(function() {
            el.style.borderColor = '';
            el.style.boxShadow   = '';
        }, 2000);
    });
}

/* ------------------------------------------------------------------ */
/*  Form submission â†’ POST /add-voucher â†’ refresh table                 */
/* ------------------------------------------------------------------ */
newVoucherForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const submitBtn = newVoucherForm.querySelector('.btn-modal-submit');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Savingâ€¦';

    const payload = {
        voucher_type: document.getElementById('v-type').value,
        date:         document.getElementById('v-date').value,
        voucher_no:   document.getElementById('v-no').value,
        party:        document.getElementById('v-party').value,
        amount:       parseFloat(document.getElementById('v-amount').value),
        gst_amount:   parseFloat(document.getElementById('v-gst').value),
        status:       document.getElementById('v-status').value,
    };

    try {
        const response = await fetch(API_BASE + '/upload-to-AWS', {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errText = await res.text();
            throw new Error('Server error ' + res.status + ': ' + errText);
        }

        const res = await fetch(API_BASE + '/add-voucher', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error('Server error ' + res.status + ': ' + errText);
        }

        const saved = await res.json();

        // Prepend the newly saved record to the local cache
        vouchers.unshift(saved);
        renderVouchers();
        updateMetrics();
        closeModal();

    } catch (err) {
        console.error('[AddVoucher] Error:', err);
        alert('Failed to save voucher: ' + (err.message || 'Unknown error'));
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Create Voucher';
    }
});
