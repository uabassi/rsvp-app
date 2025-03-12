require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { pool, initializeDatabase, getFormattedRsvpResponses, importGuestsFromCSV } = require('./database');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const port = 3001;

// Add this line before other middleware
app.set('trust proxy', 1);

// Enable CORS to allow requests from frontend
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://mkua25.netlify.app', 'https://mkua25.com', 'http://localhost:3000']
        : 'http://localhost:3000',
    credentials: true
}));
// Parse JSON request bodies
app.use(express.json());

// Add security middleware
app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);

// Modified login endpoint to include family information
app.post('/api/login', async (req, res) => {
    const { rsvpCode } = req.body;
    
    try {
        // Get the family and its members
        const familyResult = await pool.query(
            `SELECT 
                f.id as family_id,
                f.family_name,
                f.rsvp_code,
                f.family_members,
                json_agg(
                    json_build_object(
                        'guest_id', g.id,
                        'name', g.name,
                        'events', (
                            SELECT json_agg(
                                json_build_object(
                                    'id', e.id,
                                    'name', e.name,
                                    'date', e.date
                                )
                            )
                            FROM guest_events ge
                            JOIN events e ON ge.event_id = e.id
                            WHERE ge.guest_id = g.id
                        )
                    )
                ) as family_guests
            FROM families f
            JOIN guests g ON f.id = g.family_id
            WHERE f.rsvp_code = $1
            GROUP BY f.id, f.family_name, f.rsvp_code, f.family_members`,
            [rsvpCode]
        );

        if (familyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid RSVP code' });
        }

        // Format the response
        const response = {
            ...familyResult.rows[0],
            family_guests: familyResult.rows[0].family_guests.map(guest => ({
                ...guest,
                events: guest.events || []
            }))
        };

        res.json(response);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Modified RSVP endpoint
app.post('/api/rsvp', async (req, res) => {
    const { responses } = req.body;
    
    try {
        // Validate input
        if (!responses || !Array.isArray(responses)) {
            console.error('Invalid request body:', req.body);
            return res.status(400).json({ error: 'Invalid request format' });
        }

        console.log('Received RSVP responses:', responses);
        
        await pool.query('BEGIN');

        // Insert new responses
        for (const response of responses) {
            if (!response.guest_id || !response.event_id || response.attending === undefined) {
                console.error('Invalid response object:', response);
                throw new Error('Invalid response data');
            }

            console.log('Processing response:', {
                guest_id: response.guest_id,
                event_id: response.event_id,
                attending: response.attending
            });
            
            const result = await pool.query(
                `INSERT INTO rsvp_responses (guest_id, event_id, attending)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (guest_id, event_id) 
                 DO UPDATE SET attending = $3
                 RETURNING id`,
                [
                    response.guest_id,
                    response.event_id,
                    response.attending
                ]
            );
            
            console.log('Response saved with ID:', result.rows[0].id);
        }

        await pool.query('COMMIT');
        console.log('All responses saved successfully');
        res.json({ message: 'RSVP updated successfully' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error saving RSVP:', err);
        console.error('Stack trace:', err.stack);
        res.status(500).json({ 
            error: 'Error saving RSVP responses',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
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
        
        console.log('Starting CSV import...');
        console.log('File path:', req.file.path);
        
        try {
            await importGuestsFromCSV(req.file.path);
            console.log('CSV import completed successfully');
            
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            
            res.json({ message: 'Guest list imported successfully' });
        } catch (importErr) {
            console.error('Error during CSV import:', importErr);
            res.status(500).json({ 
                error: 'Error importing guest list',
                details: importErr.message 
            });
        }
    } catch (err) {
        console.error('Error in upload endpoint:', err);
        res.status(500).json({ 
            error: 'Error processing upload',
            details: err.message 
        });
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

// Update the event-guest-list endpoint
app.get('/api/event-guest-list', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                g.id as guest_id,
                g.name as guest_name,
                f.id as family_id,
                f.family_name,
                f.rsvp_code,
                e.name as event_name,
                e.date as event_date,
                CASE 
                    WHEN r.attending IS NULL THEN 'Pending'
                    WHEN r.attending THEN 'Will Attend'
                    ELSE 'Cannot Attend'
                END as attending_status
            FROM guests g
            JOIN families f ON g.family_id = f.id
            LEFT JOIN guest_events ge ON g.id = ge.guest_id
            LEFT JOIN events e ON ge.event_id = e.id
            LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
            WHERE g.name != '' 
            AND f.family_name != ''
            AND f.rsvp_code != ''
            ORDER BY f.family_name, g.name, e.date
        `);
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

// Add this debugging endpoint
app.get('/api/debug-tables', async (req, res) => {
    try {
        const families = await pool.query('SELECT * FROM families');
        const guests = await pool.query('SELECT * FROM guests');
        const events = await pool.query('SELECT * FROM events');
        const guestEvents = await pool.query('SELECT * FROM guest_events');
        
            res.json({ 
            families: families.rows,
            guests: guests.rows,
            events: events.rows,
            guestEvents: guestEvents.rows
        });
    } catch (err) {
        console.error('Error getting debug data:', err);
        res.status(500).json({ error: 'Error getting debug data' });
    }
});

// Update the delete endpoint to only remove RSVP responses
app.delete('/api/rsvp/:guestId', async (req, res) => {
    try {
        const { guestId } = req.params;
        
        await pool.query('BEGIN');
        
        // Delete RSVP responses for this guest
        await pool.query(
            'DELETE FROM rsvp_responses WHERE guest_id = $1',
            [guestId]
        );
        
        await pool.query('COMMIT');
        
        res.json({ message: 'RSVP responses deleted successfully' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error deleting responses:', err);
        res.status(500).json({ error: 'Error deleting RSVP responses' });
    }
});

// Add this new endpoint for completely removing a guest and their family
app.delete('/api/guest/:guestId', async (req, res) => {
    try {
        const { guestId } = req.params;
        
        await pool.query('BEGIN');
        
        // Get the family_id and check if this is the only guest in the family
        const familyResult = await pool.query(
            `SELECT g.family_id, 
                    (SELECT COUNT(*) FROM guests WHERE family_id = g.family_id) as family_size
             FROM guests g 
             WHERE g.id = $1`,
            [guestId]
        );
        
        if (familyResult.rows.length === 0) {
            throw new Error('Guest not found');
        }
        
        const { family_id, family_size } = familyResult.rows[0];
        
        // Delete in correct order to handle foreign key constraints
        await pool.query('DELETE FROM rsvp_responses WHERE guest_id = $1', [guestId]);
        await pool.query('DELETE FROM guest_events WHERE guest_id = $1', [guestId]);
        await pool.query('DELETE FROM guests WHERE id = $1', [guestId]);
        
        // If this was the last guest in the family, delete the family too
        if (family_size <= 1) {
            await pool.query('DELETE FROM families WHERE id = $1', [family_id]);
        }
        
        await pool.query('COMMIT');
        
        res.json({ 
            message: 'Guest removed from database successfully',
            familyDeleted: family_size <= 1
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error removing guest:', err);
        res.status(500).json({ 
            error: 'Error removing guest from database',
            details: err.message 
        });
    }
});

// Add new endpoint for deleting an entire family
app.delete('/api/family/:familyId', async (req, res) => {
    try {
        const { familyId } = req.params;
        
        await pool.query('BEGIN');
        
        // Get all guests in this family
        const guestsResult = await pool.query(
            'SELECT id FROM guests WHERE family_id = $1',
            [familyId]
        );
        
        // Delete all related data for each guest
        for (const guest of guestsResult.rows) {
            await pool.query('DELETE FROM rsvp_responses WHERE guest_id = $1', [guest.id]);
            await pool.query('DELETE FROM guest_events WHERE guest_id = $1', [guest.id]);
        }
        
        // Delete all guests in the family
        await pool.query('DELETE FROM guests WHERE family_id = $1', [familyId]);
        
        // Finally delete the family
        await pool.query('DELETE FROM families WHERE id = $1', [familyId]);
        
        await pool.query('COMMIT');
        
        res.json({ message: 'Family and all related data deleted successfully' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error deleting family:', err);
        res.status(500).json({ 
            error: 'Error deleting family',
            details: err.message 
        });
    }
});

// Add at the top after imports
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Update pool error handling
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
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

app.use(compression());

// Add at the end before app.listen
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message 
    });
}); 