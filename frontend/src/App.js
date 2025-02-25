import React, { useState } from 'react';
import './App.css';
import LoginForm from './components/LoginForm';
import RsvpForm from './components/RsvpForm';
import engagementPhoto from './assets/ring.png';

function App() {
  const [guestData, setGuestData] = useState(null);

  const handleReset = () => {
    setGuestData(null);
  };

  return (
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
}

export default App; 