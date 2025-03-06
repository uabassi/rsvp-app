import React, { useState } from 'react';
import axios from 'axios';
import config from '../config';

function LoginForm({ setGuestData }) {
  // State variables for form management
  // rsvpCode: stores the user input value
  // error: stores any error messages to display
  const [rsvpCode, setRsvpCode] = useState('');
  const [error, setError] = useState('');

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    try {
      console.log('Attempting to connect to:', `${config.apiUrl}/api/login`);
      const response = await axios.post(`${config.apiUrl}/api/login`, {
        rsvpCode
      });
      console.log('Response:', response.data);
      setGuestData(response.data);
      setError('');
    } catch (err) {
      console.error('Full error:', err);
      setError(err.response?.data?.error || 'Error connecting to server');
    }
  };

  return (
    <>
      <h1 className="rsvp-title">RSVP</h1>
      <p className="rsvp-subtitle">Please Enter The Code From Your Invitation</p>
      <form onSubmit={handleSubmit} className="rsvp-form">
        <input
          type="text"
          value={rsvpCode}
          onChange={(e) => setRsvpCode(e.target.value)}
          placeholder="Enter RSVP Code"
          className="rsvp-input"
          required
        />
        <button type="submit" className="reply-button">
          Submit
        </button>
        {error && <div className="error-message">{error}</div>}
      </form>
    </>
  );
}

export default LoginForm; 