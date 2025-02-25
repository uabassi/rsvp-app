import React, { useState } from 'react';
import axios from 'axios';
import './RsvpForm.css';  // Add this import


function RsvpForm({ guestData }) {
  // State to store responses for each event
  const [responses, setResponses] = useState(
    guestData.events.map(event => ({
      event_id: event.id,
      attending: true,
      comment: ''
    }))
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Handle change for a specific event response
  const handleResponseChange = (index, field, value) => {
    const newResponses = [...responses];
    newResponses[index] = {
      ...newResponses[index],
      [field]: value
    };
    setResponses(newResponses);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/rsvp', {
        guestId: guestData.guest_id,
        responses
      });
      setSubmitted(true);
      setError('');
    } catch (err) {
      console.error('RSVP submission error:', err);
      setError(err.response?.data?.error || 'Error submitting RSVP');
    }
  };

  if (submitted) {
    return (
      <div className="thank-you-container">
        <h2 className="thank-you-title">Thank you!</h2>
        <p className="thank-you-text">Your RSVP has been submitted successfully.</p>
      </div>
    );
  }

  return (
    <div className="rsvp-content">
      <h2 className="rsvp-form-title">Submit Your RSVP</h2>
      <p className="rsvp-form-subtitle">Welcome, {guestData.name}!</p>
      <form onSubmit={handleSubmit} className="rsvp-form">
        {guestData.events.map((event, index) => (
          <div key={event.id} className="event-card">
            <h3 className="event-title">{event.name} - {event.date}</h3>
            <div className="form-group">
              <label className="form-label">Will you be attending?</label>
              <select
                className="form-select"
                value={responses[index].attending ? "1" : "0"}
                onChange={(e) => handleResponseChange(index, 'attending', e.target.value === "1")}
              >
                <option value="1">Yes, I will attend</option>
                <option value="0">No, I cannot attend</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Comments for {event.name}:</label>
              <textarea
                className="form-textarea"
                value={responses[index].comment}
                onChange={(e) => handleResponseChange(index, 'comment', e.target.value)}
                placeholder={`Add any comments for ${event.name}...`}
              />
            </div>
          </div>
        ))}
        <button type="submit" className="reply-button">Submit RSVP</button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}

export default RsvpForm; 