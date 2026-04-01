import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';
import { getAirportDisplay } from '../lib/airportCodes';

const STEP = {
  INTAKE: 'intake',
  CHECKLIST: 'checklist',
};

const INITIAL_FORM = {
  awbNumber: '',
  origin: '',
  destination: '',
  routing: '',
  flightNumbers: '',
  shipmentType: 'Origin',
  remainsType: 'Human Remains',
};

// ── FORMAT HELPERS ──

/** AWB: auto-insert dash after first 3 digits → "016-12345678" */
function formatAwb(value) {
  // Strip everything except digits
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length <= 3) return digits;
  return digits.slice(0, 3) + '-' + digits.slice(3, 11);
}

/** Routing/Flights: auto-insert " - " between space-separated segments */
function formatDashed(value) {
  // If user is typing, keep raw input; format on blur
  return value;
}

function applyDashFormat(value) {
  if (!value) return '';
  // Remove existing dashes and extra spaces, then rejoin with " - "
  const parts = value
    .replace(/\s*-\s*/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.join(' - ');
}

export default function ChecklistPage() {
  const [step, setStep] = useState(STEP.INTAKE);
  const [form, setForm] = useState(INITIAL_FORM);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  const [notes, setNotes] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  // ── FORM HANDLERS ──
  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleAwbChange = (e) => {
    setForm((prev) => ({ ...prev, awbNumber: formatAwb(e.target.value) }));
  };

  const handleRoutingBlur = () => {
    setForm((prev) => ({ ...prev, routing: applyDashFormat(prev.routing) }));
  };

  const handleFlightsBlur = () => {
    setForm((prev) => ({ ...prev, flightNumbers: applyDashFormat(prev.flightNumbers) }));
  };

  // ── GENERATE CHECKLIST ──
  const handleGenerateChecklist = useCallback(async () => {
    if (!form.awbNumber || !form.origin || !form.destination) {
      setError('Please fill in AWB Number, Origin, and Destination.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const dest = form.destination.toUpperCase().trim();

      const { data: requirements, error: reqError } = await supabase
        .from('requirements_matrix')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (reqError) throw reqError;

      const filtered = requirements.filter((r) => {
        if (r.applies_to === 'BOTH' || r.applies_to === 'ALL') return true;
        if (form.remainsType === 'Human Remains' && r.applies_to === 'HUMAN_REMAINS') return true;
        if (form.remainsType === 'Human Remains - ASH' && r.applies_to === 'HUMAN_REMAINS_ASH') return true;
        return false;
      });

      const { data: airportReqs, error: airErr } = await supabase
        .from('airport_requirements')
        .select('requirement_id, status, custom_note')
        .eq('airport_code', dest);

      if (airErr) throw airErr;

      let items;
      if (airportReqs && airportReqs.length > 0) {
        const airportMap = new Map(airportReqs.map((ar) => [ar.requirement_id, { status: ar.status, custom_note: ar.custom_note }]));
        items = filtered
          .filter((req) => {
            const entry = airportMap.get(req.id);
            return entry && entry.status !== 'Not Required';
          })
          .map((req) => {
            const entry = airportMap.get(req.id);
            return {
              requirement_id: req.id,
              document_name: req.document_name,
              description: req.description,
              status: entry.status,
              custom_note: entry.custom_note || '',
              verification: '',
            };
          });
      } else {
        const { data: defaults, error: defErr } = await supabase
          .from('default_requirements')
          .select('requirement_id, status');

        if (defErr) throw defErr;

        const defaultMap = new Map(defaults.map((d) => [d.requirement_id, d.status]));
        items = filtered
          .filter((req) => {
            const status = defaultMap.get(req.id);
            return status && status !== 'Not Required';
          })
          .map((req) => ({
            requirement_id: req.id,
            document_name: req.document_name,
            description: req.description,
            status: defaultMap.get(req.id) || 'Required',
            custom_note: '',
            verification: '',
          }));
      }

      if (items.length === 0) {
        items = filtered.map((req) => ({
          requirement_id: req.id,
          document_name: req.document_name,
          description: req.description,
          status: 'Required',
          custom_note: '',
          verification: '',
        }));
      }

      setChecklistItems(items);
      setCreatedAt(new Date().toISOString());
      setNotes('');
      setStep(STEP.CHECKLIST);
    } catch (err) {
      console.error('Error generating checklist:', err);
      setError(`Failed to generate checklist: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [form]);

  // ── UPDATE VERIFICATION ──
  const updateVerification = (index, value) => {
    setChecklistItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, verification: value } : item))
    );
  };

  // ── HANDLE PRINT ──
  const handlePrint = () => {
    const allFilled = checklistItems.every((item) => item.verification !== '');
    if (!allFilled) {
      setError('Please verify all checklist items before printing.');
      return;
    }
    setError('');
    const hasMissing = checklistItems.some((item) => item.verification === 'Missing');
    setModalType(hasMissing ? 'warning' : 'success');
    setShowModal(true);
  };

  // ── SUBMIT & PDF ──
  const handleSubmitAndPrint = async () => {
    if (modalType === 'success' && !employeeId.trim()) return;

    const now = new Date().toISOString();

    try {
      const { error: txErr } = await supabase.from('checklist_transactions').insert({
        awb_number: form.awbNumber,
        origin: form.origin.toUpperCase(),
        destination: form.destination.toUpperCase(),
        routing: form.routing,
        flight_numbers: form.flightNumbers,
        shipment_type: form.shipmentType,
        remains_type: form.remainsType,
        checklist_items: checklistItems,
        all_verified: modalType === 'success',
        employee_id: employeeId || null,
        submitted_at: now,
      });
      if (txErr) console.error('Error saving transaction:', txErr);
    } catch (err) {
      console.error('Error saving:', err);
    }

    const pdf = generateChecklistPDF({
      awbNumber: form.awbNumber,
      origin: form.origin.toUpperCase(),
      originDisplay: getAirportDisplay(form.origin),
      destination: form.destination.toUpperCase(),
      destinationDisplay: getAirportDisplay(form.destination),
      routing: form.routing,
      flightNumbers: form.flightNumbers,
      shipmentType: form.shipmentType,
      remainsType: form.remainsType,
      checklistItems,
      notes,
      employeeId: employeeId || '',
      submittedAt: now,
    });

    pdf.save(`HR_Checklist_${form.awbNumber}_${form.destination}.pdf`);
    setShowModal(false);
    setEmployeeId('');
  };

  // ── RESET ──
  const handleReset = () => {
    setStep(STEP.INTAKE);
    setForm(INITIAL_FORM);
    setChecklistItems([]);
    setError('');
    setCreatedAt(null);
    setNotes('');
    setShowModal(false);
    setEmployeeId('');
  };

  // ═══════════════════════════════════════
  //  INTAKE FORM
  // ═══════════════════════════════════════
  if (step === STEP.INTAKE) {
    return (
      <div className="card">
        <h2 className="card__header">Shipment Information</h2>

        {error && <div className="alert alert--warning">{error}</div>}

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">AWB Number *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 016-12345678"
              value={form.awbNumber}
              onChange={handleAwbChange}
              maxLength={12}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Remains Type *</label>
            <select className="form-select" value={form.remainsType} onChange={updateField('remainsType')}>
              <option>Human Remains</option>
              <option>Human Remains - ASH</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Origin (ICAO Code) *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. IAH"
              maxLength={3}
              value={form.origin}
              onChange={(e) => setForm((prev) => ({ ...prev, origin: e.target.value.toUpperCase() }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Destination (ICAO Code) *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. NRT"
              maxLength={3}
              value={form.destination}
              onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value.toUpperCase() }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Routing</label>
            <input
              type="text"
              className="form-input"
              placeholder="Type stations separated by spaces (e.g. IAH DEN BOG)"
              value={form.routing}
              onChange={updateField('routing')}
              onBlur={handleRoutingBlur}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Flight Numbers</label>
            <input
              type="text"
              className="form-input"
              placeholder="Type flights separated by spaces (e.g. UA123 UA525)"
              value={form.flightNumbers}
              onChange={updateField('flightNumbers')}
              onBlur={handleFlightsBlur}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Origin or Transit</label>
            <select className="form-select" value={form.shipmentType} onChange={updateField('shipmentType')}>
              <option value="Origin">Origin</option>
              <option value="Transit">Transit</option>
            </select>
          </div>
        </div>

        <div className="button-row">
          <button className="btn btn--primary" onClick={handleGenerateChecklist} disabled={loading}>
            {loading ? (<><span className="spinner" /> Generating...</>) : 'Generate Checklist'}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  CHECKLIST VIEW
  // ═══════════════════════════════════════
  return (
    <>
      {/* Shipment Summary */}
      <div className="card">
        <h2 className="card__header">Shipment Summary</h2>
        <div className="form-grid" style={{ gap: '8px 24px' }}>
          <div><span className="form-label">AWB: </span><strong>{form.awbNumber}</strong></div>
          <div><span className="form-label">Type: </span><strong>{form.remainsType}</strong></div>
          <div><span className="form-label">Origin: </span><strong>{getAirportDisplay(form.origin)}</strong></div>
          <div><span className="form-label">Destination: </span><strong>{getAirportDisplay(form.destination)}</strong></div>
          <div><span className="form-label">Routing: </span><strong>{form.routing || '—'}</strong></div>
          <div><span className="form-label">Flights: </span><strong>{form.flightNumbers || '—'}</strong></div>
          <div><span className="form-label">Shipment: </span><strong>{form.shipmentType}</strong></div>
          <div><span className="form-label">Created: </span><strong>{createdAt ? new Date(createdAt).toLocaleString() : '—'}</strong></div>
        </div>
      </div>

      {/* Checklist */}
      <div className="card">
        <h2 className="card__header">Document Verification Checklist</h2>
        {error && <div className="alert alert--warning">{error}</div>}

        <table className="checklist-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Document</th>
              <th style={{ width: 150 }}>Requirement</th>
              <th style={{ width: 130 }}>Verification</th>
            </tr>
          </thead>
          <tbody>
            {checklistItems.map((item, idx) => (
              <tr key={item.requirement_id || idx}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.document_name}</div>
                  {item.description && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {item.description}
                    </div>
                  )}
                  {item.custom_note && (
                    <div style={{
                      fontSize: '0.78rem', color: 'var(--united-blue)', marginTop: 3,
                      fontWeight: 500, fontStyle: 'italic',
                    }}>
                      &#9733; {item.custom_note}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`status-badge ${
                    item.status === 'Required' ? 'status-badge--required'
                      : item.status === 'Required - Copies OK' ? 'status-badge--copies'
                      : 'status-badge--not-required'
                  }`}>{item.status}</span>
                </td>
                <td>
                  <select
                    className={`verification-select ${
                      item.verification === 'Verified' ? 'verification-select--verified'
                        : item.verification === 'Missing' ? 'verification-select--missing' : ''
                    }`}
                    value={item.verification}
                    onChange={(e) => updateVerification(idx, e.target.value)}
                  >
                    <option value="">— Select —</option>
                    <option value="Verified">Verified</option>
                    <option value="Missing">Missing</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Notes Section */}
        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label">Notes / Comments</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Add any notes or comments about this shipment..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="button-row">
          <button className="btn btn--outline" onClick={handleReset}>Reset & Start Over</button>
          <button className="btn btn--primary" onClick={handlePrint}>Print Checklist</button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modalType === 'warning' ? (
              <>
                <h3 className="modal__title modal__title--warning">⚠ Missing Documents</h3>
                <div className="modal__body">
                  <p><strong>One or more important documents are marked as MISSING.</strong></p>
                  <p style={{ marginTop: 12 }}>
                    Please contact the <strong>Supervisor on Duty</strong> and <strong>TrustUA</strong> for further instructions before proceeding.
                  </p>
                </div>
                <div className="button-row" style={{ marginTop: 16 }}>
                  <button className="btn btn--outline" onClick={() => setShowModal(false)}>Go Back</button>
                  <button className="btn btn--danger" onClick={handleSubmitAndPrint}>Print Anyway</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="modal__title modal__title--success">✓ All Documents Verified</h3>
                <div className="modal__body">
                  <p>I certify that I have checked and verified all documents listed on this checklist and confirm they are complete.</p>
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label className="form-label">Enter your V Number or U Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. V12345 or U12345"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                      autoFocus
                    />
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    Date/Time: {new Date().toLocaleString()}
                  </div>
                </div>
                <div className="button-row" style={{ marginTop: 16 }}>
                  <button className="btn btn--outline" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn btn--primary" onClick={handleSubmitAndPrint} disabled={!employeeId.trim()}>
                    Submit & Print PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
