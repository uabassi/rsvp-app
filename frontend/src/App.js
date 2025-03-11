import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginForm from './components/LoginForm';
import RsvpForm from './components/RsvpForm';
import AdminView from './components/AdminView';
import AdminLogin from './components/AdminLogin';
import engagementPhoto from './assets/ring.png';
import engagementPhotoMobile from './assets/ring-mobile.png';

function App() {
  const [guestData, setGuestData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleReset = () => {
    setGuestData(null);
  };

  const isMobile = window.innerWidth <= 768;

  const MainPage = () => (
    <div className="landing-page">
      <header className="landing-header" onClick={handleReset}>
        <h1>Malaika & Umayya</h1>
      </header>
      {!guestData && (
        <div className="admin-login-button">
          <a href="/admin">Admin</a>
        </div>
      )}
      <main className="content-section">
        {!guestData ? (
          <LoginForm setGuestData={setGuestData} />
        ) : (
          <RsvpForm guestData={guestData} />
        )}
      </main>
      <div className="image-section">
        <img 
          src={isMobile ? engagementPhotoMobile : engagementPhoto}
          alt="Engagement" 
          className={`engagement-photo ${imageLoaded ? 'loaded' : ''}`}
          onLoad={() => setImageLoaded(true)}
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      </div>
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route 
          path="/admin" 
          element={
            isAuthenticated ? <AdminView /> : <AdminLogin setIsAuthenticated={setIsAuthenticated} />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App; 