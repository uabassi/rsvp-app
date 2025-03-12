import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginForm from './components/LoginForm';
import RsvpForm from './components/RsvpForm';
import AdminView from './components/AdminView';
import AdminLogin from './components/AdminLogin';
import engagementPhoto from './assets/ring.png';

function App() {
  const [guestData, setGuestData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
          <>
            <LoginForm setGuestData={setGuestData} />
            <div className="admin-login-button fixed-bottom">
              <a href="/admin">Admin Login</a>
            </div>
          </>
        ) : (
          <>
            <RsvpForm guestData={guestData} />
            <div className="admin-login-button scroll-with-content">
              <a href="/admin">Admin</a>
            </div>
          </>
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