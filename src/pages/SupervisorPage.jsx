import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';
import { getAirportDisplay } from '../lib/airportCodes';
import { isValidEmployeeId, getIdError } from '../lib/validateId';
import { useStation } from '../lib/StationContext';

function formatAwb(v) { const d = v.replace(/[^0-9]/g, ''); return d.length <= 3 ? d : d.slice(0, 3) + '-' + d.slice(3, 11); }

export default function SupervisorPage() {
  const { homeStation } = useStation();
  const [searchAwb, setSearchAwb] = useState('');
  const [pending, setPending] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [supId, setSupId] = useState('');
  const [idError, setIdError] = useState('');
  const [signed, setSigned] = useState(false);
  const [verifications, setVerifications] = useState({});
  const [completedIds, setCompletedIds] = useState(new Set());
  // Manual verify modal
  const [showManualModal, setShowManualModal] = useState(null); // tx object or null
  const [manualSupId, setManualSupId] = useState('');
  const [manualIdError, setManualIdError] = useState('');

  useEffect(() => { if (homeStation) loadPending(); }, [homeStation]);

  const loadPending = async () => {
    if (!homeStation) return;
    setLoading(true);
    try {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('checklist_transactions').select('*')
        .gte('submitted_at', fiveDaysAgo).order('submitted_at', { ascending: false }).limit(100);
      const hs = homeStation.toUpperCase();
      const filtered = (data || []).filter(tx => {
        if (tx.origin === hs || tx.destination === hs) return true;
        if (tx.routing) {
          const stops = tx.routing.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).map(s => s.toUpperCase());
          if (stops.includes(hs)) return true;
        }
        return false;
      });
      setPending(filtered);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchAwb.trim()) { setSearchResults(null); return; }
    setLoading(true);
    try {
      const clean = searchAwb.replace(/[^0-9-]/g, '');
      const { data } = await supabase.from('checklist_transactions').select('*').ilike('awb_number', `%${clean}%`).order('submitted_at', { ascending: false }).limit(20);
      setSearchResults(data || []); setSelected(null); setSigned(false);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Get existing supervisor signoffs from the transaction
  const getSupervisorSignoffs = (tx) => {
    // Stored as JSON array in supervisor_notes field: [{station, id, at}, ...]
    try {
      if (tx.supervisor_notes) return JSON.parse(tx.supervisor_notes);
    } catch (e) {}
    // Legacy: single supervisor_id
    if (tx.supervisor_id) return [{ station: tx.origin, id: tx.supervisor_id, at: tx.supervisor_reviewed_at }];
    return [];
  };

  const handleSelect = (tx) => {
    setSelected(tx); setSigned(false); setSupId(''); setIdError('');
    const v = {};
    (tx.checklist_items || []).forEach((_, i) => { v[i] = ''; });
    setVerifications(v);
  };

  const allVerified = selected && (selected.checklist_items || []).every((_, i) => verifications[i] && verifications[i] !== '');

  const handleSign = async () => {
    const err = getIdError(supId);
    if (err) { setIdError(err); return; }
    if (!allVerified) { setIdError('Please verify all items before signing.'); return; }

    try {
      // Build updated checklist items with this supervisor's verifications
      const updatedItems = (selected.checklist_items || []).map((item, i) => ({
        ...item,
        [`sup_${homeStation}`]: verifications[i],
      }));

      // Append this supervisor signoff to the list
      const existingSignoffs = getSupervisorSignoffs(selected);
      const newSignoffs = [...existingSignoffs, {
        station: homeStation.toUpperCase(),
        id: supId.toUpperCase(),
        at: new Date().toISOString(),
      }];

      await supabase.from('checklist_transactions').update({
        checklist_items: updatedItems,
        supervisor_id: supId.toUpperCase(),
        supervisor_notes: JSON.stringify(newSignoffs),
        supervisor_reviewed_at: new Date().toISOString(),
      }).eq('id', selected.id);
    } catch (e) { console.error(e); }

    setSigned(true);
    setCompletedIds(prev => new Set([...prev, selected.id]));
  };

  // Manual verify — quick sign without going through checklist
  const handleManualVerify = async () => {
    const err = getIdError(manualSupId);
    if (err) { setManualIdError(err); return; }

    const tx = showManualModal;
    try {
      const existingSignoffs = getSupervisorSignoffs(tx);
      const newSignoffs = [...existingSignoffs, {
        station: homeStation.toUpperCase(),
        id: manualSupId.toUpperCase(),
        at: new Date().toISOString(),
        manual: true,
      }];

      // Mark all items with manual verification for this station
      const updatedItems = (tx.checklist_items || []).map(item => ({
        ...item,
        [`sup_${homeStation}`]: 'Manually Verified',
      }));

      await supabase.from('checklist_transactions').update({
        checklist_items: updatedItems,
        supervisor_id: manualSupId.toUpperCase(),
        supervisor_notes: JSON.stringify(newSignoffs),
        supervisor_reviewed_at: new Date().toISOString(),
      }).eq('id', tx.id);
    } catch (e) { console.error(e); }

    setCompletedIds(prev => new Set([...prev, tx.id]));
    setShowManualModal(null); setManualSupId(''); setManualIdError('');
    loadPending(); // Refresh list
  };

  const handlePrint = () => {
    if (!selected) return;
    const updatedItems = (selected.checklist_items || []).map((item, i) => ({
      ...item, verification: verifications[i] || item.verification,
    }));

    // Collect all supervisor signoffs for the PDF
    const existingSignoffs = getSupervisorSignoffs(selected);
    const allSignoffs = [...existingSignoffs, {
      station: homeStation.toUpperCase(), id: supId.toUpperCase(), at: new Date().toISOString(),
    }];

    const pdf = generateChecklistPDF({
      awbNumber: selected.awb_number, origin: selected.origin,
      originDisplay: getAirportDisplay(selected.origin),
      destination: selected.destination, destinationDisplay: getAirportDisplay(selected.destination),
      routing: selected.routing, flightNumbers: selected.flight_numbers,
      shipmentType: selected.shipment_type, remainsType: selected.remains_type,
      checklistItems: updatedItems, notes: '',
      employeeId: selected.employee_id || '', submittedAt: selected.submitted_at,
      supervisorSignoffs: allSignoffs,
    });
    window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
  };

  const displayList = (searchResults !== null ? searchResults : pending).filter(tx => !completedIds.has(tx.id));

  return (
    <>
      <div className="card">
        <h2 className="card__header">Supervisor Review {homeStation && `— ${homeStation}`}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          Review pending checklists, verify documents, sign, and print. Use <strong>Manual Verify</strong> if the paper checklist was already completed.
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input type="text" className="form-input" placeholder="AWB: XXX-XXXXXXXX"
            value={searchAwb} onChange={e => setSearchAwb(formatAwb(e.target.value))} maxLength={12}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} style={{ flex: 1 }} />
          <button className="btn btn--primary btn--sm" onClick={handleSearch} disabled={loading}>Search</button>
          {searchResults !== null && <button className="btn btn--outline btn--sm" onClick={() => setSearchResults(null)}>Show Pending</button>}
        </div>

        {!selected && displayList.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {searchResults !== null ? 'Search Results' : `Pending — ${homeStation}`}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Date</th><th>AWB</th><th>Origin</th><th>Dest</th><th>Routing</th><th>Agent</th><th>Status</th><th>Supervisors</th><th></th></tr></thead>
                <tbody>{displayList.map(tx => {
                  const signoffs = getSupervisorSignoffs(tx);
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(tx.submitted_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td><strong>{tx.awb_number}</strong></td><td>{tx.origin}</td><td>{tx.destination}</td>
                      <td style={{ fontSize: 12 }}>{tx.routing || '—'}</td>
                      <td>{tx.employee_id || '—'}</td>
                      <td><span className={`status-badge ${tx.all_verified ? 'status-badge--not-required' : 'status-badge--required'}`}>{tx.all_verified ? 'Verified' : 'Missing'}</span></td>
                      <td style={{ fontSize: 11 }}>
                        {signoffs.length > 0 ? signoffs.map((s, i) => (
                          <div key={i} style={{ color: 'var(--alert-green)', fontWeight: 600 }}>
                            ✓ {s.station}{s.manual ? ' (M)' : ''} — {s.id}
                          </div>
                        )) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn--primary btn--sm" onClick={() => handleSelect(tx)}>Review</button>
                          <button className="btn btn--outline btn--sm" onClick={() => { setShowManualModal(tx); setManualSupId(''); setManualIdError(''); }}
                            title="Mark as manually verified (paper checklist completed)">Manual</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>
        )}
        {!selected && displayList.length === 0 && !loading && (
          <div className="alert alert--info">{homeStation ? `No pending checklists for ${homeStation}.` : 'Set a home station to see pending checklists.'}</div>
        )}
      </div>

      {/* Manual Verify Modal */}
      {showManualModal && (
        <div className="modal-overlay"><div className="modal" onClick={e => e.stopPropagation()}>
          <h3 className="modal__title" style={{ color: 'var(--united-blue)' }}>Manual Verification</h3>
          <div className="modal__body">
            <p>AWB <strong>{showManualModal.awb_number}</strong> — {showManualModal.origin} → {showManualModal.destination}</p>
            <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
              This will record that the paper checklist was completed and verified manually at station <strong>{homeStation}</strong>.
            </p>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Supervisor ID *</label>
              <input type="text" className="form-input" placeholder="e.g. V123456" value={manualSupId} maxLength={7}
                onChange={e => { setManualSupId(e.target.value.toUpperCase()); setManualIdError(''); }} autoFocus />
              {manualIdError && <div style={{ color: 'var(--alert-red)', fontSize: 12, marginTop: 4, fontWeight: 600 }}>{manualIdError}</div>}
            </div>
          </div>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button className="btn btn--outline" onClick={() => setShowManualModal(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleManualVerify} disabled={!manualSupId.trim()}>Confirm Manual Verification</button>
          </div>
        </div></div>
      )}

      {/* Review Detail */}
      {selected && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="card__header" style={{ marginBottom: 0 }}>Review — {selected.awb_number}</h2>
            <button className="btn btn--outline btn--sm" onClick={() => { setSelected(null); setSigned(false); }}>← Back</button>
          </div>

          <div className="form-grid" style={{ gap: '8px 24px', marginBottom: 12 }}>
            <div><span className="form-label">AWB: </span><strong>{selected.awb_number}</strong></div>
            <div><span className="form-label">Type: </span><strong>{selected.remains_type}</strong></div>
            <div><span className="form-label">Origin: </span><strong>{getAirportDisplay(selected.origin)}</strong></div>
            <div><span className="form-label">Dest: </span><strong>{getAirportDisplay(selected.destination)}</strong></div>
            <div><span className="form-label">Routing: </span><strong>{selected.routing || '—'}</strong></div>
            <div><span className="form-label">Agent: </span><strong>{selected.employee_id || '—'}</strong></div>
          </div>

          {/* Show existing supervisor signoffs */}
          {getSupervisorSignoffs(selected).length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--light-green)', borderRadius: 8, border: '1px solid var(--alert-green)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--alert-green)' }}>Previous Supervisor Verifications:</div>
              {getSupervisorSignoffs(selected).map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--dark-green)' }}>
                  ✓ <strong>{s.station}</strong> — {s.id} — {new Date(s.at).toLocaleString()}{s.manual ? ' (Manual)' : ''}
                </div>
              ))}
            </div>
          )}

          <table className="checklist-table">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Document</th><th style={{ width: 110 }}>Status</th><th style={{ width: 100 }}>Agent</th><th style={{ width: 130 }}>Supervisor Review</th></tr></thead>
            <tbody>{(selected.checklist_items || []).map((item, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                <td><div style={{ fontWeight: 500 }}>{item.document_name}</div>
                  {item.custom_note && <div className="custom-note-banner"><span>&#9888;</span>{item.custom_note}</div>}</td>
                <td><span className={`status-badge ${item.status === 'Required' ? 'status-badge--required' : 'status-badge--copies'}`}>{item.status}</span></td>
                <td><span style={{ color: item.verification === 'Missing' ? 'var(--alert-red)' : 'var(--alert-green)', fontWeight: 600 }}>{item.verification || '—'}</span></td>
                <td>{!signed ? (
                  <select className={`verification-select ${verifications[idx] === 'Verified' ? 'verification-select--verified' : verifications[idx] === 'Missing' ? 'verification-select--missing' : ''}`}
                    value={verifications[idx] || ''} onChange={e => setVerifications(p => ({ ...p, [idx]: e.target.value }))}>
                    <option value="">— Select —</option><option value="Verified">Verified</option><option value="Missing">Missing</option>
                  </select>
                ) : <span style={{ color: verifications[idx] === 'Missing' ? 'var(--alert-red)' : 'var(--alert-green)', fontWeight: 600 }}>{verifications[idx]}</span>}</td>
              </tr>
            ))}</tbody>
          </table>

          <div style={{ marginTop: 24, padding: 20, background: 'var(--medium-tonal-grey-20)', borderRadius: 10, border: '2px solid var(--united-blue)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--united-blue)' }}>
              Supervisor Sign-Off — {homeStation || 'Station'}
            </h3>
            {!signed ? (
              <>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  By signing, I confirm I have reviewed all documents for station {homeStation || 'N/A'}.
                </p>
                <div className="form-group" style={{ maxWidth: 300 }}>
                  <label className="form-label">Supervisor ID *</label>
                  <input type="text" className="form-input" placeholder="e.g. V123456" value={supId} maxLength={7}
                    onChange={e => { setSupId(e.target.value.toUpperCase()); setIdError(''); }} />
                  {idError && <div style={{ color: 'var(--alert-red)', fontSize: 12, marginTop: 4, fontWeight: 600 }}>{idError}</div>}
                </div>
                <div className="button-row" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                  <button className="btn btn--primary" onClick={handleSign} disabled={!supId.trim()}>Sign & Verify</button>
                </div>
              </>
            ) : (
              <>
                <div className="alert alert--success" style={{ marginBottom: 12 }}>
                  ✓ Signed by <strong>{supId.toUpperCase()}</strong> at <strong>{homeStation}</strong> — {new Date().toLocaleString()}
                </div>
                <div className="button-row" style={{ justifyContent: 'flex-start' }}>
                  <button className="btn btn--primary" onClick={handlePrint}>Print Signed PDF</button>
                  <button className="btn btn--outline" onClick={() => { setSelected(null); setSigned(false); }}>Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
