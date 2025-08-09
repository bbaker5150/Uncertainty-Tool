import React, { useMemo, useState, useEffect } from "react";
import "./App.css";

/**
 * MuaToolPro — Full-featured Measurement Uncertainty & Risk tool
 * Adds over baseline MUA:
 *  • Type A/B components with unit-aware conversion to ppm
 *  • Welch–Satterthwaite effective DoF and optional t‑distribution k
 *  • Expanded U, TUR, TAR
 *  • Guard‑banded limits w/ target consumer risk and PFA/PFR (approx.)
 *  • Professional UI reusing App.css card/table styles
 */

// ----------------- helpers -----------------
const unitFamilies = {
  V: "Voltage", mV: "Voltage", uV: "Voltage",
  A: "Current", mA: "Current", uA: "Current",
  Hz: "Frequency", kHz: "Frequency", MHz: "Frequency",
  Ohm: "Resistance", kOhm: "Resistance", MOhm: "Resistance",
  "%": "Relative", ppm: "Relative",
  "deg F": "Temperature", "deg C": "Temperature"
};

const multipliers = {
  V: 1, mV: 1e-3, uV: 1e-6,
  A: 1, mA: 1e-3, uA: 1e-6,
  Hz: 1, kHz: 1e3, MHz: 1e6,
  Ohm: 1, kOhm: 1e3, MOhm: 1e6
};

function convertToPPM(value, unit, nominalValue, nominalUnit) {
  const v = parseFloat(value);
  const n = parseFloat(nominalValue);
  if (!isFinite(v) || v === 0) return 0;
  if (unit === "ppm") return v;
  if (unit === "%") return (v / 100) * 1e6;
  if (!isFinite(n) || n === 0) return NaN;
  const famV = unitFamilies[unit];
  const famN = unitFamilies[nominalUnit];
  if (famV && famN && famV !== famN) return NaN;
  const mul = multipliers[unit];
  if (!isFinite(mul)) return NaN;
  return (v * mul / n) * 1e6; // ppm
}

const T_95 = {1:12.71,2:4.30,3:3.18,4:2.78,5:2.57,6:2.45,7:2.36,8:2.31,9:2.26,10:2.23,15:2.13,20:2.09,25:2.06,30:2.04,40:2.02,50:2.01,60:2.00,100:1.98,120:1.98};
function kFromDoF95(v){ if(!isFinite(v)||v>120) return 1.96; const r=Math.round(v); if(T_95[r]) return T_95[r]; const lo=Math.max(...Object.keys(T_95).map(Number).filter(k=>k<r)); const hi=Math.min(...Object.keys(T_95).map(Number).filter(k=>k>r)); return T_95[lo] + (r-lo)*(T_95[hi]-T_95[lo])/(hi-lo); }

// Normal CDF & inverse (Acklam approx)
function normCdf(x){ return 0.5*(1+erf(x/Math.SQRT2)); }
function erf(x){ // Abramowitz-Stegun
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x<0?-1:1; x=Math.abs(x); const t=1/(1+p*x);
  const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return sign*y;
}
function normInv(p){ // Peter J. Acklam approximation
  if(p<=0||p>=1) return NaN;
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
  const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
  const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
  const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  const pl=0.02425, ph=1-pl; let q,r,x;
  if(p<pl){ q=Math.sqrt(-2*Math.log(p)); x=((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]; x/=(((d[0]*q+d[1])*q+d[2])*q+d[3]); }
  else if(p>ph){ q=Math.sqrt(-2*Math.log(1-p)); x=-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])); }
  else { q=p-0.5; r=q*q; x=(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  // one step Halley correction
  const e = 0.5*(1+erf(x/Math.SQRT2)) - p; const u = e * Math.SQRT2*Math.sqrt(Math.PI) * Math.exp(x*x/2);
  return x - u/(1 + x*u/2);
}

// ----------------- UI atoms -----------------
function Section({title, children}){
  return (
    <div className="accordion-card">
      <div className="accordion-header"><h4>{title}</h4><span className="accordion-icon open">▾</span></div>
      <div className="accordion-content">{children}</div>
    </div>
  );
}

function BudgetTable({rows, onRemove, results, useT, setUseT}){
  const uc = useMemo(()=>Math.sqrt(rows.reduce((s,r)=>s + r.u**2,0) || 0),[rows]);
  return (
    <table className="uncertainty-budget-table">
      <thead><tr><th>Component</th><th>Type</th><th>uᵢ (ppm)</th><th>vᵢ</th><th/></tr></thead>
      <tbody>
        {rows.map(r=> (
          <tr key={r.id}><td>{r.name}</td><td>{r.type}</td><td>{r.u.toFixed(4)}</td><td>{r.v === Infinity ? "∞" : r.v}</td>
            <td>{!r.lock && <span className="delete-action" onClick={()=>onRemove(r.id)}>×</span>}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td colSpan={2}>Combined Standard Uncertainty (uₑ)</td><td>{uc.toFixed(4)}</td><td colSpan={2}/></tr>
        {results && (
          <>
            <tr><td colSpan={2}>Effective DoF (vₑₒₒ)</td><td>{results.veff===Infinity?"∞":results.veff.toFixed(2)}</td><td colSpan={2}/></tr>
            <tr><td colSpan={2}>Coverage Factor (k)</td><td>{results.k.toFixed(3)}</td><td colSpan={2}><label className="k-factor-label"><input type="checkbox" checked={useT} onChange={e=>setUseT(e.target.checked)}/> Use t-dist</label></td></tr>
          </>
        )}
      </tfoot>
    </table>
  );
}

// ----------------- main -----------------
export default function MuaToolPro(){
  // Nominal context (for absolute-to-relative conversion)
  const [nominal, setNominal] = useState({value:"10", unit:"V"});

  // UUT & TMDE definitions
  const [uut,setUut] = useState({distribution:"uniform", tol:"100", unit:"ppm"});
  const [tmde,setTmde] = useState({distribution:"normal", U:"50", unit:"ppm", k:"2"});

  // Manual components
  const [rows, setRows] = useState([]);
  const [newRow, setNewRow] = useState({name:"", type:"B", dist:"uniform", tol:"", unit:"ppm", U:"", k:"2", ua:"", dof:"Infinity"});

  // Risk / guard band settings
  const [useT, setUseT] = useState(false);
  const [targetConsumerRisk, setTargetConsumerRisk] = useState(0.02); // two-sided risk, e.g., 2%

  const [results, setResults] = useState(null);

  // Derived core components from UUT/TMDE
  const coreRows = useMemo(()=>{
    const r=[];
    // UUT
    let uutPPM = NaN;
    if(uut.distribution === "uniform"|| uut.distribution === "triangular"|| uut.distribution === "normal"){
      const base = uut.unit === "ppm" || uut.unit === "%" ? parseFloat(uut.tol) : convertToPPM(uut.tol, uut.unit, nominal.value, nominal.unit);
      if(isFinite(base)){
        if(uut.distribution === "uniform") uutPPM = base/Math.sqrt(3);
        else if(uut.distribution === "triangular") uutPPM = base/Math.sqrt(6);
        else uutPPM = base/2; // expanded tol ± interpreted as 2σ
      }
    }
    if(isFinite(uutPPM) && uutPPM>0) r.push({id:"uut", name:"UUT", type:"B", u:uutPPM, v:Infinity, lock:true});

    // TMDE
    let tmdePPM = NaN;
    if(tmde.distribution === "normal"){
      const U = tmde.unit === "ppm" || tmde.unit === "%" ? parseFloat(tmde.U) : convertToPPM(tmde.U, tmde.unit, nominal.value, nominal.unit);
      const k = parseFloat(tmde.k||"2");
      if(isFinite(U) && isFinite(k) && U>0 && k>0) tmdePPM = U/k;
    } else {
      const base = tmde.unit === "ppm" || tmde.unit === "%" ? parseFloat(tmde.tol) : convertToPPM(tmde.tol, tmde.unit, nominal.value, nominal.unit);
      if(isFinite(base)) tmdePPM = tmde.distribution === "uniform" ? base/Math.sqrt(3) : base/Math.sqrt(6);
    }
    if(isFinite(tmdePPM) && tmdePPM>0) r.push({id:"tmde", name:"Standard Instrument (TMDE)", type:"B", u:tmdePPM, v:Infinity, lock:true});

    return r;
  },[uut,tmde,nominal]);

  const allRows = useMemo(()=>[...coreRows, ...rows], [coreRows, rows]);

  // Recompute results
  useEffect(()=>{
    if(allRows.length===0){ setResults(null); return; }
    const uc2 = allRows.reduce((s,r)=>s + r.u*r.u, 0);
    const uc = Math.sqrt(uc2);
    const num = uc**4;
    const den = allRows.reduce((s,r)=> r.v===Infinity? s : s + (r.u**4)/r.v, 0);
    const veff = den>0 ? num/den : Infinity;
    const k = useT ? kFromDoF95(veff) : 2;
    const U = k*uc;

    // TUR/TAR
    const uutSpan = (()=>{ // ±tol in ppm
      const raw = uut.unit === "ppm" || uut.unit === "%" ? parseFloat(uut.tol) : convertToPPM(uut.tol, uut.unit, nominal.value, nominal.unit);
      return isFinite(raw) ? 2*raw : NaN; // span = 2×±tol
    })();
    const tmdeSpan = (()=>{
      if(tmde.distribution === "normal"){
        const Uppm = tmde.unit === "ppm" || tmde.unit === "%" ? parseFloat(tmde.U) : convertToPPM(tmde.U, tmde.unit, nominal.value, nominal.unit);
        return isFinite(Uppm) ? 2*Uppm : NaN;
      }
      const base = tmde.unit === "ppm" || tmde.unit === "%" ? parseFloat(tmde.tol) : convertToPPM(tmde.tol, tmde.unit, nominal.value, nominal.unit);
      return isFinite(base) ? 2*base : NaN;
    })();

    const TUR = (isFinite(uutSpan) && isFinite(U) && U>0) ? (uutSpan / U) : NaN;
    const TAR = (isFinite(uutSpan) && isFinite(tmdeSpan) && tmdeSpan>0) ? (uutSpan / tmdeSpan) : NaN;

    // Guard banding & risks (approx.)
    const twoSidedRisk = Math.max(0, Math.min(0.5, targetConsumerRisk));
    const oneSided = twoSidedRisk/2; // distribute equally
    const z = normInv(1 - oneSided); // e.g., ~2.24 for 1% one-sided
    const g = z * uc; // guard band in ppm
    const tolppm = uut.unit === "ppm" || uut.unit === "%" ? (uut.unit === "%" ? parseFloat(uut.tol)/100*1e6 : parseFloat(uut.tol)) : convertToPPM(uut.tol, uut.unit, nominal.value, nominal.unit);
    const accLimit = isFinite(tolppm) && isFinite(g) ? Math.max(0, tolppm - g) : NaN; // ±(T - g)

    // Approximate risks for centered results (δ=0)
    const pfa = (isFinite(accLimit) && uc>0) ? (1 - normCdf((accLimit)/uc)) * 2 : NaN; // two-sided
    const pfr = (isFinite(tolppm) && isFinite(accLimit) && uc>0) ? Math.max(0, 2*(normCdf((tolppm-accLimit)/uc) - 0.5)) : NaN;

    setResults({ uc, veff, k, U, TUR, TAR, z, g, tolppm, accLimit, pfa, pfr });
  },[allRows, useT, uut, tmde, nominal, targetConsumerRisk]);

  // Handlers
  const addRow = ()=>{
    let u=NaN, v=Infinity;
    if(newRow.type === "A"){
      const ua = parseFloat(newRow.ua);
      v = newRow.dof === "Infinity" ? Infinity : parseFloat(newRow.dof);
      if(!isFinite(ua) || ua<=0 || (!isFinite(v) && newRow.dof!=="Infinity")) return;
      u = (newRow.unit === "ppm" || newRow.unit === "%") ? (newRow.unit === "%" ? ua/100*1e6 : ua) : convertToPPM(ua, newRow.unit, nominal.value, nominal.unit);
    } else {
      if(newRow.dist === "normal"){
        const U = (newRow.unit === "ppm" || newRow.unit === "%") ? (newRow.unit === "%" ? parseFloat(newRow.U)/100*1e6 : parseFloat(newRow.U)) : convertToPPM(newRow.U, newRow.unit, nominal.value, nominal.unit);
        const k = parseFloat(newRow.k||"2");
        if(isFinite(U) && isFinite(k) && U>0 && k>0) u = U/k;
      } else {
        const tol = (newRow.unit === "ppm" || newRow.unit === "%") ? (newRow.unit === "%" ? parseFloat(newRow.tol)/100*1e6 : parseFloat(newRow.tol)) : convertToPPM(newRow.tol, newRow.unit, nominal.value, nominal.unit);
        if(isFinite(tol) && tol>0) u = newRow.dist === "uniform" ? tol/Math.sqrt(3) : tol/Math.sqrt(6);
      }
    }
    if(!isFinite(u) || u<=0) return;
    setRows(rs=>[...rs,{id:Date.now().toString(36), name:newRow.name||"Custom", type:newRow.type, u, v:newRow.type==="A"?(newRow.dof==="Infinity"?Infinity:parseFloat(newRow.dof)):Infinity}]);
    setNewRow({name:"", type:"B", dist:"uniform", tol:"", unit:"ppm", U:"", k:"2", ua:"", dof:"Infinity"});
  };

  const removeRow = id => setRows(rs=>rs.filter(r=>r.id!==id));

  // ----------------- render -----------------
  return (
    <div className="uncertainty-analysis-page content-area">
      <h2>Measurement Uncertainty Assistant (Pro)</h2>

      <div className="analysis-dashboard">
        {/* Configuration panel */}
        <div className="configuration-panel">
          <Section title="Nominal & Units">
            <div className="tolerance-input-container">
              <div className="config-column">
                <label>Nominal Value</label>
                <div className="input-with-unit">
                  <input type="number" value={nominal.value} onChange={e=>setNominal(n=>({...n,value:e.target.value}))}/>
                  <select value={nominal.unit} onChange={e=>setNominal(n=>({...n,unit:e.target.value}))}>
                    {Object.keys(unitFamilies).filter(u=>u!=="%" && u!=="ppm").map(u=> <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </Section>

          <Section title="UUT Definition">
            <div className="tolerance-input-container">
              <div className="config-column">
                <label>Distribution</label>
                <select value={uut.distribution} onChange={e=>setUut(u=>({...u,distribution:e.target.value}))}>
                  <option value="uniform">Uniform (Rectangular)</option>
                  <option value="triangular">Triangular</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <div className="config-column">
                <label>{uut.distribution==="normal"?"Expanded Uncertainty (±)":"Tolerance (±)"}</label>
                <div className="input-with-unit">
                  <input type="number" value={uut.tol} onChange={e=>setUut(u=>({...u,tol:e.target.value}))}/>
                  <select value={uut.unit} onChange={e=>setUut(u=>({...u,unit:e.target.value}))}>
                    {Object.keys(unitFamilies).map(u=> <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Standard Instrument (TMDE)">
            <div className="tolerance-input-container">
              <div className="config-column">
                <label>Distribution</label>
                <select value={tmde.distribution} onChange={e=>setTmde(t=>({...t,distribution:e.target.value}))}>
                  <option value="normal">Normal (U, k)</option>
                  <option value="uniform">Uniform (±tol)</option>
                  <option value="triangular">Triangular (±tol)</option>
                </select>
              </div>
              {tmde.distribution==="normal"? (
                <>
                  <div className="config-column">
                    <label>Expanded Uncertainty (±U)</label>
                    <div className="input-with-unit">
                      <input type="number" value={tmde.U} onChange={e=>setTmde(t=>({...t,U:e.target.value}))}/>
                      <select value={tmde.unit} onChange={e=>setTmde(t=>({...t,unit:e.target.value}))}>
                        {Object.keys(unitFamilies).map(u=> <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="config-column">
                    <label>Coverage Factor (k)</label>
                    <input type="number" value={tmde.k} onChange={e=>setTmde(t=>({...t,k:e.target.value}))}/>
                  </div>
                </>
              ):(
                <div className="config-column">
                  <label>Tolerance (±)</label>
                  <div className="input-with-unit">
                    <input type="number" value={tmde.tol||""} onChange={e=>setTmde(t=>({...t,tol:e.target.value}))}/>
                    <select value={tmde.unit} onChange={e=>setTmde(t=>({...t,unit:e.target.value}))}>
                      {Object.keys(unitFamilies).map(u=> <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="config-column">
                    <label>Shape</label>
                    <select value={tmde.distribution} onChange={e=>setTmde(t=>({...t,distribution:e.target.value}))}>
                      <option value="uniform">Uniform</option>
                      <option value="triangular">Triangular</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section title="Add Manual Components">
            <div className="config-grid">
              <div className="config-column">
                <label>Name</label>
                <input value={newRow.name} onChange={e=>setNewRow(n=>({...n,name:e.target.value}))}/>
              </div>
              <div className="config-column">
                <label>Type</label>
                <select value={newRow.type} onChange={e=>setNewRow(n=>({...n,type:e.target.value}))}>
                  <option value="A">Type A</option>
                  <option value="B">Type B</option>
                </select>
              </div>
              {newRow.type === "A" ? (
                <>
                  <div className="config-column">
                    <label>Standard Uncertainty (u)</label>
                    <div className="input-with-unit">
                      <input type="number" value={newRow.ua} onChange={e=>setNewRow(n=>({...n,ua:e.target.value}))}/>
                      <select value={newRow.unit} onChange={e=>setNewRow(n=>({...n,unit:e.target.value}))}>
                        {Object.keys(unitFamilies).map(u=> <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="config-column">
                    <label>Degrees of Freedom</label>
                    <input value={newRow.dof} onChange={e=>setNewRow(n=>({...n,dof:e.target.value}))}/>
                  </div>
                </>
              ):(
                <>
                  <div className="config-column">
                    <label>Distribution</label>
                    <select value={newRow.dist} onChange={e=>setNewRow(n=>({...n,dist:e.target.value}))}>
                      <option value="uniform">Uniform</option>
                      <option value="triangular">Triangular</option>
                      <option value="normal">Normal</option>
                    </select>
                  </div>
                  {newRow.dist === "normal" ? (
                    <>
                      <div className="config-column">
                        <label>Expanded Uncertainty (±U)</label>
                        <div className="input-with-unit">
                          <input type="number" value={newRow.U} onChange={e=>setNewRow(n=>({...n,U:e.target.value}))}/>
                          <select value={newRow.unit} onChange={e=>setNewRow(n=>({...n,unit:e.target.value}))}>
                            {Object.keys(unitFamilies).map(u=> <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="config-column">
                        <label>Coverage Factor (k)</label>
                        <input type="number" value={newRow.k} onChange={e=>setNewRow(n=>({...n,k:e.target.value}))}/>
                      </div>
                    </>
                  ):(
                    <div className="config-column">
                      <label>Tolerance (±)</label>
                      <div className="input-with-unit">
                        <input type="number" value={newRow.tol} onChange={e=>setNewRow(n=>({...n,tol:e.target.value}))}/>
                        <select value={newRow.unit} onChange={e=>setNewRow(n=>({...n,unit:e.target.value}))}>
                          {Object.keys(unitFamilies).map(u=> <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <button className="button button-small" onClick={addRow}>Add Component</button>
          </Section>

          <Section title="Guard Banding & Risk">
            <div className="tolerance-input-container">
              <div className="config-column">
                <label>Target consumer risk (two-sided)</label>
                <div className="input-with-unit">
                  <input type="number" step="0.001" min="0" max="0.5"
                         value={targetConsumerRisk}
                         onChange={e=>setTargetConsumerRisk(parseFloat(e.target.value)||0)}/>
                  <span className="unit-badge">prob.</span>
                </div>
                <small>Example: 0.02 ⇒ ~2% overall false-accept risk target</small>
              </div>
            </div>
          </Section>
        </div>

        {/* Results side */}
        <div className="configuration-panel">
          <Section title="Uncertainty Budget">
            <BudgetTable rows={allRows} onRemove={removeRow} results={results} useT={useT} setUseT={setUseT} />
            {results && (
              <>
                <div className="final-result-value">U = ± <span>{results.U.toFixed(3)}</span> ppm</div>
                <ul className="result-breakdown">
                  <li><span className="label">Combined (uₑ)</span><span className="value">{results.uc.toFixed(4)} ppm</span></li>
                  <li><span className="label">k</span><span className="value">{results.k.toFixed(3)}</span></li>
                  <li><span className="label">vₑₒₒ</span><span className="value">{results.veff===Infinity?"∞":results.veff.toFixed(2)}</span></li>
                </ul>
              </>
            )}
          </Section>

          <Section title="TUR / TAR">
            {!results ? (
              <div className="placeholder-content"><h3>No results yet</h3><p>Define UUT/TMDE to compute ratios.</p></div>
            ):(
              <div className="risk-analysis-container">
                <div className="risk-analysis-dashboard">
                  <div className="risk-card tur-card">
                    <div className="risk-value">{isFinite(results.TUR)?results.TUR.toFixed(2):"—"} : 1</div>
                    <div className="risk-label">Test Uncertainty Ratio (TUR)</div>
                    <div className="risk-explanation">UUT tolerance span ÷ expanded uncertainty.</div>
                  </div>
                  <div className="risk-card tur-card">
                    <div className="risk-value">{isFinite(results.TAR)?results.TAR.toFixed(2):"—"} : 1</div>
                    <div className="risk-label">Test Acceptance Ratio (TAR)</div>
                    <div className="risk-explanation">UUT tolerance span ÷ TMDE tolerance span.</div>
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="Guard Banded Decision & Risk (approx.)">
            {!results ? (
              <div className="placeholder-content"><h3>No results yet</h3><p>Enter UUT/TMDE to see guard band.</p></div>
            ):(
              <div className="risk-analysis-container">
                <div className="risk-analysis-dashboard">
                  <div className="risk-card">
                    <div className="risk-value">{isFinite(results.g)?results.g.toFixed(2):"—"} ppm</div>
                    <div className="risk-label">Guard Band (g)</div>
                    <div className="risk-explanation">g = z×uₑ, z from target risk.</div>
                  </div>
                  <div className="risk-card">
                    <div className="risk-value">± {isFinite(results.accLimit)?results.accLimit.toFixed(2):"—"} ppm</div>
                    <div className="risk-label">Acceptance Limits</div>
                    <div className="risk-explanation">±(T − g) where T = UUT tolerance.</div>
                  </div>
                  <div className="risk-card">
                    <div className="risk-value">{isFinite(results.pfa)?(results.pfa*100).toFixed(2):"—"}%</div>
                    <div className="risk-label">PFA (False Accept)</div>
                    <div className="risk-explanation">Two-sided, centered estimate.</div>
                  </div>
                  <div className="risk-card">
                    <div className="risk-value">{isFinite(results.pfr)?(results.pfr*100).toFixed(2):"—"}%</div>
                    <div className="risk-label">PFR (False Reject)</div>
                    <div className="risk-explanation">Two-sided, centered estimate.</div>
                  </div>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
