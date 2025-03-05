import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

function AdminLogin({ setIsAuthenticated }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === 'wedding2025') {
            setIsAuthenticated(true);
            navigate('/admin');
        } else {
            setError('Incorrect password');
        }
    };

    return (
        <div className="admin-login-container">
            <form onSubmit={handleSubmit} className="admin-login-form">
                <h2>Admin Access</h2>
                {error && <div className="error-message">{error}</div>}
                <div className="form-group">
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                    />
                </div>
                <button type="submit">Login</button>
                <a href="/" className="back-link">Back to Home</a>
            </form>
        </div>
    );
}

export default AdminLogin; 