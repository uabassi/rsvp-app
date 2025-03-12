import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';
import './AdminView.css';

function AdminView() {
    const [eventTotals, setEventTotals] = useState([]);
    const [guestList, setGuestList] = useState([]);
    const [expandedFamilies, setExpandedFamilies] = useState(new Set());

    const fetchData = async () => {
        try {
            // Fetch event totals
            const totalsResponse = await axios.get(`${config.apiUrl}/api/event-totals`);
            setEventTotals(totalsResponse.data);

            // Fetch guest list
            const guestListResponse = await axios.get(`${config.apiUrl}/api/event-guest-list`);
            console.log('Guest list response:', guestListResponse.data);
            setGuestList(guestListResponse.data);

            // Fetch debug data
            const debugResponse = await axios.get(`${config.apiUrl}/api/debug-guest-list`);
            console.log('Debug data:', debugResponse.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const handleDeleteResponse = async (guestId) => {
        if (window.confirm('Are you sure you want to delete this RSVP response? The guest can still RSVP again.')) {
            try {
                await axios.delete(`${config.apiUrl}/api/rsvp/${guestId}`);
                // Refresh the data
                fetchData();
            } catch (error) {
                console.error('Error deleting response:', error);
                alert('Failed to delete response');
            }
        }
    };

    const handleDeleteGuest = async (guestId) => {
        if (window.confirm('WARNING: This will completely remove this guest from the database. They will not be able to RSVP without being re-added. Continue?')) {
            try {
                await axios.delete(`${config.apiUrl}/api/guest/${guestId}`);
                // Refresh the data
                fetchData();
            } catch (error) {
                console.error('Error deleting guest:', error);
                alert('Failed to delete guest');
            }
        }
    };

    const handleClearDatabase = async () => {
        if (window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            try {
                await axios.post(`${config.apiUrl}/api/clear-data`);
                alert('Database cleared successfully');
                // Refresh the data
                fetchData();
            } catch (error) {
                console.error('Error clearing database:', error);
                alert('Failed to clear database');
            }
        }
    };

    const toggleFamily = (familyName) => {
        setExpandedFamilies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(familyName)) {
                newSet.delete(familyName);
            } else {
                newSet.add(familyName);
            }
            return newSet;
        });
    };

    // Group guests by family
    const groupedGuests = guestList.reduce((acc, guest) => {
        const familyName = guest.family_name;
        if (!acc[familyName]) {
            acc[familyName] = [];
        }
        acc[familyName].push(guest);
        return acc;
    }, {});

    useEffect(() => {
        // Initial fetch
        fetchData();

        // Set up refresh interval (every 5 seconds)
        const interval = setInterval(fetchData, 5000);

        // Cleanup interval on component unmount
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1>Wedding RSVP Admin</h1>
                <div className="admin-controls">
                    <a href="/" className="home-link">← Back to Home</a>
                    <button onClick={fetchData} className="refresh-button">
                        Refresh Data
                    </button>
                </div>
            </div>

            <div className="admin-section">
                <h2>Event Totals</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Date</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {eventTotals.map(event => (
                            <tr key={event.event_id}>
                                <td>{event.event_name}</td>
                                <td>{event.event_date}</td>
                                <td>{event.total_attendees}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="admin-section">
                <h2>Guest List by Family</h2>
                <div className="family-list">
                    {Object.entries(groupedGuests).map(([familyName, familyGuests]) => (
                        <div key={familyName} className="family-section">
                            <div 
                                className="family-header"
                                onClick={() => toggleFamily(familyName)}
                            >
                                <h3>{familyName}</h3>
                                <span className="expand-icon">
                                    {expandedFamilies.has(familyName) ? '▼' : '▶'}
                                </span>
                            </div>
                            {expandedFamilies.has(familyName) && (
                                <table className="family-details">
                                    <thead>
                                        <tr>
                                            <th>Guest</th>
                                            <th>Event</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {familyGuests.map((guest, index) => (
                                            <tr key={`${guest.guest_id}-${index}`}>
                                                <td>{guest.guest_name}</td>
                                                <td>{guest.event_name} ({guest.event_date})</td>
                                                <td>{guest.attending_status}</td>
                                                <td className="action-buttons">
                                                    <button 
                                                        onClick={() => handleDeleteResponse(guest.guest_id)}
                                                        className="delete-button"
                                                    >
                                                        Delete Response
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteGuest(guest.guest_id)}
                                                        className="remove-button"
                                                    >
                                                        Remove from DB
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AdminView; 