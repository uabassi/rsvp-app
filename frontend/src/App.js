import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginForm from './components/LoginForm';
import RsvpForm from './components/RsvpForm';
import AdminView from './components/AdminView';
import AdminLogin from './components/AdminLogin';
import engagementPhoto from './assets/ring.png';

function App() {
  const [guestData, setGuestData] = useState(() => {
    const savedGuestData = localStorage.getItem('guestData');
    return savedGuestData ? JSON.parse(savedGuestData) : null;
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAdminAuthenticated') === 'true';
  });

  useEffect(() => {
    if (guestData) {
      localStorage.setItem('guestData', JSON.stringify(guestData));
    }
  }, [guestData]);

  useEffect(() => {
    localStorage.setItem('isAdminAuthenticated', isAuthenticated);
  }, [isAuthenticated]);

  const handleReset = () => {
    setGuestData(null);
    localStorage.removeItem('guestData');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAdminAuthenticated');
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
            isAuthenticated ? (
              <div>
                <AdminView />
                <button onClick={handleLogout} className="admin-logout-button">
                  Logout
                </button>
              </div>
            ) : (
              <AdminLogin setIsAuthenticated={setIsAuthenticated} />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App; 