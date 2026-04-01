import { useState } from "react";

// ── Mock data ──
const MOCK_REQUIREMENTS = [
  { id: 1, document_name: "Airway Bill (AWB)", description: "Original Air Waybill", status: "Required" },
  { id: 2, document_name: "Death Certificate", description: "Certified Death Certificate", status: "Required" },
  { id: 3, document_name: "Burial/Transit Permit", description: "Burial or Transit Permit issued by local authority", status: "Required" },
  { id: 4, document_name: "Embalming Certificate", description: "Certificate confirming embalming completed", status: "Required" },
  { id: 5, document_name: "Consular/Embassy Letter", description: "Authorization from destination country consulate", status: "Required - Copies OK" },
  { id: 6, document_name: "Shipper Declaration", description: "Declaration by shipper regarding contents", status: "Required" },
  { id: 7, document_name: "Funeral Home Letter", description: "Letter from licensed funeral home", status: "Required - Copies OK" },
  { id: 8, document_name: "Hermetically Sealed Certificate", description: "Certificate that casket is hermetically sealed", status: "Required" },
  { id: 9, document_name: "NON-CONTAGIOUS Disease Statement", description: "Statement - deceased did not die of contagious disease", status: "Required" },
];

const STEP = { INTAKE: 0, CHECKLIST: 1 };

export default function App() {
  const [page, setPage] = useState("checklist");
  const [step, setStep] = useState(STEP.INTAKE);
  const [form, setForm] = useState({
    awbNumber: "", origin: "", destination: "", routing: "",
    flightNumbers: "", shipmentType: "Origin", remainsType: "Human Remains",
  });
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");

  const update = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));
  const updateUpper = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value.toUpperCase() }));

  const generate = () => {
    if (!form.awbNumber || !form.origin || !form.destination) {
      setError("Please fill in AWB Number, Origin, and Destination."); return;
    }
    setError("");
    setItems(MOCK_REQUIREMENTS.map(r => ({ ...r, verification: "" })));
    setStep(STEP.CHECKLIST);
  };

  const updateVer = (i, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, verification: v } : it));

  const handlePrint = () => {
    if (items.some(i => !i.verification)) { setError("Please verify all items."); return; }
    setError("");
    setModalType(items.some(i => i.verification === "Missing") ? "warning" : "success");
    setShowModal(true);
  };

  const reset = () => { setStep(STEP.INTAKE); setForm({ awbNumber: "", origin: "", destination: "", routing: "", flightNumbers: "", shipmentType: "Origin", remainsType: "Human Remains" }); setItems([]); setError(""); setShowModal(false); setEmployeeId(""); };

  const s = {
    shell: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", minHeight: "100vh", background: "#F5F3EF", color: "#1A1A1A" },
    header: { background: "#002244", color: "white", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(0,34,68,0.25)" },
    title: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "0.04em", textTransform: "uppercase" },
    subtitle: { fontSize: "0.7rem", opacity: 0.65, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 },
    nav: { display: "flex", gap: 6 },
    navBtn: (active) => ({ background: active ? "rgba(255,255,255,0.12)" : "transparent", color: active ? "white" : "rgba(255,255,255,0.7)", border: "none", padding: "6px 16px", borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer", letterSpacing: "0.04em", textTransform: "uppercase" }),
    main: { maxWidth: 920, margin: "0 auto", padding: "28px 20px" },
    card: { background: "white", border: "1px solid #D5D0CA", borderRadius: 12, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20 },
    cardH: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.15rem", fontWeight: 700, color: "#002244", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 20, paddingBottom: 8, borderBottom: "2px solid #C4A35A" },
    grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
    label: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: "0.8rem", color: "#5A5550", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
    input: { padding: "9px 13px", border: "1.5px solid #D5D0CA", borderRadius: 8, fontSize: "0.93rem", outline: "none", width: "100%", boxSizing: "border-box" },
    select: { padding: "9px 13px", border: "1.5px solid #D5D0CA", borderRadius: 8, fontSize: "0.93rem", background: "white", width: "100%", boxSizing: "border-box" },
    btn: (bg, fg) => ({ background: bg, color: fg, border: "none", padding: "10px 22px", borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }),
    btnOutline: { background: "transparent", color: "#5A5550", border: "1.5px solid #D5D0CA", padding: "10px 22px", borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" },
    alert: (t) => ({ padding: 14, borderRadius: 8, fontSize: "0.88rem", marginBottom: 14, background: t === "warning" ? "#FDECEA" : t === "success" ? "#E8F5EC" : "#E3F2FD", color: t === "warning" ? "#B40000" : t === "success" ? "#1B7A3D" : "#0D47A1", border: `1px solid ${t === "warning" ? "#F5C6CB" : t === "success" ? "#A5D6A7" : "#90CAF9"}` }),
    overlay: { position: "fixed", inset: 0, background: "rgba(0,22,44,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modal: { background: "white", borderRadius: 12, padding: 28, maxWidth: 500, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  };

  const badge = (status) => {
    const m = { "Required": { bg: "#FDECEA", c: "#B40000" }, "Required - Copies OK": { bg: "#FFF3E0", c: "#E65100" }, "Not Required": { bg: "#E8F5EC", c: "#1B7A3D" } };
    const st = m[status] || m["Required"];
    return { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: "0.73rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", background: st.bg, color: st.c };
  };

  const verSelect = (v) => ({
    padding: "5px 10px", borderRadius: 4, fontSize: "0.86rem", fontWeight: 500, minWidth: 105, cursor: "pointer",
    border: `1.5px solid ${v === "Verified" ? "#1B7A3D" : v === "Missing" ? "#B40000" : "#D5D0CA"}`,
    color: v === "Verified" ? "#1B7A3D" : v === "Missing" ? "#B40000" : "#1A1A1A",
    background: v === "Verified" ? "#E8F5EC" : v === "Missing" ? "#FDECEA" : "white",
  });

  // ═══ ADMIN PAGE (simplified) ═══
  if (page === "admin") return (
    <div style={s.shell}>
      <header style={s.header}>
        <div><div style={s.title}>United Cargo — HR Document Verification</div><div style={s.subtitle}>Human Remains Checklist System</div></div>
        <nav style={s.nav}>
          <button style={s.navBtn(false)} onClick={() => { setPage("checklist"); reset(); }}>Checklist</button>
          <button style={s.navBtn(false)} onClick={() => setPage("history")}>History</button>
          <button style={s.navBtn(true)}>Admin</button>
        </nav>
      </header>
      <main style={s.main}>
        <div style={s.card}>
          <h2 style={s.cardH}>Add New Document Requirement</h2>
          <div style={s.grid}>
            <div><div style={s.label}>Document Name *</div><input style={s.input} placeholder="e.g. Consular Authorization" /></div>
            <div><div style={s.label}>Applies To</div><select style={s.select}><option>Both (HR & ASH)</option><option>Human Remains Only</option><option>ASH Only</option></select></div>
            <div style={{ gridColumn: "1/-1" }}><div style={s.label}>Description</div><input style={s.input} placeholder="Brief description" /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><button style={s.btn("#002244", "white")}>Add Requirement</button></div>
        </div>
        <div style={s.card}>
          <h2 style={s.cardH}>Document Requirements & Default Statuses</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.87rem" }}>
            <thead>
              <tr style={{ background: "#EBE8E2" }}>
                {["#", "Document", "Applies To", "Default Status", "Active", "Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.77rem", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "2px solid #B0AAA0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_REQUIREMENTS.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #D5D0CA" }}>
                  <td style={{ padding: "8px 10px" }}>{i + 1}</td>
                  <td style={{ padding: "8px 10px" }}><strong>{r.document_name}</strong><div style={{ fontSize: "0.76rem", color: "#8A8580" }}>{r.description}</div></td>
                  <td style={{ padding: "8px 10px", fontSize: "0.82rem" }}>BOTH</td>
                  <td style={{ padding: "8px 10px" }}><select style={{ ...s.select, padding: "4px 8px", fontSize: "0.84rem" }}><option>Required</option><option>Required - Copies OK</option><option>Not Required</option></select></td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}><input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} /></td>
                  <td style={{ padding: "8px 10px" }}><button style={{ ...s.btn("#B40000", "white"), padding: "4px 12px", fontSize: "0.76rem" }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={s.card}>
          <h2 style={s.cardH}>Airport-Specific Requirements</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
            <div><div style={s.label}>Add Airport</div><input style={{ ...s.input, width: 100 }} placeholder="NRT" maxLength={3} /></div>
            <button style={{ ...s.btn("#C4A35A", "#002244"), padding: "8px 16px", fontSize: "0.82rem" }}>+ Add</button>
            <div style={{ marginLeft: 20 }}><div style={s.label}>View Airport</div><select style={{ ...s.select, width: 130 }}><option>NRT</option><option>LHR</option><option>GRU</option></select></div>
          </div>
          <div style={s.alert("info")}>Configure destination-specific document requirements. Destinations not listed use the default checklist.</div>
        </div>
      </main>
    </div>
  );

  // ═══ HISTORY PAGE ═══
  if (page === "history") return (
    <div style={s.shell}>
      <header style={s.header}>
        <div><div style={s.title}>United Cargo — HR Document Verification</div><div style={s.subtitle}>Human Remains Checklist System</div></div>
        <nav style={s.nav}>
          <button style={s.navBtn(false)} onClick={() => { setPage("checklist"); reset(); }}>Checklist</button>
          <button style={s.navBtn(true)}>History</button>
          <button style={s.navBtn(false)} onClick={() => setPage("admin")}>Admin</button>
        </nav>
      </header>
      <main style={s.main}>
        <div style={s.card}>
          <h2 style={s.cardH}>Transaction History</h2>
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder="Search by AWB number..." />
            <button style={{ ...s.btn("#002244", "white"), padding: "8px 16px" }}>Search</button>
            <button style={{ ...s.btnOutline, padding: "8px 16px" }}>Clear</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
            <thead>
              <tr style={{ background: "#EBE8E2" }}>
                {["Date/Time", "AWB", "Origin", "Dest", "Type", "Status", "Agent", "Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.77rem", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "2px solid #B0AAA0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { date: "03/28/26 14:32", awb: "016-98765432", org: "IAH", dest: "NRT", type: "Human Remains", ok: true, agent: "V12345" },
                { date: "03/27/26 09:15", awb: "016-11223344", org: "IAH", dest: "LHR", type: "Human Remains - ASH", ok: true, agent: "U67890" },
                { date: "03/26/26 16:48", awb: "016-55667788", org: "IAH", dest: "GRU", type: "Human Remains", ok: false, agent: "V11111" },
              ].map((tx, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #D5D0CA", cursor: "pointer" }}>
                  <td style={{ padding: "9px 10px", fontSize: "0.82rem", whiteSpace: "nowrap" }}>{tx.date}</td>
                  <td style={{ padding: "9px 10px", fontWeight: 600 }}>{tx.awb}</td>
                  <td style={{ padding: "9px 10px" }}>{tx.org}</td>
                  <td style={{ padding: "9px 10px" }}>{tx.dest}</td>
                  <td style={{ padding: "9px 10px", fontSize: "0.82rem" }}>{tx.type}</td>
                  <td style={{ padding: "9px 10px" }}><span style={badge(tx.ok ? "Not Required" : "Required")}>{tx.ok ? "All Verified" : "Has Missing"}</span></td>
                  <td style={{ padding: "9px 10px" }}>{tx.agent}</td>
                  <td style={{ padding: "9px 10px" }}><button style={{ ...s.btnOutline, padding: "4px 12px", fontSize: "0.76rem" }}>Reprint</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );

  // ═══ CHECKLIST PAGE ═══
  return (
    <div style={s.shell}>
      <header style={s.header}>
        <div><div style={s.title}>United Cargo — HR Document Verification</div><div style={s.subtitle}>Human Remains Checklist System</div></div>
        <nav style={s.nav}>
          <button style={s.navBtn(true)}>Checklist</button>
          <button style={s.navBtn(false)} onClick={() => setPage("history")}>History</button>
          <button style={s.navBtn(false)} onClick={() => setPage("admin")}>Admin</button>
        </nav>
      </header>
      <main style={s.main}>
        {step === STEP.INTAKE ? (
          <div style={s.card}>
            <h2 style={s.cardH}>Shipment Information</h2>
            {error && <div style={s.alert("warning")}>{error}</div>}
            <div style={s.grid}>
              <div><div style={s.label}>AWB Number *</div><input style={s.input} placeholder="e.g. 016-12345678" value={form.awbNumber} onChange={update("awbNumber")} /></div>
              <div><div style={s.label}>Remains Type *</div><select style={s.select} value={form.remainsType} onChange={update("remainsType")}><option>Human Remains</option><option>Human Remains - ASH</option></select></div>
              <div><div style={s.label}>Origin (ICAO Code) *</div><input style={s.input} placeholder="e.g. IAH" maxLength={3} value={form.origin} onChange={updateUpper("origin")} /></div>
              <div><div style={s.label}>Destination (ICAO Code) *</div><input style={s.input} placeholder="e.g. NRT" maxLength={3} value={form.destination} onChange={updateUpper("destination")} /></div>
              <div><div style={s.label}>Routing</div><input style={s.input} placeholder="e.g. IAH - ORD - NRT" value={form.routing} onChange={update("routing")} /></div>
              <div><div style={s.label}>Flight Numbers</div><input style={s.input} placeholder="e.g. UA1234 / UA5678" value={form.flightNumbers} onChange={update("flightNumbers")} /></div>
              <div><div style={s.label}>Origin or Transit</div><select style={s.select} value={form.shipmentType} onChange={update("shipmentType")}><option value="Origin">Origin</option><option value="Transit">Transit</option></select></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button style={s.btn("#002244", "white")} onClick={generate}>Generate Checklist</button>
            </div>
          </div>
        ) : (
          <>
            <div style={s.card}>
              <h2 style={s.cardH}>Shipment Summary</h2>
              <div style={{ ...s.grid, gap: "6px 20px" }}>
                <div><span style={{ ...s.label, display: "inline" }}>AWB: </span><strong>{form.awbNumber}</strong></div>
                <div><span style={{ ...s.label, display: "inline" }}>Type: </span><strong>{form.remainsType}</strong></div>
                <div><span style={{ ...s.label, display: "inline" }}>Origin: </span><strong>{form.origin}</strong></div>
                <div><span style={{ ...s.label, display: "inline" }}>Destination: </span><strong>{form.destination}</strong></div>
                <div><span style={{ ...s.label, display: "inline" }}>Routing: </span><strong>{form.routing || "—"}</strong></div>
                <div><span style={{ ...s.label, display: "inline" }}>Flights: </span><strong>{form.flightNumbers || "—"}</strong></div>
                <div><span style={{ ...s.label, display: "inline" }}>Shipment: </span><strong>{form.shipmentType}</strong></div>
                <div><span style={{ ...s.label, display: "inline" }}>Created: </span><strong>{new Date().toLocaleString()}</strong></div>
              </div>
            </div>
            <div style={s.card}>
              <h2 style={s.cardH}>Document Verification Checklist</h2>
              {error && <div style={s.alert("warning")}>{error}</div>}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "Document", "Requirement", "Verification"].map((h, i) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "white", background: "#002244", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em", ...(i === 0 ? { width: 36, borderRadius: "6px 0 0 0" } : i === 3 ? { width: 120, borderRadius: "0 6px 0 0" } : i === 2 ? { width: 140 } : {}) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #D5D0CA", background: idx % 2 === 0 ? "white" : "#F5F3EF" }}>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 500 }}>{item.document_name}</div>
                        <div style={{ fontSize: "0.77rem", color: "#8A8580", marginTop: 1 }}>{item.description}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}><span style={badge(item.status)}>{item.status}</span></td>
                      <td style={{ padding: "10px 12px" }}>
                        <select style={verSelect(item.verification)} value={item.verification} onChange={e => updateVer(idx, e.target.value)}>
                          <option value="">— Select —</option>
                          <option value="Verified">Verified</option>
                          <option value="Missing">Missing</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button style={s.btnOutline} onClick={reset}>Reset & Start Over</button>
                <button style={s.btn("#002244", "white")} onClick={handlePrint}>Print Checklist</button>
              </div>
            </div>
          </>
        )}
      </main>

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            {modalType === "warning" ? (
              <>
                <h3 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "1.15rem", fontWeight: 700, textTransform: "uppercase", color: "#B40000", marginBottom: 14 }}>⚠ Missing Documents</h3>
                <p style={{ fontSize: "0.9rem", color: "#5A5550", lineHeight: 1.6, marginBottom: 10 }}><strong>One or more important documents are marked as MISSING.</strong></p>
                <p style={{ fontSize: "0.9rem", color: "#5A5550", lineHeight: 1.6, marginBottom: 20 }}>Please contact the <strong>Supervisor on Duty</strong> and <strong>TrustUA</strong> for further instructions before proceeding.</p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button style={s.btnOutline} onClick={() => setShowModal(false)}>Go Back</button>
                  <button style={s.btn("#B40000", "white")} onClick={() => { setShowModal(false); alert("PDF would download here"); }}>Print Anyway</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "1.15rem", fontWeight: 700, textTransform: "uppercase", color: "#1B7A3D", marginBottom: 14 }}>✓ All Documents Verified</h3>
                <p style={{ fontSize: "0.9rem", color: "#5A5550", lineHeight: 1.6, marginBottom: 14 }}>I certify that I have checked and verified all documents listed on this checklist and confirm they are complete.</p>
                <div style={{ marginBottom: 10 }}>
                  <div style={s.label}>Enter your V Number or U Number *</div>
                  <input style={s.input} placeholder="e.g. V12345 or U12345" value={employeeId} onChange={e => setEmployeeId(e.target.value.toUpperCase())} autoFocus />
                </div>
                <div style={{ fontSize: "0.8rem", color: "#8A8580", marginBottom: 18 }}>Date/Time: {new Date().toLocaleString()}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button style={s.btnOutline} onClick={() => setShowModal(false)}>Cancel</button>
                  <button style={{ ...s.btn("#002244", "white"), opacity: employeeId.trim() ? 1 : 0.5 }} disabled={!employeeId.trim()} onClick={() => { setShowModal(false); alert("PDF would download here"); }}>Submit & Print PDF</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
