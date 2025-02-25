const express = require('express');
const cors = require('cors');
const { db, initializeDatabase, getFormattedRsvpResponses } = require('./database');

const app = express();
const port = 3001;

// Enable CORS to allow requests from frontend (running on different port)
app.use(cors());
// Parse JSON request bodies
app.use(express.json());

// Initialize database tables and test data
initializeDatabase();

// Modified login endpoint to include event information
app.post('/api/login', (req, res) => {
    const { rsvpCode } = req.body;
    
    db.get(
        `SELECT 
            f.id as family_id, 
            f.rsvp_code, 
            g.id as guest_id, 
            g.name,
            json_group_array(
                json_object(
                    'id', e.id,
                    'name', e.name,
                    'date', e.date
                )
            ) as events
         FROM families f 
         JOIN guests g ON f.id = g.family_id 
         JOIN guest_events ge ON g.id = ge.guest_id
         JOIN events e ON ge.event_id = e.id
         WHERE f.rsvp_code = ?
         GROUP BY g.id`,
        [rsvpCode],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!row) {
                res.status(404).json({ error: 'Invalid RSVP code' });
                return;
            }
            // Parse the events JSON string
            row.events = JSON.parse(row.events);
            res.json(row);
        }
    );
});

// Modified RSVP endpoint to handle multiple events
app.post('/api/rsvp', (req, res) => {
    const { guestId, responses } = req.body;
    
    // First delete any existing responses for this guest
    db.run('DELETE FROM rsvp_responses WHERE guest_id = ?', [guestId], (deleteErr) => {
        if (deleteErr) {
            console.error('Error deleting existing responses:', deleteErr);
            res.status(500).json({ error: 'Error updating RSVP responses' });
            return;
        }

        // Use Promise.all to handle all insertions
        Promise.all(
            responses.map(({ event_id, attending, comment }) => {
                return new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO rsvp_responses (guest_id, event_id, attending, comment)
                         VALUES (?, ?, ?, ?)`,
                        [guestId, event_id, attending, comment],
                        function(err) {
                            if (err) {
                                console.error('Error inserting response:', err);
                                reject(err);
                            } else {
                                resolve(this.lastID);
                            }
                        }
                    );
                });
            })
        )
        .then(() => {
            res.json({ message: 'RSVP submitted successfully' });
        })
        .catch(err => {
            console.error('Error in RSVP submission:', err);
            res.status(500).json({ error: 'Error saving RSVP responses' });
        });
    });
});

// Add this new endpoint
app.get('/api/rsvp-responses', async (req, res) => {
    try {
        const responses = await getFormattedRsvpResponses();
        res.json(responses);
    } catch (err) {
        console.error('Error fetching RSVP responses:', err);
        res.status(500).json({ error: 'Error fetching RSVP responses' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 