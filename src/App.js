import React, { useState } from 'react';
import AnalysisInfoPage from './pages/AnalysisInfoPage';
import NotesPage from './pages/NotesPage';
import DocumentPage from './pages/DocumentPage';
import RiskAssumedReopPage from './pages/RiskAssumedReopPage';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('document');

  const renderPage = () => {
    switch (activeTab) {
      case 'analysis':
        return <AnalysisInfoPage />;
      case 'notes':
        return <NotesPage />;
      case 'document':
        return <DocumentPage />;
      case 'risk':
        return <RiskAssumedReopPage />;
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <nav className="main-nav">
        <button onClick={() => setActiveTab('analysis')}>Analysis Info</button>
        <button onClick={() => setActiveTab('notes')}>Notes</button>
        <button onClick={() => setActiveTab('document')}>Document</button>
        <button onClick={() => setActiveTab('risk')}>Risk (Assumed REOP)</button>
      </nav>
      {renderPage()}
    </div>
  );
}

export default App;
