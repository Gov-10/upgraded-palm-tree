const API_BASE = 'http://127.0.0.1:8000';

// Live vouchers cache – populated from the API
let vouchers = [];
let extractedRecords = [];
let editingVoucherId = null;
let ocrTriggered = false;

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
        tr.innerHTML = '<td colspan="8" style="padding:24px;text-align:center;color:#64748b;">No vouchers found.</td>';
        tbody.appendChild(tr);
        return;
    }

    filtered.forEach(function(v) {
        const recordId = v.id || v.voucher_no;
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
            '<td style="padding:14px 20px;"><span style="color:' + (statusColor[v.status.toLowerCase()] || '#94a3b8') + ';font-weight:600;font-size:12px;text-transform:capitalize;">' + v.status + '</span></td>' +
            '<td style="padding:14px 20px;text-align:right;position:relative;">' +
                '<button class="action-btn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:4px;" onclick="event.stopPropagation(); toggleDropdown(event, \'' + recordId + '\')"><i class="ti ti-dots-vertical"></i></button>' +
                '<div class="action-dropdown" id="dropdown-' + recordId + '">' +
                    '<div class="action-dropdown-item" onclick="event.stopPropagation(); triggerEditVoucher(\'' + recordId + '\')"><i class="ti ti-edit"></i> Edit</div>' +
                    '<div class="action-dropdown-item remove" onclick="event.stopPropagation(); triggerRemoveVoucher(\'' + recordId + '\')"><i class="ti ti-trash"></i> Remove</div>' +
                '</div>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

/* ------------------------------------------------------------------ */
/*  Fetch vouchers from the API on load                                 */
/* ------------------------------------------------------------------ */
async function loadVouchers() {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:24px;text-align:center;color:#64748b;">Loading vouchers…</td></tr>';
    try {
        const res = await fetch(API_BASE + '/vouchers');
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const data = await res.json();
        vouchers = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('[Vouchers] Load failed:', err);
        tbody.innerHTML = '<tr><td colspan="8" style="padding:24px;text-align:center;color:#f87171;">Failed to load vouchers. Is the backend running?</td></tr>';
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

function openModal(record = null) {
    modalOverlay.classList.add('show');
    const modalTitle = modalOverlay.querySelector('.modal-header h3');
    const submitBtn = modalOverlay.querySelector('.btn-modal-submit');
    const manualFields = document.getElementById('manual-fields-container');
    const ocrSection = document.getElementById('ocr-section-container');
    const checkboxContainer = document.getElementById('ocr-checkbox-container');
    const multipleRecordsCheckbox = document.getElementById('v-multiple-records');
    const requiredInputs = document.querySelectorAll('#manual-fields-container [data-required]');

    if (record) {
        editingVoucherId = record.id || record.voucher_no;
        if (modalTitle) modalTitle.innerHTML = '<i class="ti ti-receipt-2"></i> Edit Voucher Entry';
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        if (manualFields) manualFields.style.display = 'block';
        if (ocrSection) ocrSection.style.display = 'none';
        if (checkboxContainer) checkboxContainer.style.display = 'none';
        requiredInputs.forEach(input => input.setAttribute('required', ''));

        // Prefill fields
        document.getElementById('v-type').value = record.voucher_type || 'Sales';
        document.getElementById('v-date').value = toInputDate(record.date);
        document.getElementById('v-no').value = record.voucher_no || '';
        document.getElementById('v-party').value = record.party || '';
        document.getElementById('v-amount').value = record.amount || '';
        document.getElementById('v-gst').value = record.gst_amount || '';
        document.getElementById('v-status').value = record.status || 'pending';
    } else {
        editingVoucherId = null;
        ocrTriggered = false;
        if (modalTitle) modalTitle.innerHTML = '<i class="ti ti-receipt-2"></i> Add Voucher';
        if (submitBtn) submitBtn.textContent = 'Create Voucher';

        if (ocrSection) ocrSection.style.display = 'block';
        if (checkboxContainer) checkboxContainer.style.display = 'flex';
        
        if (multipleRecordsCheckbox) {
            multipleRecordsCheckbox.checked = false;
        }
        if (manualFields) manualFields.style.display = 'block';
        requiredInputs.forEach(input => input.setAttribute('required', ''));

        newVoucherForm.reset();
        document.getElementById('v-date').valueAsDate = new Date();
        extractedRecords = [];
        renderOCRRecordsPreview();
    }
}

function closeModal() {
    modalOverlay.classList.remove('show');
    newVoucherForm.reset();
    editingVoucherId = null;
    extractedRecords = [];
    renderOCRRecordsPreview();
    resetOCRState();
}

newVoucherBtn.addEventListener('click', () => openModal(null));
modalCloseBtn.addEventListener('click', closeModal);
btnModalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) closeModal();
});

const multipleRecordsCheckbox = document.getElementById('v-multiple-records');
if (multipleRecordsCheckbox) {
    multipleRecordsCheckbox.addEventListener('change', function() {
        const manualFields = document.getElementById('manual-fields-container');
        const preview = document.getElementById('ocr-records-preview');
        const requiredInputs = document.querySelectorAll('#manual-fields-container [data-required]');
        if (this.checked) {
            if (manualFields) manualFields.style.display = 'none';
            if (preview) preview.style.display = extractedRecords.length > 0 ? 'flex' : 'none';
            requiredInputs.forEach(input => input.removeAttribute('required'));
        } else {
            if (manualFields) manualFields.style.display = 'block';
            if (preview) preview.style.display = 'none';
            requiredInputs.forEach(input => input.setAttribute('required', ''));
        }
    });
}

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
    extractedRecords           = [];
    ocrTriggered               = false;
}

function renderOCRRecordsPreview() {
    const preview = document.getElementById('ocr-records-preview');
    if (!preview) return;
    
    if (extractedRecords.length === 0) {
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
    }
    
    preview.style.display = 'flex';
    preview.innerHTML = '<div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Extracted Records Preview</div>';
    
    extractedRecords.forEach(rec => {
        const dateStr = displayDate(rec.date || rec.voucher_date);
        const partyStr = rec.party || 'Unknown Party';
        const amountStr = formatCurrency(rec.amount || 0);
        
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(15, 23, 42, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);';
        row.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 600; color: #f8fafc; font-size: 13px;">${partyStr}</span>
                <span style="color: #64748b; font-size: 11px;">${dateStr}</span>
            </div>
            <span style="font-weight: 700; color: #f8fafc; font-size: 13px;">${amountStr}</span>
        `;
        preview.appendChild(row);
    });
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
        
        const response = await fetch(API_BASE + '/extract-OCR', {
            method: 'POST',
            headers: { 'Content-Type': file.type, 'Schema': 'voucher' },
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

        ocrTriggered = true;
        const isMultiple = document.getElementById('v-multiple-records')?.checked;
        if (isMultiple) {
            extractedRecords = reports;
            showOCRSuccess(file.name + ' (' + reports.length + ' records loaded)');
            renderOCRRecordsPreview();
            
            // Show preview box if hidden
            const preview = document.getElementById('ocr-records-preview');
            if (preview) preview.style.display = 'flex';
        } else {
            extractedRecords = [];
            autofillForm(reports[0]);
            showOCRSuccess(file.name);
        }

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
    submitBtn.textContent = 'Saving…';

    if (editingVoucherId !== null) {
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
            const res = await fetch(API_BASE + '/vouchers/' + editingVoucherId, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error('Server error ' + res.status + ': ' + errText);
            }

            const saved = await res.json();
            const idx = vouchers.findIndex(v => (v.id || v.voucher_no) == editingVoucherId);
            if (idx !== -1) {
                vouchers[idx] = saved;
            }

            renderVouchers();
            updateMetrics();
            closeModal();
        } catch (err) {
            console.error('[EditVoucher] Error:', err);
            notify('Failed to update voucher: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Create Voucher';
        }
        return;
    }

    const isMultiple = document.getElementById('v-multiple-records')?.checked;

    if (isMultiple) {
        if (extractedRecords.length === 0) {
            showToast('Please upload a document for OCR first.', 'warning');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Create Voucher';
            return;
        }

        function buildPayload(rec) {
            return {
                voucher_type: normaliseType(rec.voucher_type),
                date:         toInputDate(rec.date),
                voucher_no:   (rec.voucher_no && rec.voucher_no !== 'NA') ? rec.voucher_no : ('VCH-' + Date.now()),
                party:        (rec.party && rec.party !== 'NA') ? rec.party : 'NA',
                amount:       (rec.amount !== undefined) ? parseFloat(rec.amount) : 0,
                gst_amount:   (rec.gst_amount !== undefined) ? parseFloat(rec.gst_amount) : 0,
                status:       normaliseStatus(rec.status),
            };
        }

        try {
            const response = await fetch(API_BASE + '/upload-to-AWS', {
                method: 'POST',
                headers: { 'Schema': 'voucher' }
            });
            
            if (!response.ok) {
                const errText = await response.text();
                throw new Error('Server error ' + response.status + ': ' + errText);
            }

            const payloads = extractedRecords.map(buildPayload);
            const res = await fetch(API_BASE + '/add-voucher', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payloads),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error('Server error ' + res.status + ': ' + errText);
            }

            const savedList = await res.json();
            if (Array.isArray(savedList)) {
                savedList.forEach(saved => vouchers.unshift(saved));
            }

            renderVouchers();
            updateMetrics();
            closeModal();

        } catch (err) {
            console.error('[AddVoucher] Error:', err);
            // Fallback local prepend
            extractedRecords.forEach((rec, idx) => {
                vouchers.unshift({ ...buildPayload(rec), id: Date.now() + idx });
            });
            renderVouchers();
            updateMetrics();
            closeModal();
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Create Voucher';
        }
        return;
    }

    const payload = {
        voucher_type: document.getElementById('v-type').value,
        date:         document.getElementById('v-date').value,
        voucher_no:   document.getElementById('v-no').value,
        party:        document.getElementById('v-party').value,
        amount:       parseFloat(document.getElementById('v-amount').value),
        gst_amount:   parseFloat(document.getElementById('v-gst').value),
        status:       document.getElementById('v-status').value,
    };

    if (ocrTriggered) {
        try {
            const response = await fetch(API_BASE + '/upload-to-AWS', {
                method: 'POST',
                headers: { 'Schema': 'voucher' }
            });
            
            if (!response.ok) {
                const errText = await response.text();
                throw new Error('Server error ' + response.status + ': ' + errText);
            }

            const res = await fetch(API_BASE + '/add-voucher', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify([payload]),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error('Server error ' + res.status + ': ' + errText);
            }

            const savedList = await res.json();
            const saved = Array.isArray(savedList) ? savedList[0] : savedList;
            vouchers.unshift(saved);
            renderVouchers();
            updateMetrics();
            closeModal();

        } catch (err) {
            console.error('[AddVoucher] Error:', err);
            vouchers.unshift({ ...payload, id: Date.now() });
            renderVouchers();
            updateMetrics();
            closeModal();
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Create Voucher';
        }
    } else {
        try {
            const res = await fetch(API_BASE + '/add-voucher', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify([payload]),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error('Server error ' + res.status + ': ' + errText);
            }

            const savedList = await res.json();
            const saved = Array.isArray(savedList) ? savedList[0] : savedList;
            vouchers.unshift(saved);
            renderVouchers();
            updateMetrics();
            closeModal();

        } catch (err) {
            console.error('[AddVoucher] Error:', err);
            vouchers.unshift({ ...payload, id: Date.now() });
            renderVouchers();
            updateMetrics();
            closeModal();
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Create Voucher';
        }
    }
});

/* ------------------------------------------------------------------ */
/*  Record Actions & Dropdown Controls                                */
/* ------------------------------------------------------------------ */
window.toggleDropdown = function(event, id) {
    event.stopPropagation();
    document.querySelectorAll('.action-dropdown').forEach(d => {
        if (d.id !== 'dropdown-' + id) {
            d.classList.remove('show');
        }
    });
    const dropdown = document.getElementById('dropdown-' + id);
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

window.triggerEditVoucher = function(id) {
    const record = vouchers.find(v => (v.id || v.voucher_no) == id);
    if (record) {
        openModal(record);
    }
    document.querySelectorAll('.action-dropdown').forEach(d => d.classList.remove('show'));
};

window.triggerRemoveVoucher = function(id) {
    if (confirm('Are you sure you want to remove this voucher record?')) {
        fetch(API_BASE + '/vouchers/' + id, {
            method: 'DELETE'
        }).then(res => {
            if (res.ok) {
                vouchers = vouchers.filter(v => (v.id || v.voucher_no) != id);
                renderVouchers();
                updateMetrics();
            } else {
                notify('Failed to delete voucher from database.', 'error');
            }
        }).catch(err => {
            console.error('Delete failed:', err);
            // fallback deletion locally if offline/no endpoint matches
            vouchers = vouchers.filter(v => (v.id || v.voucher_no) != id);
            renderVouchers();
            updateMetrics();
        });
    }
    document.querySelectorAll('.action-dropdown').forEach(d => d.classList.remove('show'));
};

document.addEventListener('click', function() {
    document.querySelectorAll('.action-dropdown').forEach(d => d.classList.remove('show'));
});
