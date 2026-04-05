import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';
import { getAirportDisplay } from '../lib/airportCodes';
import { useStation } from '../lib/StationContext';

export default function HistoryPage() {
  const { homeStation } = useStation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [searchAwb, setSearchAwb] = useState('');
  const [searchAgent, setSearchAgent] = useState('');
  const [filterDest, setFilterDest] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleted90, setDeleted90] = useState(0);

  useEffect(() => { cleanup90Days(); loadTransactions(); }, [homeStation]);

  const cleanup90Days = async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const { data } = await supabase.from('checklist_transactions').delete().lt('submitted_at', cutoff).select('id');
      if (data && data.length > 0) setDeleted90(data.length);
    } catch (e) { console.error(e); }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('checklist_transactions').select('*').order('submitted_at', { ascending: false }).limit(300);
      // Filter by home station — routing-aware
      let filtered = data || [];
      if (homeStation) {
        const hs = homeStation.toUpperCase();
        filtered = filtered.filter(tx => {
          if (tx.origin === hs || tx.destination === hs) return true;
          if (tx.routing) {
            const stops = tx.routing.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).map(s => s.toUpperCase());
            if (stops.includes(hs)) return true;
          }
          return false;
        });
      }
      setTransactions(filtered);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const searchFiltered = transactions.filter(t => {
    if (searchAwb && !t.awb_number.toLowerCase().includes(searchAwb.toLowerCase())) return false;
    if (searchAgent && !(t.employee_id || '').toLowerCase().includes(searchAgent.toLowerCase())) return false;
    if (filterDest && t.destination !== filterDest.toUpperCase()) return false;
    if (filterStatus === 'verified' && !t.all_verified) return false;
    if (filterStatus === 'missing' && t.all_verified) return false;
    return true;
  });

  const handleReprint = (tx) => {
    // Parse all supervisor signoffs for the PDF
    let signoffs = [];
    try { if (tx.supervisor_notes) signoffs = JSON.parse(tx.supervisor_notes); } catch (e) {}
    if (signoffs.length === 0 && tx.supervisor_id) signoffs = [{ station: tx.origin, id: tx.supervisor_id, at: tx.supervisor_reviewed_at }];

    const pdf = generateChecklistPDF({
      awbNumber: tx.awb_number, origin: tx.origin, originDisplay: getAirportDisplay(tx.origin),
      destination: tx.destination, destinationDisplay: getAirportDisplay(tx.destination),
      routing: tx.routing, flightNumbers: tx.flight_numbers, shipmentType: tx.shipment_type,
      remainsType: tx.remains_type, checklistItems: tx.checklist_items, notes: '',
      employeeId: tx.employee_id || '', submittedAt: tx.submitted_at,
      supervisorSignoffs: signoffs,
    });
    window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  const dests = [...new Set(transactions.map(t => t.destination))].sort();

  return (
    <div className="card">
      <h2 className="card__header">Transaction History {homeStation && `— ${homeStation}`}</h2>
      {deleted90 > 0 && <div className="alert alert--info">Auto-cleaned {deleted90} records older than 90 days.</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="text" className="form-input" placeholder="Search AWB..." value={searchAwb} onChange={e => setSearchAwb(e.target.value)} style={{ flex: '1 1 140px' }} />
        <input type="text" className="form-input" placeholder="Search Agent..." value={searchAgent} onChange={e => setSearchAgent(e.target.value)} style={{ flex: '1 1 130px' }} />
        <select className="form-select" value={filterDest} onChange={e => setFilterDest(e.target.value)} style={{ flex: '0 0 120px' }}>
          <option value="">All Dest</option>{dests.map(d => <option key={d} value={d}>{d}</option>)}</select>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: '0 0 120px' }}>
          <option value="">All Status</option><option value="verified">Verified</option><option value="missing">Has Missing</option></select>
        <button className="btn btn--outline btn--sm" onClick={() => { setSearchAwb(''); setSearchAgent(''); setFilterDest(''); setFilterStatus(''); }}>Clear</button>
      </div>

      {searchFiltered.length === 0 ? <div className="alert alert--info">No transactions found.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr><th>Date</th><th>AWB</th><th>Route</th><th>Type</th><th>Agent</th><th>Status</th><th>Supervisors</th><th></th></tr></thead>
            <tbody>{searchFiltered.map(tx => {
              // Parse all supervisor signoffs
              let signoffs = [];
              try { if (tx.supervisor_notes) signoffs = JSON.parse(tx.supervisor_notes); } catch (e) {}
              if (signoffs.length === 0 && tx.supervisor_id) signoffs = [{ station: '—', id: tx.supervisor_id, at: tx.supervisor_reviewed_at }];

              return (
              <React.Fragment key={tx.id}>
                <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}>
                  <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(tx.submitted_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>{tx.awb_number}</strong></td>
                  <td style={{ fontSize: 11 }}>{tx.origin} → {tx.destination}{tx.routing ? ` (${tx.routing})` : ''}</td>
                  <td style={{ fontSize: 11 }}>{tx.remains_type}</td>
                  <td>{tx.employee_id || '—'}</td>
                  <td><span className={`status-badge ${tx.all_verified ? 'status-badge--not-required' : 'status-badge--required'}`}>{tx.all_verified ? 'Verified' : 'Missing'}</span></td>
                  <td style={{ fontSize: 11 }}>
                    {signoffs.length > 0 ? signoffs.map((s, i) => (
                      <div key={i} style={{ color: 'var(--alert-green)', fontWeight: 600 }}>
                        ✓ {s.station} — {s.id}{s.manual ? ' (M)' : ''}
                      </div>
                    )) : tx.override_by ? (
                      <span style={{ color: '#996B00', fontWeight: 600 }}>Override: {tx.override_by}</span>
                    ) : <span style={{ color: 'var(--text-disabled)' }}>Pending</span>}
                  </td>
                  <td><button className="btn btn--outline btn--sm" onClick={e => { e.stopPropagation(); handleReprint(tx); }}>Reprint</button></td>
                </tr>
                {expanded === tx.id && (
                  <tr><td colSpan={8} style={{ padding: 16, background: 'var(--medium-tonal-grey-20)' }}>
                    {/* Full transaction timeline */}
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--united-blue)' }}>Transaction Timeline</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                        <span style={{ width: 160, color: 'var(--text-secondary)', fontWeight: 600 }}>Created:</span>
                        <span>{new Date(tx.submitted_at).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                        <span style={{ width: 160, color: 'var(--text-secondary)', fontWeight: 600 }}>Agent Verified:</span>
                        <span>{tx.employee_id || '—'} — {new Date(tx.submitted_at).toLocaleString()}</span>
                      </div>
                      {signoffs.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                          <span style={{ width: 160, color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Supervisor — {s.station}:
                          </span>
                          <span style={{ color: 'var(--alert-green)' }}>
                            {s.id} — {s.at ? new Date(s.at).toLocaleString() : '—'}
                            {s.manual ? ' (Manual Verification)' : ' (Electronic)'}
                          </span>
                        </div>
                      ))}
                      {tx.override_by && (
                        <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                          <span style={{ width: 160, color: 'var(--text-secondary)', fontWeight: 600 }}>Override:</span>
                          <span style={{ color: '#996B00' }}>{tx.override_by} — {tx.override_at ? new Date(tx.override_at).toLocaleString() : '—'}</span>
                        </div>
                      )}
                      {tx.override_notes && (
                        <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                          <span style={{ width: 160, color: 'var(--text-secondary)', fontWeight: 600 }}>Override Notes:</span>
                          <span>{tx.override_notes}</span>
                        </div>
                      )}
                    </div>

                    <table className="checklist-table" style={{ fontSize: 13 }}>
                      <thead><tr><th>Document</th><th>Status</th><th>Verification</th></tr></thead>
                      <tbody>{(tx.checklist_items || []).map((item, i) => (
                        <tr key={i}><td>{item.document_name}{item.custom_note && <span style={{ color: 'var(--united-blue)', marginLeft: 6, fontSize: 11 }}>⚠ {item.custom_note}</span>}</td>
                          <td>{item.status}</td>
                          <td><span style={{ color: item.verification === 'Missing' ? 'var(--alert-red)' : 'var(--alert-green)', fontWeight: 600 }}>{item.verification}</span></td></tr>
                      ))}</tbody>
                    </table>
                  </td></tr>
                )}
              </React.Fragment>
            ))}</tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-disabled)' }}>{searchFiltered.length} of {transactions.length} shown</div>
    </div>
  );
}
