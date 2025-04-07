import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';
import './AdminView.css';

function AdminView() {
    const [eventTotals, setEventTotals] = useState([]);
    const [guestList, setGuestList] = useState([]);
    const [expandedFamilies, setExpandedFamilies] = useState(new Set());
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [clearPassword, setClearPassword] = useState('');
    const [clearError, setClearError] = useState('');
    const [linkCopied, setLinkCopied] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'responded', 'pending'
    const [uploadStatus, setUploadStatus] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'

    const formatDate = (dateString) => {
        if (!dateString) return '';
        
        // Split the date string into components
        const [month, day, year] = dateString.split('-');
        
        // Create a formatted date string
        return `${month}/${day}/${year}`;
    };

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
                await fetchData();
            } catch (error) {
                console.error('Error deleting response:', error);
                alert('Failed to delete response: ' + error.response?.data?.error || error.message);
            }
        }
    };

    const handleDeleteGuest = async (guestId) => {
        if (window.confirm('WARNING: This will completely remove this guest from the database. They will not be able to RSVP without being re-added. Continue?')) {
            try {
                await axios.delete(`${config.apiUrl}/api/guest/${guestId}`);
                await fetchData();
            } catch (error) {
                console.error('Error deleting guest:', error);
                alert('Failed to delete guest: ' + error.response?.data?.error || error.message);
            }
        }
    };

    const handleDeleteFamily = async (familyId) => {
        if (window.confirm('WARNING: This will completely remove this entire family and all their members from the database. This cannot be undone. Continue?')) {
            try {
                await axios.delete(`${config.apiUrl}/api/family/${familyId}`);
                await fetchData();
            } catch (error) {
                console.error('Error deleting family:', error);
                alert('Failed to delete family: ' + error.response?.data?.error || error.message);
            }
        }
    };

    const handleClearDatabase = async () => {
        if (clearPassword !== 'delete') {
            setClearError('Incorrect password');
            return;
        }

        try {
            // Delete all families (this will cascade delete all guests and their responses)
            const families = Object.values(groupedGuests);
            for (const family of families) {
                await axios.delete(`${config.apiUrl}/api/family/${family.familyId}`);
            }
            
            alert('Database cleared successfully. Please upload a new CSV file to add guests.');
            setClearPassword('');
            setShowClearDialog(false);
            fetchData();
        } catch (error) {
            console.error('Error clearing database:', error);
            alert('Failed to clear database: ' + error.response?.data?.error || error.message);
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

    // Group guests by family name AND rsvp code
    const groupedGuests = guestList.reduce((acc, guest) => {
        // Create a unique key combining family name and RSVP code
        const familyKey = `${guest.family_name} (${guest.rsvp_code})`;
        
        if (!acc[familyKey]) {
            acc[familyKey] = {
                guests: [],
                familyId: guest.family_id,
                rsvpCode: guest.rsvp_code
            };
        }
        acc[familyKey].guests.push(guest);
        return acc;
    }, {});

    // Group families by response status
    const getFamilyGroups = () => {
        const families = {};
        const responded = new Set();
        const pending = new Set();

        // First pass: identify which families have any responses
        guestList.forEach(guest => {
            const familyKey = `${guest.family_name} (${guest.rsvp_code})`;
            if (!families[familyKey]) {
                families[familyKey] = {
                    hasResponse: false,
                    guests: [],
                    familyId: guest.family_id,
                    rsvpCode: guest.rsvp_code,
                    totalGuests: 0,
                    respondedGuests: 0
                };
            }
            
            families[familyKey].totalGuests++;
            if (guest.attending_status !== 'Pending') {
                families[familyKey].hasResponse = true;
                families[familyKey].respondedGuests++;
            }
        });

        // Second pass: categorize families
        Object.entries(families).forEach(([familyKey, family]) => {
            if (family.hasResponse) {
                responded.add(familyKey);
            } else {
                pending.add(familyKey);
            }
        });

        return { families, responded, pending };
    };

    const { families, responded, pending } = getFamilyGroups();

    // Filter families based on active tab
    const getFilteredFamilies = () => {
        let filteredEntries;
        switch (activeTab) {
            case 'responded':
                filteredEntries = Object.entries(groupedGuests)
                    .filter(([familyKey]) => responded.has(familyKey));
                
                // Sort by most recent RSVP timestamp if on responded tab
                if (sortOrder) {
                    filteredEntries.sort(([, familyA], [, familyB]) => {
                        // Find the most recent RSVP timestamp for each family
                        const latestA = Math.max(...familyA.guests
                            .filter(g => g.attending_status !== 'Pending')
                            .map(g => g.rsvp_timestamp ? new Date(g.rsvp_timestamp).getTime() : 0));
                        const latestB = Math.max(...familyB.guests
                            .filter(g => g.attending_status !== 'Pending')
                            .map(g => g.rsvp_timestamp ? new Date(g.rsvp_timestamp).getTime() : 0));
                        
                        return sortOrder === 'newest' ? latestB - latestA : latestA - latestB;
                    });
                }
                return filteredEntries;
            case 'pending':
                return Object.entries(groupedGuests)
                    .filter(([familyKey]) => pending.has(familyKey));
            default:
                return Object.entries(groupedGuests);
        }
    };

    const handleCopyLink = (rsvpCode) => {
        const baseUrl = window.location.origin;
        const rsvpLink = `${baseUrl}/?code=${rsvpCode}`;
        
        navigator.clipboard.writeText(rsvpLink).then(() => {
            setLinkCopied(rsvpCode);
            setTimeout(() => setLinkCopied(''), 2000); // Reset after 2 seconds
        });
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Check if it's a CSV file
        if (!file.name.endsWith('.csv')) {
            setUploadStatus('Please upload a CSV file');
            return;
        }

        setIsUploading(true);
        setUploadStatus('Uploading...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`${config.apiUrl}/api/upload-guests`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setUploadStatus('Upload successful! New guests have been added.');
            fetchData(); // Refresh the data
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus(error.response?.data?.error || 'Error uploading file');
        } finally {
            setIsUploading(false);
            // Clear the file input
            event.target.value = '';
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
                <div className="admin-controls">
                    <a href="/" className="home-link">← Back to Home</a>
                    <button onClick={fetchData} className="refresh-button">
                        Refresh Data
                    </button>
                    <div className="upload-section">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            id="csv-upload"
                            className="file-input"
                            disabled={isUploading}
                        />
                        <label htmlFor="csv-upload" className="upload-button">
                            {isUploading ? 'Uploading...' : 'Upload Guest List'}
                        </label>
                        {uploadStatus && (
                            <div className={`upload-status ${uploadStatus.includes('successful') ? 'success' : 'error'}`}>
                                {uploadStatus}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => setShowClearDialog(true)} 
                        className="clear-button"
                    >
                        Clear Database
                    </button>
                </div>
            </div>

            {showClearDialog && (
                <div className="clear-dialog">
                    <div className="clear-dialog-content">
                        <h3>Clear Database</h3>
                        <p>This will delete all guests and their RSVP responses. This action cannot be undone.</p>
                        <div className="clear-form">
                            <input
                                type="password"
                                placeholder="Enter password to confirm"
                                value={clearPassword}
                                onChange={(e) => setClearPassword(e.target.value)}
                            />
                            {clearError && <div className="clear-error">{clearError}</div>}
                            <div className="clear-buttons">
                                <button onClick={handleClearDatabase} className="confirm-clear">
                                    Clear Database
                                </button>
                                <button 
                                    onClick={() => {
                                        setShowClearDialog(false);
                                        setClearPassword('');
                                        setClearError('');
                                    }} 
                                    className="cancel-clear"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add RSVP Status Overview */}
            <div className="admin-section">
                <h2>RSVP Status Overview</h2>
                <div className="status-cards">
                    <div className="status-card">
                        <h3>Total Families</h3>
                        <p className="status-number">{Object.keys(families).length}</p>
                    </div>
                    <div className="status-card responded">
                        <h3>Responded</h3>
                        <p className="status-number">{responded.size}</p>
                    </div>
                    <div className="status-card pending">
                        <h3>Pending</h3>
                        <p className="status-number">{pending.size}</p>
                    </div>
                </div>
            </div>

            {/* Add filter tabs */}
            <div className="admin-section">
                <div className="filter-tabs">
                    <button 
                        className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Families ({Object.keys(families).length})
                    </button>
                    <button 
                        className={`filter-tab ${activeTab === 'responded' ? 'active' : ''}`}
                        onClick={() => setActiveTab('responded')}
                    >
                        Responded ({responded.size})
                    </button>
                    <button 
                        className={`filter-tab ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        Pending ({pending.size})
                    </button>
                </div>

                {activeTab === 'responded' && (
                    <div className="sort-controls">
                        <label>Sort by: </label>
                        <select 
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="sort-select"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                    </div>
                )}

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
                                    <td>{formatDate(event.event_date)}</td>
                                    <td>{event.total_attendees}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="admin-section">
                    <h2>Guest List by Family</h2>
                    <div className="family-list">
                        {getFilteredFamilies().map(([familyKey, familyData]) => (
                            <div key={familyKey} className="family-section">
                                <div className="family-header">
                                    <div className="family-title" onClick={() => toggleFamily(familyKey)}>
                                        <h3>{familyKey}</h3>
                                        <span className="response-status">
                                            {responded.has(familyKey) ? (
                                                <span className="status responded">
                                                    {families[familyKey].respondedGuests}/{families[familyKey].totalGuests} Responded
                                                </span>
                                            ) : (
                                                <span className="status pending">Pending</span>
                                            )}
                                        </span>
                                        <span className="expand-icon">
                                            {expandedFamilies.has(familyKey) ? '▼' : '▶'}
                                        </span>
                                    </div>
                                    <div className="family-actions">
                                        <button 
                                            onClick={() => handleCopyLink(familyData.rsvpCode)}
                                            className="copy-link-button"
                                        >
                                            {linkCopied === familyData.rsvpCode ? 'Copied!' : 'Copy RSVP Link'}
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteFamily(familyData.familyId)}
                                            className="delete-family-button"
                                        >
                                            Delete Family
                                        </button>
                                    </div>
                                </div>
                                {expandedFamilies.has(familyKey) && (
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
                                            {familyData.guests.map((guest, index) => (
                                                <tr key={`${guest.guest_id}-${index}`}>
                                                    <td>{guest.guest_name}</td>
                                                    <td>{guest.event_name} ({formatDate(guest.event_date)})</td>
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
                                                            Remove Guest
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
        </div>
    );
}

export default AdminView; 