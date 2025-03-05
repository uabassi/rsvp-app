require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { pool, initializeDatabase, getFormattedRsvpResponses, importGuestsFromCSV } = require('./database');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');

const app = express();
const port = 3001;

// Enable CORS to allow requests from frontend (running on different port)
app.use(cors());
// Parse JSON request bodies
app.use(express.json());

// Modified login endpoint to include family information
app.post('/api/login', async (req, res) => {
    const { rsvpCode } = req.body;
    
    try {
        const result = await pool.query(
            `SELECT 
                f.id as family_id, 
                f.rsvp_code, 
                f.has_children,
                f.has_spouse,
                g.id as guest_id, 
                g.name,
                json_agg(
                    json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'date', e.date,
                        'children_invited', ge.children_invited
                    )
                ) as events
             FROM families f 
             JOIN guests g ON f.id = g.family_id 
             JOIN guest_events ge ON g.id = ge.guest_id
             JOIN events e ON ge.event_id = e.id
             WHERE f.rsvp_code = $1
             GROUP BY f.id, g.id`,
            [rsvpCode]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Invalid RSVP code' });
            return;
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Modified RSVP endpoint
app.post('/api/rsvp', async (req, res) => {
    const { guestId, responses } = req.body;
    
    try {
        await pool.query('BEGIN');

        // Delete existing responses
        await pool.query(
            'DELETE FROM rsvp_responses WHERE guest_id = $1',
            [guestId]
        );

        // Insert new responses
        for (const response of responses) {
            await pool.query(
                `INSERT INTO rsvp_responses (
                    guest_id, 
                    event_id, 
                    attending, 
                    children_attending,
                    number_of_children,
                    children_comments,
                    comment
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    guestId,
                    response.event_id,
                    response.attending,
                    response.children_attending,
                    response.number_of_children,
                    response.children_comments,
                    response.comment
                ]
            );
        }

        await pool.query('COMMIT');
        res.json({ message: 'RSVP updated successfully' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error saving RSVP:', err);
        res.status(500).json({ error: 'Error saving RSVP responses' });
    }
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

// Add this endpoint for CSV upload
app.post('/api/upload-guests', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        await importGuestsFromCSV(req.file.path);
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({ message: 'Guest list imported successfully' });
    } catch (err) {
        console.error('Error importing guests:', err);
        res.status(500).json({ error: 'Error importing guest list' });
    }
});

// Update event totals endpoint
app.get('/api/event-totals', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM event_totals ORDER BY event_date`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching event totals:', err);
        res.status(500).json({ error: 'Error fetching event totals' });
    }
});

// Add this near your other endpoints
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            success: true, 
            message: 'Database connected successfully!',
            timestamp: result.rows[0].now
        });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database connection failed',
            error: err.message
        });
    }
});

// Get event totals
app.get('/api/event-totals', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM event_totals ORDER BY event_date');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching event totals:', err);
        res.status(500).json({ error: 'Error fetching event totals' });
    }
});

// Get guest list by event
app.get('/api/event-guest-list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM event_guest_list ORDER BY event_name, guest_name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching guest list:', err);
        res.status(500).json({ error: 'Error fetching guest list' });
    }
});

// Add this debugging endpoint
app.get('/api/debug-guest-list', async (req, res) => {
    try {
        // Get raw data from tables
        const guests = await pool.query('SELECT * FROM guests');
        const families = await pool.query('SELECT * FROM families');
        const events = await pool.query('SELECT * FROM events');
        const guestEvents = await pool.query('SELECT * FROM guest_events');
        const rsvpResponses = await pool.query('SELECT * FROM rsvp_responses');
        
        res.json({
            guests: guests.rows,
            families: families.rows,
            events: events.rows,
            guestEvents: guestEvents.rows,
            rsvpResponses: rsvpResponses.rows
        });
    } catch (err) {
        console.error('Error getting debug data:', err);
        res.status(500).json({ error: 'Error getting debug data' });
    }
});

// Update the initialization and server start
async function startServer() {
    try {
        // Wait for database initialization
        await initializeDatabase();
        console.log('Database initialized successfully');

        // Start the server after database is ready
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Call startServer instead of app.listen
startServer(); 