import React, { useState } from 'react';
import axios from 'axios';
import './RsvpForm.css';
import config from '../config';

function RsvpForm({ guestData }) {
  console.log('Initial Guest Data:', guestData);
  
  // State to store responses for each family member
  const [familyResponses, setFamilyResponses] = useState(() => {
    // Initialize responses for each family member with null attendance
    const initialResponses = {};
    
    guestData.family_guests.forEach(guest => {
      initialResponses[guest.name] = {};
      if (guest.events) {
        guest.events.forEach(event => {
          initialResponses[guest.name][event.id] = {
            attending: null, // Initialize as null instead of false
            guest_id: guest.guest_id
          };
        });
      }
    });
    
    return initialResponses;
  });

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleResponseChange = (memberName, eventId, field, value) => {
    setFamilyResponses(prev => ({
      ...prev,
      [memberName]: {
        ...prev[memberName],
        [eventId]: {
          ...prev[memberName][eventId],
          [field]: value,
          guest_id: prev[memberName][eventId].guest_id
        }
      }
    }));
  };

  const validateResponses = () => {
    let missingResponses = [];
    
    Object.entries(familyResponses).forEach(([memberName, memberEvents]) => {
      Object.entries(memberEvents).forEach(([eventId, response]) => {
        if (response.attending === null) {
          const guest = guestData.family_guests.find(g => g.name === memberName);
          const event = guest.events.find(e => e.id === parseInt(eventId));
          missingResponses.push(`${memberName} - ${event.name}`);
        }
      });
    });
    
    return missingResponses;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for missing responses
    const missingResponses = validateResponses();
    if (missingResponses.length > 0) {
      setError(`Please respond to all events:\n${missingResponses.join('\n')}`);
      return;
    }

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

      await axios.post(`${config.apiUrl}/api/rsvp`, {
        responses
      });
      setSubmitted(true);
      setError('');
    } catch (err) {
      console.error('RSVP submission error:', err);
      setError(err.response?.data?.error || 'Error submitting RSVP');
    }
  };

  // Add this function after the imports and before the RsvpForm component
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Split the date string into components
    const [month, day, year] = dateString.split('-');
    
    // Create a formatted date string
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
      {/* <p className="rsvp-form-subtitle">Assalamu 'alaykum, {guestData.family_name} Family!</p> */}
      <p className="family-note">Asalamualykum {guestData.family_name} Family, with hearts full of gratitude to Allah (SWT), we are delighted to invite you to join us in celebrating the blessed union of Umayya Abassi and Malaika Kiyani. Please kindly RSVP to the events we have invited each of your family members to in sha Allah</p>
      
      <form onSubmit={handleSubmit} className="rsvp-form">
        {guestData.family_guests.map((guest, index) => (
          <div key={guest.guest_id} className="guest-section">
            <div className="guest-header">
              <h3 className="guest-name">Family Member: {guest.name}</h3>
            </div>
            
            {guest.events && guest.events.map(event => (
              <div key={`${guest.guest_id}-${event.id}`} className="event-card">
                <h4 className="event-title">
                  {event.name} - {formatDate(event.date)}
                </h4>
                
                <div className="form-group attendance-options">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`attendance-${guest.guest_id}-${event.id}`}
                      checked={familyResponses[guest.name]?.[event.id]?.attending === true}
                      onChange={() => handleResponseChange(guest.name, event.id, 'attending', true)}
                    />
                    Will Attend
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name={`attendance-${guest.guest_id}-${event.id}`}
                      checked={familyResponses[guest.name]?.[event.id]?.attending === false}
                      onChange={() => handleResponseChange(guest.name, event.id, 'attending', false)}
                    />
                    Cannot Attend
                  </label>
                </div>
              </div>
            ))}
            {index < guestData.family_guests.length - 1 && <div className="guest-divider" />}
          </div>
        ))}
        
        <button type="submit" className="reply-button">Submit Family RSVP</button>
        {error && <p className="error-message">{error.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line}<br/>
          </React.Fragment>
        ))}</p>}
      </form>
    </div>
  );
}

export default RsvpForm; 