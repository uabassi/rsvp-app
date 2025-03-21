import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import LoginForm from './components/LoginForm';
import RsvpForm from './components/RsvpForm';
import AdminView from './components/AdminView';
import AdminLogin from './components/AdminLogin';
import engagementPhoto from './assets/ring.png';
import axios from 'axios';
import config from './config';

// Create a new component for the main content
function MainContent({ setGuestData, guestData, handleReset }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get rsvp code from URL parameters
    const params = new URLSearchParams(location.search);
    const code = params.get('code');

    // If there's a code in the URL and we're not already logged in, try to log in
    if (code && !guestData) {
      setIsLoading(true);
      setError('');

      axios.post(`${config.apiUrl}/api/login`, { rsvpCode: code })
        .then(response => {
          setGuestData(response.data);
          // Remove the code from the URL without reloading the page
          navigate('/', { replace: true });
        })
        .catch(err => {
          console.error('Login error:', err);
          setError('Invalid RSVP code');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [location, guestData, setGuestData, navigate]);

  return (
    <div className="landing-page">
      <header className="landing-header" onClick={handleReset}>
        <h1>Malaika & Umayya</h1>
      </header>
      <main className="content-section">
        {isLoading ? (
          <div className="loading">Loading...</div>
        ) : !guestData ? (
          <>
            <LoginForm setGuestData={setGuestData} error={error} />
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
}

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

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <MainContent 
              setGuestData={setGuestData} 
              guestData={guestData} 
              handleReset={handleReset}
            />
          } 
        />
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