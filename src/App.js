import React, { useState, useMemo, useEffect } from "react";
import "./App.css";
import MuaToolPro from "./MuaToolPro";

/**
 * App: Mirrors the Excel workbook workflow with 4 tabs:
 *  1) Analysis Info
 *  2) Notes
 *  3) Document (test points, tolerance + uncertainty + equations + quick risk)
 *  4) Risk (Assumed REOP)
 *
 * Data model (in-memory for now):
 *  - header: equipment/org/analyst metadata (Analysis Info)
 *  - notes: free text
 *  - points: array of test points { id, section, uut, tmde, param, units, value, qualifier, qUnits, qValue, tol:{uut,tmde}, budget, results }
 *  - riskDefaults: { pfaReq, reopReq, assumedReop, assumedTur, intervalMonths }
 *
 * You can later persist this to localStorage or your API.
 */

const newPoint = () => ({
  id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
  section: "", uut: "", tmde: "",
  param: "", units: "V", value: "10",
  qualifier: "", qUnits: "", qValue: "",
  tol: { uut: "100 ppm", tmde: "50 ppm" },
  budget: { rows: [] },
  results: { Uppm: null, TUR: null, TAR: null, guard: null, pfa: null, pfr: null }
});

function Tabs({active, setActive}){
  const tabs = ["Analysis Info","Notes","Document","Risk (Assumed REOP)"];
  return (
    <div className="accordion-card" style={{marginBottom:20}}>
      <div className="accordion-header">
        <h3>Uncertainty Analysis Tool — v7.09 (React)</h3>
        <div className="view-toggle">
          {tabs.map(t => (
            <button key={t} className={active===t?"active":""} onClick={()=>setActive(t)}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalysisInfo({header, setHeader}){
  return (
    <div className="content-area">
      <div className="accordion-card">
        <div className="accordion-header"><h4>Analysis Info</h4></div>
        <div className="accordion-content">
          <div className="tolerance-input-container">
            <div className="config-column"><label>Equipment</label><input value={header.equipment} onChange={e=>setHeader(h=>({...h,equipment:e.target.value}))}/></div>
            <div className="config-column"><label>Organization</label><input value={header.org} onChange={e=>setHeader(h=>({...h,org:e.target.value}))}/></div>
            <div className="config-column"><label>Analyst</label><input value={header.analyst} onChange={e=>setHeader(h=>({...h,analyst:e.target.value}))}/></div>
            <div className="config-column"><label>Date</label><input type="date" value={header.date} onChange={e=>setHeader(h=>({...h,date:e.target.value}))}/></div>
          </div>
        </div>
      </div>

      <div className="accordion-card">
        <div className="accordion-header"><h4>Legal Disclaimer</h4></div>
        <div className="accordion-content">
          <p style={{whiteSpace:'pre-wrap'}}>
            This uncertainty analysis tool was developed by the US Navy METCAL Program. It is provided free of charge and without warranty. The Navy shall not be liable for any damages arising from use of this tool. You assume the cost of servicing/repair due to use. This tool may be freely distributed for analysis/teaching but not sold without permission.
          </p>
        </div>
      </div>
    </div>
  );
}

function Notes({notes, setNotes}){
  return (
    <div className="content-area">
      <div className="accordion-card">
        <div className="accordion-header"><h4>Analysis Notes</h4></div>
        <div className="accordion-content">
          <textarea rows={12} placeholder="Record analysis notes here..." value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function Document({points, setPoints}){
  const [activeId, setActiveId] = useState(points[0]?.id || null);
  useEffect(()=>{ if(points.length && !points.find(p=>p.id===activeId)) setActiveId(points[0].id); },[points]);

  const addRow = () => setPoints(ps=>[...ps, newPoint()]);
  const del = (id) => setPoints(ps=>ps.filter(p=>p.id!==id));
  const update = (id, patch) => setPoints(ps=>ps.map(p=>p.id===id?{...p,...patch}:p));

  const active = points.find(p=>p.id===activeId) || null;

  return (
    <div className="results-workflow-container content-area">
      <aside className="results-sidebar">
        <div className="sidebar-header">
          <h4>Test Points</h4>
          <button className="add-point-button" title="Add point" onClick={addRow}>＋</button>
        </div>
        {points.length===0 ? (
          <div className="placeholder-content"><h3>No test points yet</h3><p>Click ＋ to add one.</p></div>
        ):(
          <div className="measurement-point-list">
            {points.map(p=> (
              <div key={p.id} className={"measurement-point-item "+(p.id===activeId?"active":"")} onClick={()=>setActiveId(p.id)}>
                <div className="measurement-point-details">
                  <span className="point-data">{p.value}{p.units}</span>
                  <span className="point-main">{p.param || 'Parameter'} — {p.uut || 'UUT'}</span>
                  {p.qualifier && <span className="point-qualifier">{p.qualifier}: {p.qValue} {p.qUnits}</span>}
                </div>
                <span className="delete-action" onClick={(e)=>{e.stopPropagation(); del(p.id);}}>×</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      <main className="results-content">
        {!active ? (
          <div className="placeholder-content"><h3>Select a point</h3><p>Use the left list to edit and analyze.</p></div>
        ):(
          <div className="accordion-card">
            <div className="accordion-header"><h4>Point Details</h4></div>
            <div className="accordion-content">
              <div className="tolerance-input-container">
                <div className="config-column"><label>Section</label><input value={active.section} onChange={e=>update(active.id,{section:e.target.value})}/></div>
                <div className="config-column"><label>UUT</label><input value={active.uut} onChange={e=>update(active.id,{uut:e.target.value})}/></div>
                <div className="config-column"><label>TMDE</label><input value={active.tmde} onChange={e=>update(active.id,{tmde:e.target.value})}/></div>
                <div className="config-column"><label>Parameter Name</label><input value={active.param} onChange={e=>update(active.id,{param:e.target.value})}/></div>
                <div className="config-column">
                  <label>Measurement Units</label>
                  <input value={active.units} onChange={e=>update(active.id,{units:e.target.value})}/>
                </div>
                <div className="config-column"><label>Measurement Point</label><input type="number" value={active.value} onChange={e=>update(active.id,{value:e.target.value})}/></div>
                <div className="config-column"><label>Qualifier Name</label><input value={active.qualifier} onChange={e=>update(active.id,{qualifier:e.target.value})}/></div>
                <div className="config-column"><label>Qualifier Units</label><input value={active.qUnits} onChange={e=>update(active.id,{qUnits:e.target.value})}/></div>
                <div className="config-column"><label>Qualifier Value</label><input type="number" value={active.qValue} onChange={e=>update(active.id,{qValue:e.target.value})}/></div>
              </div>

              <div className="form-section" style={{marginTop:10}}>
                <div className="view-toggle">
                  <button className="active">Tolerance / Uncertainty Tools</button>
                  <button>Equations</button>
                  <button>Risk View</button>
                </div>
                <div style={{marginTop:15}}>
                  {/* Drop in the Uncertainty Pro tool as the embedded budget for this point. */}
                  <MuaToolPro />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Risk (Assumed REOP) view ---
function RiskAssumed({points, riskDefaults, setRiskDefaults}){
  // Aggregate a single selected point for demo; you can extend to per-point selection
  const [Uppm, setUppm] = useState(50);
  const [tolUpper, setTolUpper] = useState(100);
  const [tolLower, setTolLower] = useState(-100);

  const [pfaReq, setPfaReq] = useState(riskDefaults.pfaReq);
  const [reopReq, setReopReq] = useState(riskDefaults.reopReq);
  const [assumedReop, setAssumedReop] = useState(riskDefaults.assumedReop);
  const [assumedTur, setAssumedTur] = useState(riskDefaults.assumedTur);
  const [interval, setInterval] = useState(riskDefaults.intervalMonths);

  // Simple helper CDF/INV
  const erf = x => { const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911; const s=x<0?-1:1; x=Math.abs(x); const t=1/(1+p*x); const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x); return s*y; };
  const cdf = x => 0.5*(1+erf(x/Math.SQRT2));
  const inv = p => { if(p<=0||p>=1) return NaN; const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00]; const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01]; const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00]; const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00]; const pl=0.02425,ph=1-pl; let q,r,x; if(p<pl){ q=Math.sqrt(-2*Math.log(p)); x=((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]; x/=(((d[0]*q+d[1])*q+d[2])*q+d[3]); } else if(p>ph){ q=Math.sqrt(-2*Math.log(1-p)); x=-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])) ; } else { q=p-0.5; r=q*q; x=(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); } const e=0.5*(1+erf(x/Math.SQRT2))-p; const u=e*Math.SQRT2*Math.sqrt(Math.PI)*Math.exp(x*x/2); return x-u/(1+x*u/2); };

  const tolSpan = Math.abs(tolUpper) + Math.abs(tolLower);
  const turCalc = Uppm>0 ? tolSpan/(2*Uppm) : NaN;

  // Guard band to meet PFA requirement
  const z = inv(1 - pfaReq/2); // one-sided from two-sided target
  const guard = z * (Uppm/2); // Uppm ~ k*uc with k≈2 → uc≈Uppm/2
  const accUpper = tolUpper - guard; const accLower = tolLower + guard;

  // Predicted REOP change with TUR delta (very simplified proxy):
  const predictedReop = Math.max(0, Math.min(1, assumedReop * (turCalc/assumedTur)));

  // Risk at predicted REOP (centered model)
  const pfa = 2*(1 - cdf((Math.min(Math.abs(accUpper), Math.abs(accLower)))/(Uppm/2)));
  const pfr = Math.max(0, 1 - predictedReop);

  return (
    <div className="content-area">
      <div className="accordion-card">
        <div className="accordion-header"><h4>Assumptions</h4></div>
        <div className="accordion-content">
          <div className="risk-inputs-container">
            <div className="config-column"><label>Upper Tolerance (ppm)</label><input type="number" value={tolUpper} onChange={e=>setTolUpper(parseFloat(e.target.value)||0)}/></div>
            <div className="config-column"><label>Lower Tolerance (ppm)</label><input type="number" value={tolLower} onChange={e=>setTolLower(parseFloat(e.target.value)||0)}/></div>
            <div className="config-column"><label>Test Uncertainty (±U, ppm)</label><input type="number" value={Uppm} onChange={e=>setUppm(parseFloat(e.target.value)||0)}/></div>
            <div className="config-column"><label>PFA Requirement</label><input type="number" step="0.001" value={pfaReq} onChange={e=>setPfaReq(parseFloat(e.target.value)||0.02)}/></div>
            <div className="config-column"><label>REOP Requirement</label><input type="number" step="0.01" value={reopReq} onChange={e=>setReopReq(parseFloat(e.target.value)||0.85)}/></div>
            <div className="config-column"><label>Assumed REOP</label><input type="number" step="0.01" value={assumedReop} onChange={e=>setAssumedReop(parseFloat(e.target.value)||0.85)}/></div>
            <div className="config-column"><label>Assumed TUR to Meet REOP</label><input type="number" step="0.01" value={assumedTur} onChange={e=>setAssumedTur(parseFloat(e.target.value)||4)}/></div>
            <div className="config-column"><label>Assumed Interval (months)</label><input type="number" value={interval} onChange={e=>setInterval(parseFloat(e.target.value)||12)}/></div>
          </div>
        </div>
      </div>

      <div className="accordion-card">
        <div className="accordion-header"><h4>Risk Results Based on Assumed REOP</h4></div>
        <div className="accordion-content">
          <div className="risk-analysis-dashboard">
            <div className="risk-card tur-card">
              <div className="risk-value">{isFinite(turCalc)?turCalc.toFixed(2):"—"} : 1</div>
              <div className="risk-label">Calculated TUR</div>
              <div className="risk-explanation">Tolerance span ÷ expanded uncertainty.</div>
            </div>
            <div className="risk-card">
              <div className="risk-value">± {Math.max(0, accUpper).toFixed(1)} / {Math.min(0, accLower).toFixed(1)} ppm</div>
              <div className="risk-label">Guard Banded Acceptance Limits</div>
              <div className="risk-explanation">g = z·u, u ≈ U/2 for k≈2. Two-sided target pfa.</div>
            </div>
            <div className="risk-card pfa-card">
              <div className="risk-value">{isFinite(pfa)?(pfa*100).toFixed(2):"—"}%</div>
              <div className="risk-label">PFA (Predicted)</div>
              <div className="risk-explanation">Based on acceptance limits and U.</div>
            </div>
            <div className="risk-card">
              <div className="risk-value">{isFinite(pfr)?(pfr*100).toFixed(2):"—"}%</div>
              <div className="risk-label">PFR (Predicted)</div>
              <div className="risk-explanation">Proxy using predicted REOP vs requirement.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="accordion-card">
        <div className="accordion-header"><h4>Managing Risk With Guard Bands & Intervals</h4></div>
        <div className="accordion-content">
          <p className="conversion-info">When PFA exceeds requirement, apply guard bands (acceptance shrinkage) first to hit PFA target; expect REOP ↓ which implies interval ↓ to maintain REOP requirement.</p>
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [active, setActive] = useState("Analysis Info");
  const [header, setHeader] = useState({ equipment:"", org:"", analyst:"", date: new Date().toISOString().slice(0,10) });
  const [notes, setNotes] = useState("");
  const [points, setPoints] = useState([ newPoint() ]);
  const [riskDefaults, setRiskDefaults] = useState({ pfaReq:0.02, reopReq:0.85, assumedReop:0.85, assumedTur:4, intervalMonths:12 });

  return (
    <div className="App">
      <Tabs active={active} setActive={setActive} />
      {active==="Analysis Info" && <AnalysisInfo header={header} setHeader={setHeader} />}
      {active==="Notes" && <Notes notes={notes} setNotes={setNotes} />}
      {active==="Document" && <Document points={points} setPoints={setPoints} />}
      {active==="Risk (Assumed REOP)" && <RiskAssumed points={points} riskDefaults={riskDefaults} setRiskDefaults={setRiskDefaults} />}
    </div>
  );
}
