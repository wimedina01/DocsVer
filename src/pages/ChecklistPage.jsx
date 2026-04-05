import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';
import { getAirportDisplay, getAirportName } from '../lib/airportCodes';
import { isValidEmployeeId, getIdError } from '../lib/validateId';
import { useStation } from '../lib/StationContext';

const STEP = { INTAKE: 'intake', CHECKLIST: 'checklist' };
const INITIAL_FORM = { awbNumber: '', origin: '', destination: '', routing: '', flightNumbers: '', shipmentType: 'Origin', remainsType: 'Human Remains' };

function formatAwb(v) { const d = v.replace(/[^0-9]/g, ''); return d.length <= 3 ? d : d.slice(0, 3) + '-' + d.slice(3, 11); }
function applyDash(v) { if (!v) return ''; return v.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).filter(Boolean).join(' - '); }

export default function ChecklistPage() {
  const { homeStation } = useStation();
  const [step, setStep] = useState(STEP.INTAKE);
  const [form, setForm] = useState({ ...INITIAL_FORM, origin: homeStation || '' });
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  const [notes, setNotes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'success' | 'warning' | 'override'
  const [employeeId, setEmployeeId] = useState('');
  const [idError, setIdError] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [overrideId, setOverrideId] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideIdError, setOverrideIdError] = useState('');
  const [causeOfDeathPendingOk, setCauseOfDeathPendingOk] = useState(false);
  const [showCodWarning, setShowCodWarning] = useState(false);

  useEffect(() => { if (homeStation && !form.origin) setForm(p => ({ ...p, origin: homeStation })); }, [homeStation]);

  const fetchChecklist = useCallback(async () => {
    const dest = form.destination.toUpperCase().trim();
    if (!dest) return { items: [], codPendingOk: false };
    const { data: requirements } = await supabase.from('requirements_matrix').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    const filtered = (requirements || []).filter(r => {
      if (r.applies_to === 'BOTH' || r.applies_to === 'ALL') return true;
      if (form.remainsType === 'Human Remains' && r.applies_to === 'HUMAN_REMAINS') return true;
      if (form.remainsType === 'Human Remains - ASH' && r.applies_to === 'HUMAN_REMAINS_ASH') return true;
      return false;
    });
    const { data: airportReqs } = await supabase.from('airport_requirements').select('requirement_id, status, custom_note, cause_of_death_pending_ok').eq('airport_code', dest);

    let items, codPendingOk = false;
    if (airportReqs && airportReqs.length > 0) {
      // Check if any record has cause_of_death_pending_ok
      codPendingOk = airportReqs.some(a => a.cause_of_death_pending_ok);
      const m = new Map(airportReqs.map(a => [a.requirement_id, { status: a.status, custom_note: a.custom_note }]));
      items = filtered.filter(r => { const e = m.get(r.id); return e && e.status !== 'Not Required'; })
        .map(r => { const e = m.get(r.id); return { requirement_id: r.id, document_name: r.document_name, description: r.description, status: e.status, custom_note: e.custom_note || '', verification: '' }; });
    } else {
      const { data: defaults } = await supabase.from('default_requirements').select('requirement_id, status');
      const dm = new Map((defaults || []).map(d => [d.requirement_id, d.status]));
      items = filtered.filter(r => { const s = dm.get(r.id); return s && s !== 'Not Required'; })
        .map(r => ({ requirement_id: r.id, document_name: r.document_name, description: r.description, status: dm.get(r.id) || 'Required', custom_note: '', verification: '' }));
    }
    if (items.length === 0) items = filtered.map(r => ({ requirement_id: r.id, document_name: r.document_name, description: r.description, status: 'Required', custom_note: '', verification: '' }));

    // If cause of death pending NOT ok, add a line item for it
    if (!codPendingOk) {
      items.push({ requirement_id: 'cod_check', document_name: 'Cause of Death Verification', description: 'Verify cause of death is listed on the death certificate', status: 'Required', custom_note: '', verification: '' });
    }

    return { items, codPendingOk };
  }, [form.destination, form.remainsType]);

  const handleGenerate = useCallback(async () => {
    if (!form.awbNumber || !form.origin || !form.destination) { setError('Please fill in AWB Number, Origin, and Destination.'); return; }
    if (!getAirportName(form.origin)) { setError(`Origin "${form.origin}" is not a recognized airport code.`); return; }
    if (!getAirportName(form.destination)) { setError(`Destination "${form.destination}" is not a recognized airport code.`); return; }
    setError(''); setLoading(true);
    try {
      const { items, codPendingOk } = await fetchChecklist();
      setChecklistItems(items); setCauseOfDeathPendingOk(codPendingOk);
      setCreatedAt(new Date().toISOString()); setNotes(''); setStep(STEP.CHECKLIST);
    } catch (err) { setError(`Failed: ${err.message}`); }
    finally { setLoading(false); }
  }, [form, fetchChecklist]);

  const handleDoneEditing = async () => {
    setEditingSummary(false); setLoading(true);
    try {
      const { items, codPendingOk } = await fetchChecklist();
      const prevMap = new Map(checklistItems.map(i => [i.requirement_id, i.verification]));
      setChecklistItems(items.map(item => ({ ...item, verification: prevMap.get(item.requirement_id) || '' })));
      setCauseOfDeathPendingOk(codPendingOk);
    } catch (err) { setError('Refresh failed: ' + err.message); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    if (!checklistItems.every(i => i.verification !== '')) { setError('Please verify all items.'); return; }
    setError(''); setIdError('');

    // Check cause of death pending
    const codItem = checklistItems.find(i => i.requirement_id === 'cod_check');
    if (codItem && codItem.verification === 'Missing') {
      setShowCodWarning(true); return;
    }

    const hasMissing = checklistItems.filter(i => i.requirement_id !== 'cod_check').some(i => i.verification === 'Missing');
    setModalType(hasMissing ? 'warning' : 'success');
    setShowModal(true);
  };

  const getMissingItems = () => checklistItems.filter(i => i.verification === 'Missing' && i.requirement_id !== 'cod_check');

  // Save transaction
  const saveTransaction = async (extra = {}) => {
    const now = new Date().toISOString();
    await supabase.from('checklist_transactions').insert({
      awb_number: form.awbNumber, origin: form.origin.toUpperCase(), destination: form.destination.toUpperCase(),
      routing: form.routing, flight_numbers: form.flightNumbers, shipment_type: form.shipmentType,
      remains_type: form.remainsType, checklist_items: checklistItems,
      all_verified: !checklistItems.some(i => i.verification === 'Missing'),
      employee_id: employeeId.toUpperCase(), submitted_at: now, ...extra,
    });
  };

  // Success: submit + print + reset
  const handleSubmitAndPrint = async () => {
    const err = getIdError(employeeId);
    if (err) { setIdError(err); return; }
    await saveTransaction();
    printPdf(); resetAll();
  };

  // Warning: Acknowledge (save + go back)
  const handleAcknowledge = async () => {
    const err = getIdError(employeeId);
    if (err) { setIdError(err); return; }
    await saveTransaction();
    setShowModal(false); setEmployeeId('');
  };

  // Warning: Override (supervisor enters UID + notes, then print)
  const handleShowOverride = () => { setModalType('override'); };

  const handleOverrideSubmit = async () => {
    const err = getIdError(overrideId);
    if (err) { setOverrideIdError(err); return; }
    const empErr = getIdError(employeeId);
    if (empErr) { setIdError(empErr); return; }
    await saveTransaction({
      override_by: overrideId.toUpperCase(), override_notes: overrideNotes,
      override_at: new Date().toISOString(),
    });
    printPdf(); resetAll();
  };

  const printPdf = () => {
    const pdf = generateChecklistPDF({
      awbNumber: form.awbNumber, origin: form.origin.toUpperCase(), originDisplay: getAirportDisplay(form.origin),
      destination: form.destination.toUpperCase(), destinationDisplay: getAirportDisplay(form.destination),
      routing: form.routing, flightNumbers: form.flightNumbers, shipmentType: form.shipmentType,
      remainsType: form.remainsType, checklistItems: checklistItems.filter(i => i.requirement_id !== 'cod_check'),
      notes, employeeId: employeeId.toUpperCase(), submittedAt: new Date().toISOString(),
    });
    window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
  };

  const resetAll = () => {
    setShowModal(false); setEmployeeId(''); setOverrideId(''); setOverrideNotes('');
    setStep(STEP.INTAKE); setForm({ ...INITIAL_FORM, origin: homeStation || '' });
    setChecklistItems([]); setError(''); setCreatedAt(null); setNotes('');
  };

  const handleReset = () => { setChecklistItems(p => p.map(i => ({ ...i, verification: '' }))); setNotes(''); setError(''); };

  // ═══ INTAKE ═══
  if (step === STEP.INTAKE) {
    return (
      <div className="card">
        <h2 className="card__header">Shipment Information</h2>
        {error && <div className="alert alert--warning">{error}</div>}
        <div className="form-grid">
          <div className="form-group"><label className="form-label">AWB Number *</label>
            <input type="text" className="form-input" placeholder="e.g. 016-12345678" value={form.awbNumber} onChange={e => setForm(p => ({ ...p, awbNumber: formatAwb(e.target.value) }))} maxLength={12} /></div>
          <div className="form-group"><label className="form-label">Remains Type *</label>
            <select className="form-select" value={form.remainsType} onChange={e => setForm(p => ({ ...p, remainsType: e.target.value }))}>
              <option>Human Remains</option><option>Human Remains - ASH</option></select></div>
          <div className="form-group"><label className="form-label">Origin *</label>
            <input type="text" className="form-input" placeholder="e.g. IAH" maxLength={3} value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value.toUpperCase() }))} /></div>
          <div className="form-group"><label className="form-label">Destination *</label>
            <input type="text" className="form-input" placeholder="e.g. BOG" maxLength={3} value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value.toUpperCase() }))} /></div>
          <div className="form-group"><label className="form-label">Routing</label>
            <input type="text" className="form-input" placeholder="Stations separated by spaces" value={form.routing} onChange={e => setForm(p => ({ ...p, routing: e.target.value.toUpperCase() }))} onBlur={() => setForm(p => ({ ...p, routing: applyDash(p.routing) }))} /></div>
          <div className="form-group"><label className="form-label">Flight Numbers</label>
            <input type="text" className="form-input" placeholder="Flights separated by spaces" value={form.flightNumbers} onChange={e => setForm(p => ({ ...p, flightNumbers: e.target.value.toUpperCase() }))} onBlur={() => setForm(p => ({ ...p, flightNumbers: applyDash(p.flightNumbers) }))} /></div>
        </div>
        <div className="button-row">
          <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
            {loading ? <><span className="spinner" /> Generating...</> : 'Generate Checklist'}
          </button>
        </div>
      </div>
    );
  }

  // ═══ CHECKLIST ═══
  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card__header" style={{ marginBottom: editingSummary ? 16 : undefined }}>Shipment Summary</h2>
          <button className="btn btn--outline btn--sm" onClick={editingSummary ? handleDoneEditing : () => setEditingSummary(true)} style={{ marginBottom: 8 }}>
            {editingSummary ? 'Done Editing' : 'Edit'}</button>
        </div>
        {editingSummary ? (
          <div className="form-grid">
            <div className="form-group"><label className="form-label">AWB</label><input type="text" className="form-input" value={form.awbNumber} onChange={e => setForm(p => ({ ...p, awbNumber: formatAwb(e.target.value) }))} maxLength={12} /></div>
            <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={form.remainsType} onChange={e => setForm(p => ({ ...p, remainsType: e.target.value }))}><option>Human Remains</option><option>Human Remains - ASH</option></select></div>
            <div className="form-group"><label className="form-label">Origin</label><input type="text" className="form-input" value={form.origin} maxLength={3} onChange={e => setForm(p => ({ ...p, origin: e.target.value.toUpperCase() }))} /></div>
            <div className="form-group"><label className="form-label">Destination</label><input type="text" className="form-input" value={form.destination} maxLength={3} onChange={e => setForm(p => ({ ...p, destination: e.target.value.toUpperCase() }))} /></div>
            <div className="form-group"><label className="form-label">Routing</label><input type="text" className="form-input" value={form.routing} onChange={e => setForm(p => ({ ...p, routing: e.target.value.toUpperCase() }))} onBlur={() => setForm(p => ({ ...p, routing: applyDash(p.routing) }))} /></div>
            <div className="form-group"><label className="form-label">Flights</label><input type="text" className="form-input" value={form.flightNumbers} onChange={e => setForm(p => ({ ...p, flightNumbers: e.target.value.toUpperCase() }))} onBlur={() => setForm(p => ({ ...p, flightNumbers: applyDash(p.flightNumbers) }))} /></div>
          </div>
        ) : (
          <div className="form-grid" style={{ gap: '8px 24px' }}>
            <div><span className="form-label">AWB: </span><strong>{form.awbNumber}</strong></div>
            <div><span className="form-label">Type: </span><strong>{form.remainsType}</strong></div>
            <div><span className="form-label">Origin: </span><strong>{getAirportDisplay(form.origin)}</strong></div>
            <div><span className="form-label">Destination: </span><strong>{getAirportDisplay(form.destination)}</strong></div>
            <div><span className="form-label">Routing: </span><strong>{form.routing || '—'}</strong></div>
            <div><span className="form-label">Flights: </span><strong>{form.flightNumbers || '—'}</strong></div>
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
                  {item.description && <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 2 }}>{item.description}</div>}
                  {item.custom_note && <div className="custom-note-banner"><span>&#9888;</span>{item.custom_note}</div>}
                </td>
                <td><span className={`status-badge ${item.status === 'Required' ? 'status-badge--required' : item.status === 'Required - Copies OK' ? 'status-badge--copies' : 'status-badge--not-required'}`}>{item.status}</span></td>
                <td><select className={`verification-select ${item.verification === 'Verified' ? 'verification-select--verified' : item.verification === 'Missing' ? 'verification-select--missing' : ''}`}
                  value={item.verification} onChange={e => setChecklistItems(p => p.map((it, i) => i === idx ? { ...it, verification: e.target.value } : it))}>
                  <option value="">— Select —</option><option value="Verified">Verified</option><option value="Missing">Missing</option></select></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-group" style={{ marginTop: 20 }}><label className="form-label">Notes / Comments</label>
          <textarea className="form-input" rows={3} placeholder="Add any notes..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <div className="button-row">
          <button className="btn btn--outline" onClick={resetAll}>Cancel</button>
          <button className="btn btn--outline" onClick={handleReset}>Reset Checklist</button>
          <button className="btn btn--primary" onClick={handlePrint}>Print Checklist</button>
        </div>
      </div>

      {/* Cause of Death Pending Warning */}
      {showCodWarning && (
        <div className="modal-overlay"><div className="modal">
          <h3 className="modal__title modal__title--warning">⚠ AWB Not Permitted to Travel</h3>
          <div className="modal__body">
            <p>AWB <strong>{form.awbNumber}</strong> is not permitted to travel to <strong>{getAirportDisplay(form.destination)}</strong>.</p>
            <p style={{ marginTop: 12 }}>Cause of Death is pending. Contact the <strong>Supervisor on Duty</strong> and <strong>TrustUA</strong> and advise of the issue. Await further instructions.</p>
          </div>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button className="btn btn--primary" onClick={() => { setShowCodWarning(false); saveTransaction({ employee_id: 'COD_PENDING' }); }}>Acknowledge</button>
          </div>
        </div></div>
      )}

      {/* Main Modal */}
      {showModal && (
        <div className="modal-overlay"><div className="modal" onClick={e => e.stopPropagation()}>
          {modalType === 'warning' ? (
            <>
              <h3 className="modal__title modal__title--warning">⚠ AWB Not Permitted to Travel</h3>
              <div className="modal__body">
                <p>Notify the <strong>Supervisor on Duty</strong> and <strong>TrustUA</strong> and advise of the following issues:</p>
                <ul style={{ marginTop: 8, marginLeft: 20, color: 'var(--alert-red)' }}>
                  {getMissingItems().map((item, i) => <li key={i} style={{ fontWeight: 600, marginBottom: 4 }}>{item.document_name}</li>)}
                </ul>
                <p style={{ marginTop: 12 }}>Await for further instructions.</p>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Your Employee ID *</label>
                  <input type="text" className="form-input" placeholder="e.g. V123456" value={employeeId} maxLength={7}
                    onChange={e => { setEmployeeId(e.target.value.toUpperCase()); setIdError(''); }} />
                  {idError && <div style={{ color: 'var(--alert-red)', fontSize: 12, marginTop: 4, fontWeight: 600 }}>{idError}</div>}
                </div>
              </div>
              <div className="button-row" style={{ marginTop: 16 }}>
                <button className="btn btn--outline" onClick={() => setShowModal(false)}>Go Back</button>
                <button className="btn btn--primary" onClick={handleAcknowledge} disabled={!employeeId.trim()}>Acknowledge</button>
                <button className="btn btn--danger" onClick={handleShowOverride} disabled={!employeeId.trim()}>Override</button>
              </div>
            </>
          ) : modalType === 'override' ? (
            <>
              <h3 className="modal__title" style={{ color: 'var(--united-blue)' }}>Supervisor Override</h3>
              <div className="modal__body">
                <p>Supervisor must authorize this override. All missing items will be noted on the record.</p>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Supervisor ID *</label>
                  <input type="text" className="form-input" placeholder="e.g. V123456" value={overrideId} maxLength={7}
                    onChange={e => { setOverrideId(e.target.value.toUpperCase()); setOverrideIdError(''); }} />
                  {overrideIdError && <div style={{ color: 'var(--alert-red)', fontSize: 12, marginTop: 4, fontWeight: 600 }}>{overrideIdError}</div>}
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Override Notes *</label>
                  <textarea className="form-input" rows={3} placeholder="Reason for override..." value={overrideNotes} onChange={e => setOverrideNotes(e.target.value)} />
                </div>
              </div>
              <div className="button-row" style={{ marginTop: 16 }}>
                <button className="btn btn--outline" onClick={() => setModalType('warning')}>Back</button>
                <button className="btn btn--primary" onClick={handleOverrideSubmit} disabled={!overrideId.trim() || !overrideNotes.trim()}>Override & Print</button>
              </div>
            </>
          ) : (
            <>
              <h3 className="modal__title modal__title--success">✓ All Documents Verified</h3>
              <div className="modal__body">
                <p>I certify that all documents are complete and verified.</p>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Employee ID *</label>
                  <input type="text" className="form-input" placeholder="e.g. V123456" value={employeeId} maxLength={7}
                    onChange={e => { setEmployeeId(e.target.value.toUpperCase()); setIdError(''); }} autoFocus />
                  {idError && <div style={{ color: 'var(--alert-red)', fontSize: 12, marginTop: 4, fontWeight: 600 }}>{idError}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8 }}>Date/Time: {new Date().toLocaleString()}</div>
              </div>
              <div className="button-row" style={{ marginTop: 16 }}>
                <button className="btn btn--outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleSubmitAndPrint} disabled={!employeeId.trim()}>Submit & Print PDF</button>
              </div>
            </>
          )}
        </div></div>
      )}
    </>
  );
}
