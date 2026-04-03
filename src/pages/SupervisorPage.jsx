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
  const [results, setResults] = useState([]);
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [supId, setSupId] = useState('');
  const [idError, setIdError] = useState('');
  const [signed, setSigned] = useState(false);
  const [verifications, setVerifications] = useState({});

  // Load pending checklists for home station on mount
  useEffect(() => {
    if (!homeStation) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('checklist_transactions').select('*')
          .or(`origin.eq.${homeStation.toUpperCase()},destination.eq.${homeStation.toUpperCase()}`)
          .order('submitted_at', { ascending: false }).limit(50);
        setPending(data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [homeStation]);

  const handleSearch = async () => {
    if (!searchAwb.trim()) return;
    setLoading(true);
    try {
      const cleanAwb = searchAwb.replace(/[^0-9-]/g, '');
      let query = supabase.from('checklist_transactions').select('*').ilike('awb_number', `%${cleanAwb}%`).order('submitted_at', { ascending: false }).limit(20);
      if (homeStation) query = query.or(`origin.eq.${homeStation.toUpperCase()},destination.eq.${homeStation.toUpperCase()}`);
      const { data } = await query;
      setResults(data || []);
      setSelected(null); setSigned(false);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSelect = (tx) => {
    setSelected(tx); setSigned(false); setSupId(''); setIdError('');
    // Initialize supervisor verifications from existing checklist
    const v = {};
    (tx.checklist_items || []).forEach((item, i) => { v[i] = item.verification || ''; });
    setVerifications(v);
  };

  const updateVerification = (idx, val) => {
    setVerifications(prev => ({ ...prev, [idx]: val }));
  };

  const allVerified = selected && (selected.checklist_items || []).every((_, i) => verifications[i] && verifications[i] !== '');

  const handleSign = () => {
    const err = getIdError(supId);
    if (err) { setIdError(err); return; }
    if (!allVerified) { setIdError('Please verify all items before signing.'); return; }
    setSigned(true);
  };

  const handlePrint = () => {
    if (!selected) return;
    // Merge supervisor verifications into checklist items
    const updatedItems = (selected.checklist_items || []).map((item, i) => ({
      ...item,
      verification: verifications[i] || item.verification,
    }));
    const pdf = generateChecklistPDF({
      awbNumber: selected.awb_number, origin: selected.origin,
      originDisplay: getAirportDisplay(selected.origin),
      destination: selected.destination, destinationDisplay: getAirportDisplay(selected.destination),
      routing: selected.routing, flightNumbers: selected.flight_numbers,
      shipmentType: selected.shipment_type, remainsType: selected.remains_type,
      checklistItems: updatedItems, notes: '',
      employeeId: selected.employee_id || '', submittedAt: selected.submitted_at,
      supervisorId: supId.toUpperCase(), supervisorStation: homeStation || '',
    });
    window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
  };

  const displayList = results.length > 0 ? results : pending;

  return (
    <>
      <div className="card">
        <h2 className="card__header">Supervisor Review & Sign-Off {homeStation && `— ${homeStation}`}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          Search by AWB or select a pending checklist below to review, verify, sign, and print.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input type="text" className="form-input" placeholder="AWB: XXX-XXXXXXXX"
            value={searchAwb} onChange={e => setSearchAwb(formatAwb(e.target.value))} maxLength={12}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} style={{ flex: 1 }} />
          <button className="btn btn--primary btn--sm" onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          {results.length > 0 && (
            <button className="btn btn--outline btn--sm" onClick={() => setResults([])}>Show All Pending</button>
          )}
        </div>

        {!selected && displayList.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {results.length > 0 ? 'Search Results' : `Pending Checklists — ${homeStation || 'All Stations'}`}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Date</th><th>AWB</th><th>Origin</th><th>Dest</th><th>Agent</th><th>Status</th><th></th></tr></thead>
                <tbody>{displayList.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: 12 }}>{new Date(tx.submitted_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>{tx.awb_number}</strong></td><td>{tx.origin}</td><td>{tx.destination}</td>
                    <td>{tx.employee_id || '—'}</td>
                    <td><span className={`status-badge ${tx.all_verified ? 'status-badge--not-required' : 'status-badge--required'}`}>{tx.all_verified ? 'Verified' : 'Missing'}</span></td>
                    <td><button className="btn btn--primary btn--sm" onClick={() => handleSelect(tx)}>Review</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}

        {!selected && displayList.length === 0 && !loading && (
          <div className="alert alert--info">
            {homeStation ? `No pending checklists for ${homeStation}. Try searching by AWB above.` : 'Set a home station to see pending checklists, or search by AWB.'}
          </div>
        )}
      </div>

      {selected && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="card__header" style={{ marginBottom: 0 }}>Review — AWB {selected.awb_number}</h2>
            <button className="btn btn--outline btn--sm" onClick={() => { setSelected(null); setSigned(false); }}>← Back</button>
          </div>

          <div className="form-grid" style={{ gap: '8px 24px', marginBottom: 20 }}>
            <div><span className="form-label">AWB: </span><strong>{selected.awb_number}</strong></div>
            <div><span className="form-label">Type: </span><strong>{selected.remains_type}</strong></div>
            <div><span className="form-label">Origin: </span><strong>{getAirportDisplay(selected.origin)}</strong></div>
            <div><span className="form-label">Dest: </span><strong>{getAirportDisplay(selected.destination)}</strong></div>
            <div><span className="form-label">Routing: </span><strong>{selected.routing || '—'}</strong></div>
            <div><span className="form-label">Flights: </span><strong>{selected.flight_numbers || '—'}</strong></div>
            <div><span className="form-label">Agent: </span><strong>{selected.employee_id || '—'}</strong></div>
            <div><span className="form-label">Submitted: </span><strong>{new Date(selected.submitted_at).toLocaleString()}</strong></div>
          </div>

          <table className="checklist-table">
            <thead><tr>
              <th style={{ width: 40 }}>#</th><th>Document</th><th style={{ width: 130 }}>Status</th>
              <th style={{ width: 120 }}>Agent</th><th style={{ width: 130 }}>Supervisor Review</th>
            </tr></thead>
            <tbody>{(selected.checklist_items || []).map((item, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.document_name}</div>
                  {item.custom_note && <div className="custom-note-banner"><span>&#9888;</span>{item.custom_note}</div>}
                </td>
                <td><span className={`status-badge ${item.status === 'Required' ? 'status-badge--required' : item.status === 'Required - Copies OK' ? 'status-badge--copies' : 'status-badge--not-required'}`}>{item.status}</span></td>
                <td><span style={{ color: item.verification === 'Missing' ? 'var(--alert-red)' : 'var(--alert-green)', fontWeight: 600 }}>{item.verification || '—'}</span></td>
                <td>
                  {!signed ? (
                    <select
                      className={`verification-select ${verifications[idx] === 'Verified' ? 'verification-select--verified' : verifications[idx] === 'Missing' ? 'verification-select--missing' : ''}`}
                      value={verifications[idx] || ''}
                      onChange={e => updateVerification(idx, e.target.value)}
                    >
                      <option value="">— Select —</option>
                      <option value="Verified">Verified</option>
                      <option value="Missing">Missing</option>
                    </select>
                  ) : (
                    <span style={{ color: verifications[idx] === 'Missing' ? 'var(--alert-red)' : 'var(--alert-green)', fontWeight: 600 }}>{verifications[idx]}</span>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>

          {/* Supervisor Sign-off */}
          <div style={{ marginTop: 24, padding: 20, background: 'var(--medium-tonal-grey-20)', borderRadius: 10, border: '2px solid var(--united-blue)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--united-blue)' }}>
              Supervisor Electronic Sign-Off — {homeStation || 'Station'}
            </h3>
            {!signed ? (
              <>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  By signing, I confirm I have reviewed all documents and verify they are complete for station {homeStation || 'N/A'}.
                </p>
                <div className="form-group" style={{ maxWidth: 300 }}>
                  <label className="form-label">Supervisor ID (1 letter + 6 digits) *</label>
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
                  ✓ Signed by <strong>{supId.toUpperCase()}</strong> at <strong>{homeStation || 'N/A'}</strong> — {new Date().toLocaleString()}
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
