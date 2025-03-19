import React, { useState } from 'react';
import axios from 'axios';
import './RsvpForm.css';
import config from '../config';

function RsvpForm({ guestData }) {
  const [familyResponses, setFamilyResponses] = useState(() => {
    const initialResponses = {};
    guestData.family_guests.forEach(guest => {
      initialResponses[guest.name] = {};
      if (guest.events) {
        guest.events.forEach(event => {
          initialResponses[guest.name][event.id] = {
            attending: false,
            guest_id: guest.guest_id
          };
        });
      }
    });
    return initialResponses;
  });

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleCheckboxChange = (memberName, eventId) => {
    setFamilyResponses(prev => ({
      ...prev,
      [memberName]: {
        ...prev[memberName],
        [eventId]: {
          ...prev[memberName][eventId],
          attending: !prev[memberName][eventId]?.attending,
          guest_id: prev[memberName][eventId].guest_id
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const responses = [];
      Object.entries(familyResponses).forEach(([memberName, memberEvents]) => {
        Object.entries(memberEvents).forEach(([eventId, response]) => {
          responses.push({
            guest_id: response.guest_id,
            event_id: parseInt(eventId),
            attending: response.attending
          });
        });
      });

      await axios.post(`${config.apiUrl}/api/rsvp`, { responses });
      setSubmitted(true);
      setError('');
    } catch (err) {
      console.error('RSVP submission error:', err);
      setError(err.response?.data?.error || 'Error submitting RSVP');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [month, day, year] = dateString.split('-');
    return `${month}/${day}/${year}`;
  };

  if (submitted) {
    return (
      <div className="thank-you-container">
        <h2 className="thank-you-title">Thank you!</h2>
        <p className="thank-you-text">Your family's RSVP has been submitted successfully.</p>
      </div>
    );
  }

  return (
    <div className="rsvp-content">
      <h2 className="rsvp-form-title">Family RSVP</h2>
      <p className="family-note">
        Asalamualykum {guestData.family_name}, with hearts full of gratitude to Allah (SWT), we are delighted to invite you to join us in celebrating the blessed union of Umayya Abassi and Malaika Kiyani. Please check the events that each family member will attend. Leaving an event unchecked indicates that the member cannot attend.
      </p>
      
      <form onSubmit={handleSubmit} className="rsvp-form">
        <div className="family-grid">
          {guestData.family_guests.map(guest => (
            <div key={guest.guest_id} className="guest-card">
              <h3 className="guest-name">{guest.name}</h3>
              <div className="event-checkboxes">
                {guest.events && guest.events.map(event => (
                  <label 
                    key={`${guest.guest_id}-${event.id}`} 
                    className="checkbox-label"
                  >
                    <input
                      type="checkbox"
                      checked={familyResponses[guest.name]?.[event.id]?.attending === true}
                      onChange={() => handleCheckboxChange(guest.name, event.id)}
                    />
                    <span className="event-name">{event.name}</span>
                    <span className="event-date">({formatDate(event.date)})</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <button type="submit" className="reply-button">Submit Family RSVP</button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}

export default RsvpForm;