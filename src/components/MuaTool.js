import React, { useState } from 'react';
import './MuaTool.css';

/**
 * MuaTool provides a simple interface for combining uncertainty
 * contributors using the root-sum-of-squares method. Users can
 * add or remove contributors and view the combined and expanded
 * uncertainty.
 */
export default function MuaTool() {
  const [contributors, setContributors] = useState([
    { id: Date.now(), name: '', std: '' }
  ]);

  const addContributor = () => {
    setContributors([...contributors, { id: Date.now(), name: '', std: '' }]);
  };

  const removeContributor = (id) => {
    setContributors(contributors.filter(c => c.id !== id));
  };

  const updateContributor = (id, field, value) => {
    setContributors(contributors.map(c => (
      c.id === id ? { ...c, [field]: value } : c
    )));
  };

  const combined = Math.sqrt(
    contributors.reduce((sum, c) => sum + Math.pow(parseFloat(c.std) || 0, 2), 0)
  );
  const expanded = combined * 2; // default coverage factor k=2

  return (
    <div className="mua-tool">
      <h2>Measurement Uncertainty Assistant</h2>
      <table className="mua-table">
        <thead>
          <tr>
            <th>Contributor</th>
            <th>Std. Uncertainty</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contributors.map(c => (
            <tr key={c.id}>
              <td>
                <input
                  type="text"
                  value={c.name}
                  onChange={e => updateContributor(c.id, 'name', e.target.value)}
                  placeholder="e.g. Reference"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="any"
                  value={c.std}
                  onChange={e => updateContributor(c.id, 'std', e.target.value)}
                  placeholder="0.0"
                />
              </td>
              <td>
                <button
                  className="remove-btn"
                  onClick={() => removeContributor(c.id)}
                  aria-label="remove contributor"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="add-btn" onClick={addContributor}>Add Contributor</button>
      <div className="results">
        <p><strong>Combined Standard Uncertainty:</strong> {combined.toFixed(4)}</p>
        <p><strong>Expanded Uncertainty (k=2):</strong> {expanded.toFixed(4)}</p>
      </div>
    </div>
  );
}

