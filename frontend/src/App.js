import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginForm from './components/LoginForm';
import RsvpForm from './components/RsvpForm';
import AdminView from './components/AdminView';
import engagementPhoto from './assets/ring.png';

function App() {
  const [guestData, setGuestData] = useState(null);

  const handleReset = () => {
    setGuestData(null);
  };

  const MainPage = () => (
    <div className="landing-page">
      <header className="landing-header" onClick={handleReset}>
        <h1>Malaika & Umayya</h1>
      </header>
      <main className="content-section">
        {!guestData ? (
          <LoginForm setGuestData={setGuestData} />
        ) : (
          <RsvpForm guestData={guestData} />
        )}
      </main>
      <div className="image-section">
        <img 
          src={engagementPhoto}
          alt="Engagement" 
          className="engagement-photo"
        />
      </div>
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminView />} />
        <Route path="/" element={<MainPage />} />
      </Routes>
    </Router>
  );
}

export default App; 