import React, { useState } from 'react';
import axios from 'axios';

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
      // Make API call to backend to validate RSVP code
      // If successful, response will contain guest information
      const response = await axios.post('http://localhost:3001/api/login', {
        rsvpCode
      });
      // Update parent component with guest data on successful login
      setGuestData(response.data);
      // Clear any previous error messages
      setError('');
    } catch (err) {
      // Handle any errors (invalid code, server issues, etc.)
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