import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';
import './AdminView.css';

function AdminView() {
    const [eventTotals, setEventTotals] = useState([]);
    const [guestList, setGuestList] = useState([]);

    useEffect(() => {
        // Fetch event totals
        axios.get(`${config.apiUrl}/api/event-totals`)
            .then(response => setEventTotals(response.data))
            .catch(error => console.error('Error fetching totals:', error));

        // Fetch guest list
        axios.get(`${config.apiUrl}/api/event-guest-list`)
            .then(response => setGuestList(response.data))
            .catch(error => console.error('Error fetching guest list:', error));
    }, []);

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1>Wedding RSVP Admin</h1>
                <a href="/" className="home-link">← Back to Home</a>
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
                            <th>Comments</th>
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
                                <td>{guest.comments}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AdminView; 