import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';
import { getAirportDisplay } from '../lib/airportCodes';

const STEP = { INTAKE: 'intake', CHECKLIST: 'checklist' };
const INITIAL_FORM = {
  awbNumber: '', origin: '', destination: '', routing: '',
  flightNumbers: '', shipmentType: 'Origin', remainsType: 'Human Remains',
};

function formatAwb(value) {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length <= 3) return digits;
  return digits.slice(0, 3) + '-' + digits.slice(3, 11);
}

function applyDashFormat(value) {
  if (!value) return '';
  return value.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).filter(Boolean).join(' - ');
}

export default function ChecklistPage() {
  const [step, setStep] = useState(STEP.INTAKE);
  const [form, setForm] = useState(INITIAL_FORM);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  const [notes, setNotes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);

  const updateField = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const handleAwbChange = (e) => setForm(p => ({ ...p, awbNumber: formatAwb(e.target.value) }));
  const handleRoutingBlur = () => setForm(p => ({ ...p, routing: applyDashFormat(p.routing) }));
  const handleFlightsBlur = () => setForm(p => ({ ...p, flightNumbers: applyDashFormat(p.flightNumbers) }));

  // ── Fetch checklist items for current destination/type ──
  const fetchChecklist = useCallback(async () => {
    const dest = form.destination.toUpperCase().trim();
    if (!dest) return [];

    const { data: requirements } = await supabase
      .from('requirements_matrix').select('*').eq('is_active', true).order('sort_order', { ascending: true });

    const filtered = (requirements || []).filter(r => {
      if (r.applies_to === 'BOTH' || r.applies_to === 'ALL') return true;
      if (form.remainsType === 'Human Remains' && r.applies_to === 'HUMAN_REMAINS') return true;
      if (form.remainsType === 'Human Remains - ASH' && r.applies_to === 'HUMAN_REMAINS_ASH') return true;
      return false;
    });

    const { data: airportReqs } = await supabase
      .from('airport_requirements').select('requirement_id, status, custom_note').eq('airport_code', dest);

    let items;
    if (airportReqs && airportReqs.length > 0) {
      const m = new Map(airportReqs.map(a => [a.requirement_id, { status: a.status, custom_note: a.custom_note }]));
      items = filtered.filter(r => { const e = m.get(r.id); return e && e.status !== 'Not Required'; })
        .map(r => { const e = m.get(r.id); return { requirement_id: r.id, document_name: r.document_name, description: r.description, status: e.status, custom_note: e.custom_note || '', verification: '' }; });
    } else {
      const { data: defaults } = await supabase.from('default_requirements').select('requirement_id, status');
      const dm = new Map((defaults || []).map(d => [d.requirement_id, d.status]));
      items = filtered.filter(r => { const s = dm.get(r.id); return s && s !== 'Not Required'; })
        .map(r => ({ requirement_id: r.id, document_name: r.document_name, description: r.description, status: dm.get(r.id) || 'Required', custom_note: '', verification: '' }));
    }

    if (items.length === 0) {
      items = filtered.map(r => ({ requirement_id: r.id, document_name: r.document_name, description: r.description, status: 'Required', custom_note: '', verification: '' }));
    }
    return items;
  }, [form.destination, form.remainsType]);

  // ── Generate checklist ──
  const handleGenerateChecklist = useCallback(async () => {
    if (!form.awbNumber || !form.origin || !form.destination) {
      setError('Please fill in AWB Number, Origin, and Destination.');
      return;
    }
    setError(''); setLoading(true);
    try {
      const items = await fetchChecklist();
      setChecklistItems(items);
      setCreatedAt(new Date().toISOString());
      setNotes(''); setStep(STEP.CHECKLIST);
    } catch (err) {
      setError(`Failed to generate checklist: ${err.message}`);
    } finally { setLoading(false); }
  }, [form, fetchChecklist]);

  // ── Done editing summary — refresh checklist if destination changed ──
  const handleDoneEditing = async () => {
    setEditingSummary(false);
    setLoading(true);
    try {
      const items = await fetchChecklist();
      // Preserve verification status for items that still exist
      const prevMap = new Map(checklistItems.map(i => [i.requirement_id, i.verification]));
      const merged = items.map(item => ({
        ...item,
        verification: prevMap.get(item.requirement_id) || '',
      }));
      setChecklistItems(merged);
    } catch (err) {
      setError('Failed to refresh: ' + err.message);
    } finally { setLoading(false); }
  };

  const updateVerification = (index, value) => {
    setChecklistItems(p => p.map((item, i) => i === index ? { ...item, verification: value } : item));
  };

  const handlePrint = () => {
    if (!checklistItems.every(i => i.verification !== '')) {
      setError('Please verify all checklist items before printing.'); return;
    }
    setError('');
    setModalType(checklistItems.some(i => i.verification === 'Missing') ? 'warning' : 'success');
    setShowModal(true);
  };

  // ── Submit, generate PDF in new tab, then reset ──
  const handleSubmitAndPrint = async () => {
    if (!employeeId.trim()) return; // both modals now require ID

    const now = new Date().toISOString();
    try {
      await supabase.from('checklist_transactions').insert({
        awb_number: form.awbNumber, origin: form.origin.toUpperCase(),
        destination: form.destination.toUpperCase(), routing: form.routing,
        flight_numbers: form.flightNumbers, shipment_type: form.shipmentType,
        remains_type: form.remainsType, checklist_items: checklistItems,
        all_verified: modalType === 'success', employee_id: employeeId, submitted_at: now,
      });
    } catch (err) { console.error('Error saving:', err); }

    // Build filename: "Document Checklist 016 IAH 12345678"
    const awbDigits = form.awbNumber.replace(/[^0-9]/g, '');
    const prefix = awbDigits.slice(0, 3);
    const suffix = awbDigits.slice(3);
    const fileName = `Document Checklist ${prefix} ${form.origin.toUpperCase()} ${suffix}.pdf`;

    const pdf = generateChecklistPDF({
      awbNumber: form.awbNumber, origin: form.origin.toUpperCase(),
      originDisplay: getAirportDisplay(form.origin),
      destination: form.destination.toUpperCase(),
      destinationDisplay: getAirportDisplay(form.destination),
      routing: form.routing, flightNumbers: form.flightNumbers,
      shipmentType: form.shipmentType, remainsType: form.remainsType,
      checklistItems, notes, employeeId, submittedAt: now,
    });

    // Open in new tab
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Reset form
    setShowModal(false); setEmployeeId('');
    setStep(STEP.INTAKE); setForm(INITIAL_FORM);
    setChecklistItems([]); setError(''); setCreatedAt(null); setNotes('');
  };

  const handleReset = () => {
    setStep(STEP.INTAKE); setForm(INITIAL_FORM); setChecklistItems([]);
    setError(''); setCreatedAt(null); setNotes(''); setShowModal(false); setEmployeeId('');
  };

  // ═══ INTAKE FORM ═══
  if (step === STEP.INTAKE) {
    return (
      <div className="card">
        <h2 className="card__header">Shipment Information</h2>
        {error && <div className="alert alert--warning">{error}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">AWB Number *</label>
            <input type="text" className="form-input" placeholder="e.g. 016-12345678"
              value={form.awbNumber} onChange={handleAwbChange} maxLength={12} />
          </div>
          <div className="form-group">
            <label className="form-label">Remains Type *</label>
            <select className="form-select" value={form.remainsType} onChange={updateField('remainsType')}>
              <option>Human Remains</option><option>Human Remains - ASH</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Origin (ICAO Code) *</label>
            <input type="text" className="form-input" placeholder="e.g. IAH" maxLength={3}
              value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value.toUpperCase() }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Destination (ICAO Code) *</label>
            <input type="text" className="form-input" placeholder="e.g. NRT" maxLength={3}
              value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value.toUpperCase() }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Routing</label>
            <input type="text" className="form-input" placeholder="Type stations separated by spaces"
              value={form.routing} onChange={e => setForm(p => ({ ...p, routing: e.target.value.toUpperCase() }))} onBlur={handleRoutingBlur} />
          </div>
          <div className="form-group">
            <label className="form-label">Flight Numbers</label>
            <input type="text" className="form-input" placeholder="Type flights separated by spaces"
              value={form.flightNumbers} onChange={e => setForm(p => ({ ...p, flightNumbers: e.target.value.toUpperCase() }))} onBlur={handleFlightsBlur} />
          </div>
        </div>
        <div className="button-row">
          <button className="btn btn--primary" onClick={handleGenerateChecklist} disabled={loading}>
            {loading ? <><span className="spinner" /> Generating...</> : 'Generate Checklist'}
          </button>
        </div>
      </div>
    );
  }

  // ═══ CHECKLIST VIEW ═══
  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card__header" style={{ marginBottom: editingSummary ? 16 : undefined }}>Shipment Summary</h2>
          <button className="btn btn--outline btn--sm" onClick={editingSummary ? handleDoneEditing : () => setEditingSummary(true)}
            style={{ marginBottom: editingSummary ? 16 : 8 }}>
            {editingSummary ? 'Done Editing' : 'Edit'}
          </button>
        </div>
        {editingSummary ? (
          <div className="form-grid">
            <div className="form-group"><label className="form-label">AWB Number</label>
              <input type="text" className="form-input" value={form.awbNumber} onChange={handleAwbChange} maxLength={12} /></div>
            <div className="form-group"><label className="form-label">Remains Type</label>
              <select className="form-select" value={form.remainsType} onChange={updateField('remainsType')}>
                <option>Human Remains</option><option>Human Remains - ASH</option></select></div>
            <div className="form-group"><label className="form-label">Origin</label>
              <input type="text" className="form-input" value={form.origin} maxLength={3}
                onChange={e => setForm(p => ({ ...p, origin: e.target.value.toUpperCase() }))} /></div>
            <div className="form-group"><label className="form-label">Destination</label>
              <input type="text" className="form-input" value={form.destination} maxLength={3}
                onChange={e => setForm(p => ({ ...p, destination: e.target.value.toUpperCase() }))} /></div>
            <div className="form-group"><label className="form-label">Routing</label>
              <input type="text" className="form-input" value={form.routing}
                onChange={e => setForm(p => ({ ...p, routing: e.target.value.toUpperCase() }))} onBlur={handleRoutingBlur} /></div>
            <div className="form-group"><label className="form-label">Flight Numbers</label>
              <input type="text" className="form-input" value={form.flightNumbers}
                onChange={e => setForm(p => ({ ...p, flightNumbers: e.target.value.toUpperCase() }))} onBlur={handleFlightsBlur} /></div>
          </div>
        ) : (
          <div className="form-grid" style={{ gap: '8px 24px' }}>
            <div><span className="form-label">AWB: </span><strong>{form.awbNumber}</strong></div>
            <div><span className="form-label">Type: </span><strong>{form.remainsType}</strong></div>
            <div><span className="form-label">Origin: </span><strong>{getAirportDisplay(form.origin)}</strong></div>
            <div><span className="form-label">Destination: </span><strong>{getAirportDisplay(form.destination)}</strong></div>
            <div><span className="form-label">Routing: </span><strong>{form.routing || '—'}</strong></div>
            <div><span className="form-label">Flights: </span><strong>{form.flightNumbers || '—'}</strong></div>
            <div><span className="form-label">Created: </span><strong>{createdAt ? new Date(createdAt).toLocaleString() : '—'}</strong></div>
          </div>
        )}
        {loading && <div className="loading-center" style={{ padding: 12 }}><div className="spinner" /></div>}
      </div>

      <div className="card">
        <h2 className="card__header">Document Verification Checklist</h2>
        {error && <div className="alert alert--warning">{error}</div>}
        <table className="checklist-table">
          <thead><tr><th style={{ width: 40 }}>#</th><th>Document</th><th style={{ width: 150 }}>Requirement</th><th style={{ width: 130 }}>Verification</th></tr></thead>
          <tbody>
            {checklistItems.map((item, idx) => (
              <tr key={item.requirement_id || idx}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.document_name}</div>
                  {item.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.description}</div>}
                  {item.custom_note && (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: '#EBF2FE', border: '1px solid #276EF1', borderLeft: '4px solid #1414D2', borderRadius: 4, fontSize: '0.82rem', color: '#051464', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '1rem' }}>&#9888;</span>{item.custom_note}
                    </div>
                  )}
                </td>
                <td><span className={`status-badge ${item.status === 'Required' ? 'status-badge--required' : item.status === 'Required - Copies OK' ? 'status-badge--copies' : 'status-badge--not-required'}`}>{item.status}</span></td>
                <td><select className={`verification-select ${item.verification === 'Verified' ? 'verification-select--verified' : item.verification === 'Missing' ? 'verification-select--missing' : ''}`}
                  value={item.verification} onChange={e => updateVerification(idx, e.target.value)}>
                  <option value="">— Select —</option><option value="Verified">Verified</option><option value="Missing">Missing</option>
                </select></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label">Notes / Comments</label>
          <textarea className="form-input" rows={3} placeholder="Add any notes or comments..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div className="button-row">
          <button className="btn btn--outline" onClick={handleReset}>Reset & Start Over</button>
          <button className="btn btn--primary" onClick={handlePrint}>Print Checklist</button>
        </div>
      </div>

      {/* Modal — both warning and success now require employee ID */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {modalType === 'warning' ? (
              <>
                <h3 className="modal__title modal__title--warning">⚠ Missing Documents</h3>
                <div className="modal__body">
                  <p><strong>One or more important documents are marked as MISSING.</strong></p>
                  <p style={{ marginTop: 12 }}>Please contact the <strong>Supervisor on Duty</strong> and <strong>TrustUA</strong> for further instructions.</p>
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label className="form-label">Enter your V Number or U Number *</label>
                    <input type="text" className="form-input" placeholder="e.g. V12345" value={employeeId}
                      onChange={e => setEmployeeId(e.target.value.toUpperCase())} autoFocus />
                  </div>
                </div>
                <div className="button-row" style={{ marginTop: 16 }}>
                  <button className="btn btn--outline" onClick={() => setShowModal(false)}>Go Back</button>
                  <button className="btn btn--danger" onClick={handleSubmitAndPrint} disabled={!employeeId.trim()}>Print Anyway</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="modal__title modal__title--success">✓ All Documents Verified</h3>
                <div className="modal__body">
                  <p>I certify that I have checked and verified all documents listed on this checklist and confirm they are complete.</p>
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label className="form-label">Enter your V Number or U Number *</label>
                    <input type="text" className="form-input" placeholder="e.g. V12345" value={employeeId}
                      onChange={e => setEmployeeId(e.target.value.toUpperCase())} autoFocus />
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>Date/Time: {new Date().toLocaleString()}</div>
                </div>
                <div className="button-row" style={{ marginTop: 16 }}>
                  <button className="btn btn--outline" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn btn--primary" onClick={handleSubmitAndPrint} disabled={!employeeId.trim()}>Submit & Print PDF</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
