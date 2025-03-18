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

        // Create tables with updated schema - removed notes columns
        await pool.query(`
            CREATE TABLE families (
                id SERIAL PRIMARY KEY,
                family_name TEXT NOT NULL,
                rsvp_code TEXT UNIQUE NOT NULL
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
                PRIMARY KEY (guest_id, event_id)
            );
        `);

        await pool.query(`
            CREATE TABLE rsvp_responses (
                id SERIAL PRIMARY KEY,
                guest_id INTEGER REFERENCES guests(id),
                event_id INTEGER REFERENCES events(id),
                attending BOOLEAN,
                UNIQUE(guest_id, event_id)
            );
        `);

        // Insert events
        await pool.query(`
            INSERT INTO events (name, date) VALUES 
                ('Nikkah', '06-13-2025'),
                ('Mehndi', '06-19-2025'),
                ('Baraat', '06-21-2025'),
                ('Valima', '06-22-2025')
            ON CONFLICT DO NOTHING;
        `);

        // Create views
        await pool.query(`
            CREATE OR REPLACE VIEW event_guest_list AS
            SELECT 
                f.family_name,
                f.rsvp_code,
                g.name as guest_name,
                e.name as event_name,
                e.date as event_date,
                g.id as guest_id,
                CASE 
                    WHEN r.attending IS NULL THEN 'Pending'
                    WHEN r.attending THEN 'Yes'
                    ELSE 'No'
                END as attending_status
            FROM guests g
            JOIN families f ON g.family_id = f.id
            LEFT JOIN guest_events ge ON g.id = ge.guest_id
            LEFT JOIN events e ON ge.event_id = e.id
            LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
            WHERE ge.guest_id IS NOT NULL
            ORDER BY f.family_name, g.name, e.date;
        `);

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
                END as attending
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
                COUNT(DISTINCT CASE WHEN r.attending = true THEN g.id END) as total_attendees,
                COALESCE(string_agg(DISTINCT g.name, ', ' ORDER BY g.name) 
                    FILTER (WHERE r.attending = true), '') as attending_guests
            FROM events e
            LEFT JOIN guest_events ge ON e.id = ge.event_id
            LEFT JOIN guests g ON ge.guest_id = g.id
            LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
            GROUP BY e.id, e.name, e.date
            ORDER BY e.date;
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
                END as attending
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

// Update the importGuestsFromCSV function to remove notes
async function importGuestsFromCSV(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log('File content read successfully');
        
        const parseAsync = (content) => {
            return new Promise((resolve, reject) => {
                parse(content, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    relaxColumnCount: true,
                    delimiter: content.includes('\t') ? '\t' : ',', // Auto-detect delimiter
                    quote: '"', // Handle quoted fields
                    relax_quotes: true // Allow quotes to be optional
                }, (err, records) => {
                    if (err) reject(err);
                    else resolve(records);
                });
            });
        };

        const records = await parseAsync(fileContent);
        console.log('CSV parsed successfully, found records:', records.length);
        
        await pool.query('BEGIN');
        
        // Clear existing data
        await pool.query('DELETE FROM rsvp_responses');
        await pool.query('DELETE FROM guest_events');
        await pool.query('DELETE FROM guests');
        await pool.query('DELETE FROM families');
        
        // Get existing events mapping
        const eventsResult = await pool.query('SELECT id, name FROM events');
        const eventMap = {};
        eventsResult.rows.forEach(event => {
            const normalizedName = event.name.toLowerCase().trim();
            eventMap[normalizedName] = event.id;
        });

        // Track processed families
        const processedFamilies = new Map();

        for (const record of records) {
            // Clean up field values
            const cleanRecord = {
                family_name: record.family_name?.trim(),
                rsvp_code: record.rsvp_code?.trim(),
                member_name: record.member_name?.trim(),
                invited_events: record.invited_events?.trim()
            };

            // Validate required fields
            if (!cleanRecord.family_name || !cleanRecord.rsvp_code || !cleanRecord.member_name) {
                console.error('Missing required fields in record:', cleanRecord);
                continue;
            }

            let familyId;
            
            if (processedFamilies.has(cleanRecord.rsvp_code)) {
                familyId = processedFamilies.get(cleanRecord.rsvp_code);
            } else {
                const familyResult = await pool.query(
                    `INSERT INTO families (family_name, rsvp_code)
                     VALUES ($1, $2)
                     RETURNING id`,
                    [cleanRecord.family_name, cleanRecord.rsvp_code]
                );
                familyId = familyResult.rows[0].id;
                processedFamilies.set(cleanRecord.rsvp_code, familyId);
            }
            
            // Create guest
            const guestResult = await pool.query(
                `INSERT INTO guests (name, family_id)
                 VALUES ($1, $2)
                 RETURNING id`,
                [cleanRecord.member_name, familyId]
            );
            
            const guestId = guestResult.rows[0].id;
            
            // Process events
            if (cleanRecord.invited_events) {
                const invitedEvents = cleanRecord.invited_events.split(',').map(e => e.trim());
                
                for (const eventName of invitedEvents) {
                    const normalizedEventName = eventName.toLowerCase().trim();
                    const eventId = eventMap[normalizedEventName];
                    if (eventId) {
                        await pool.query(
                            `INSERT INTO guest_events (guest_id, event_id)
                             VALUES ($1, $2)`,
                            [guestId, eventId]
                        );
                    }
                }
            }
        }
        
        await pool.query('COMMIT');
        console.log('Import completed successfully');
    } catch (error) {
        console.error('Import error:', error);
        await pool.query('ROLLBACK');
        throw error;
    }
}

// Export the functions
module.exports = { 
    pool, 
    initializeDatabase,
    getFormattedRsvpResponses,
    importGuestsFromCSV
}; 