require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const { parse } = require('csv-parse');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Function to set up all database tables and initial test data
async function initializeDatabase() {
    try {
        // First drop everything
        await pool.query(`
            DROP VIEW IF EXISTS formatted_rsvp_responses CASCADE;
            DROP VIEW IF EXISTS event_totals CASCADE;
            DROP VIEW IF EXISTS event_guest_list CASCADE;
            DROP TABLE IF EXISTS rsvp_responses CASCADE;
            DROP TABLE IF EXISTS guest_events CASCADE;
            DROP TABLE IF EXISTS events CASCADE;
            DROP TABLE IF EXISTS guests CASCADE;
            DROP TABLE IF EXISTS families CASCADE;
        `);

        // Create tables one by one
        await pool.query(`
            CREATE TABLE families (
                id SERIAL PRIMARY KEY,
                rsvp_code TEXT UNIQUE NOT NULL,
                has_children BOOLEAN DEFAULT false,
                has_spouse BOOLEAN DEFAULT false
            );
        `);

        await pool.query(`
            CREATE TABLE guests (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                family_id INTEGER REFERENCES families(id)
            );
        `);

        await pool.query(`
            CREATE TABLE events (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT
            );
        `);

        await pool.query(`
            CREATE TABLE guest_events (
                guest_id INTEGER REFERENCES guests(id),
                event_id INTEGER REFERENCES events(id),
                children_invited BOOLEAN DEFAULT false,
                PRIMARY KEY (guest_id, event_id)
            );
        `);

        await pool.query(`
            CREATE TABLE rsvp_responses (
                id SERIAL PRIMARY KEY,
                guest_id INTEGER REFERENCES guests(id),
                event_id INTEGER REFERENCES events(id),
                attending BOOLEAN,
                children_attending BOOLEAN,
                number_of_children INTEGER,
                children_comments TEXT,
                comment TEXT
            );
        `);

        // Insert initial events
        await pool.query(`
            INSERT INTO events (name, date) VALUES 
                ('Nikkah', '2025-06-13'),
                ('Mehndi', '2025-06-19'),
                ('Baraat', '2025-06-21'),
                ('Valima', '2025-06-22')
            ON CONFLICT DO NOTHING;
        `);

        // Create views one by one
        await pool.query(`
            CREATE VIEW formatted_rsvp_responses AS
            SELECT 
                r.id,
                g.name as guest_name,
                e.name as event_name,
                CASE 
                    WHEN r.attending THEN 'Yes'
                    WHEN NOT r.attending THEN 'No'
                    ELSE 'Unknown'
                END as attending,
                CASE 
                    WHEN r.children_attending THEN 'Yes'
                    WHEN NOT r.children_attending THEN 'No'
                    ELSE 'N/A'
                END as children_attending,
                COALESCE(r.number_of_children, 0) as number_of_children,
                COALESCE(r.children_comments, '') as children_comments,
                COALESCE(r.comment, '') as comment
            FROM rsvp_responses r
            JOIN guests g ON r.guest_id = g.id
            JOIN events e ON r.event_id = e.id
            ORDER BY r.id;
        `);

        await pool.query(`
            CREATE VIEW event_totals AS
            SELECT 
                e.id as event_id,
                e.name as event_name,
                e.date as event_date,
                COALESCE((
                    SELECT COUNT(DISTINCT g2.id) + 
                    SUM(CASE WHEN f2.has_spouse THEN 1 ELSE 0 END)
                    FROM guests g2
                    JOIN families f2 ON g2.family_id = f2.id
                    JOIN guest_events ge2 ON g2.id = ge2.guest_id
                    LEFT JOIN rsvp_responses r2 ON g2.id = r2.guest_id AND e.id = r2.event_id
                    WHERE ge2.event_id = e.id AND r2.attending = true
                ), 0) as total_adults,
                COALESCE((
                    SELECT SUM(
                        CASE 
                            WHEN r3.children_attending THEN COALESCE(r3.number_of_children, 0)
                            ELSE 0 
                        END
                    )
                    FROM rsvp_responses r3
                    WHERE r3.event_id = e.id AND r3.attending = true
                ), 0) as total_children,
                COALESCE((
                    SELECT 
                        (COUNT(DISTINCT g2.id) + 
                        SUM(CASE WHEN f2.has_spouse THEN 1 ELSE 0 END)) +
                        SUM(
                            CASE 
                                WHEN r2.children_attending THEN COALESCE(r2.number_of_children, 0)
                                ELSE 0 
                            END
                        )
                    FROM guests g2
                    JOIN families f2 ON g2.family_id = f2.id
                    JOIN guest_events ge2 ON g2.id = ge2.guest_id
                    LEFT JOIN rsvp_responses r2 ON g2.id = r2.guest_id AND e.id = r2.event_id
                    WHERE ge2.event_id = e.id AND r2.attending = true
                ), 0) as total_attendees
            FROM events e;
        `);

        // Create the event_guest_list view last
        await pool.query(`
            CREATE VIEW event_guest_list AS
            SELECT 
                e.name as event_name,
                g.name as guest_name,
                f.rsvp_code,
                f.has_spouse,
                f.has_children,
                CASE 
                    WHEN r.attending IS NULL THEN 'Pending'
                    WHEN r.attending THEN 'Yes'
                    ELSE 'No'
                END as attending_status,
                CASE 
                    WHEN f.has_spouse AND r.attending THEN 2
                    WHEN r.attending THEN 1
                    ELSE 0
                END as adult_count,
                COALESCE(r.number_of_children, 0) as children_count,
                COALESCE(r.children_comments, '') as children_details,
                COALESCE(r.comment, '') as comments
            FROM events e
            JOIN guest_events ge ON e.id = ge.event_id
            JOIN guests g ON ge.guest_id = g.id
            JOIN families f ON g.family_id = f.id
            LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
            ORDER BY e.date, g.name;
        `);

    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
}

// Function to get formatted RSVP responses
function getFormattedRsvpResponses() {
    return new Promise((resolve, reject) => {
        pool.query(`
            SELECT 
                r.id,
                g.name as guest_name,
                e.name as event_name,
                CASE 
                    WHEN r.attending = 1 THEN 'Yes'
                    WHEN r.attending = 0 THEN 'No'
                    ELSE 'Unknown'
                END as attending,
                CASE 
                    WHEN r.children_attending = 1 THEN 'Yes'
                    WHEN r.children_attending = 0 THEN 'No'
                    ELSE 'N/A'
                END as children_attending,
                COALESCE(r.number_of_children, 0) as number_of_children,
                COALESCE(r.children_comments, '') as children_comments,
                COALESCE(r.comment, '') as comment
            FROM rsvp_responses r
            JOIN guests g ON r.guest_id = g.id
            JOIN events e ON r.event_id = e.id
            ORDER BY r.id;
        `, [], (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.rows);
            }
        });
    });
}

// Update the importGuestsFromCSV function
async function importGuestsFromCSV(filePath) {
    const results = [];
    
    // Read CSV file
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(parse({ columns: true, trim: true }))
            .on('data', (data) => results.push(data))
            .on('end', resolve)
            .on('error', reject);
    });

    // Process each row
    for (const row of results) {
        try {
            // Start transaction
            await pool.query('BEGIN');

            // Insert or update family
            const familyResult = await pool.query(
                `INSERT INTO families (rsvp_code, has_children, has_spouse)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (rsvp_code) DO UPDATE 
                 SET has_children = $2, has_spouse = $3
                 RETURNING id`,
                [
                    row.rsvp_code, 
                    row.has_children === '1', 
                    row.has_spouse === '1'
                ]
            );

            // Insert guest
            const guestResult = await pool.query(
                `INSERT INTO guests (name, family_id)
                 VALUES ($1, $2)
                 RETURNING id`,
                [row.name, familyResult.rows[0].id]
            );

            // Handle events
            const events = row.invited_events.split(',').map(e => e.trim());
            const children_events = (row.children_invited_events || '').split(',').map(e => e.trim());

            // Delete existing guest_events entries
            await pool.query(
                'DELETE FROM guest_events WHERE guest_id = $1',
                [guestResult.rows[0].id]
            );

            // Insert event associations
            for (const eventName of events) {
                if (eventName) {  // Skip empty event names
                    await pool.query(
                        `INSERT INTO guest_events (guest_id, event_id, children_invited)
                         SELECT $1, id, $2 FROM events WHERE name = $3`,
                        [
                            guestResult.rows[0].id,
                            children_events.includes(eventName),
                            eventName
                        ]
                    );
                }
            }

            // Commit transaction
            await pool.query('COMMIT');
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('Error processing row:', row, error);
            throw error;
        }
    }
}

// Export the database connection, initialization function, and the new function
module.exports = { 
    pool, 
    initializeDatabase,
    getFormattedRsvpResponses,
    importGuestsFromCSV
}; 