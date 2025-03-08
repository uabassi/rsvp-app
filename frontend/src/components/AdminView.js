import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';
import './AdminView.css';

function AdminView() {
    const [eventTotals, setEventTotals] = useState([]);
    const [guestList, setGuestList] = useState([]);

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

    const handleDelete = async (guestId) => {
        if (window.confirm('Are you sure you want to delete this response?')) {
            try {
                console.log('Deleting guest:', guestId);
                await axios.delete(`${config.apiUrl}/api/rsvp/${guestId}`);
                // Refresh the data after successful deletion
                fetchData();
            } catch (error) {
                console.error('Error deleting response:', error);
                alert('Failed to delete response');
            }
        }
    };

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
                <a href="/" className="home-link">← Back to Home</a>
                <button onClick={fetchData} className="refresh-button">
                    Refresh Data
                </button>
            </div>

            <div className="admin-section">
                <h2>Event Totals</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Date</th>
                            <th>Adults</th>
                            <th>Children</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {eventTotals.map(event => (
                            <tr key={event.event_id}>
                                <td>{event.event_name}</td>
                                <td>{event.event_date}</td>
                                <td>{event.total_adults}</td>
                                <td>{event.total_children}</td>
                                <td>{event.total_attendees}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="admin-section">
                <h2>Guest List by Event</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Guest</th>
                            <th>Status</th>
                            <th>Adults</th>
                            <th>Children</th>
                            <th>Children's Comments</th>
                            <th>Comments</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {guestList.map((guest, index) => (
                            <tr key={index}>
                                <td>{guest.event_name}</td>
                                <td>{guest.guest_name}</td>
                                <td>{guest.attending_status}</td>
                                <td>{guest.adult_count}</td>
                                <td>{guest.children_count}</td>
                                <td>{guest.children_details}</td>
                                <td>{guest.comments}</td>
                                <td>
                                    <button 
                                        onClick={() => handleDelete(guest.guest_id)}
                                        className="delete-button"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AdminView; 