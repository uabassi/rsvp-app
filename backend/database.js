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
        // First check if tables exist
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'families'
            );
        `);

        // If tables already exist, don't recreate them
        if (tableExists.rows[0].exists) {
            console.log('Database tables already exist, skipping initialization');
            return;
        }

        console.log('Initializing database for first time...');

        // Create tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS families (
                id SERIAL PRIMARY KEY,
                family_name TEXT NOT NULL,
                rsvp_code TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS guests (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                family_id INTEGER REFERENCES families(id)
            );

            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT
            );

            CREATE TABLE IF NOT EXISTS guest_events (
                guest_id INTEGER REFERENCES guests(id),
                event_id INTEGER REFERENCES events(id),
                PRIMARY KEY (guest_id, event_id)
            );

            CREATE TABLE IF NOT EXISTS rsvp_responses (
                id SERIAL PRIMARY KEY,
                guest_id INTEGER REFERENCES guests(id),
                event_id INTEGER REFERENCES events(id),
                attending BOOLEAN,
                UNIQUE(guest_id, event_id)
            );
        `);

        // Check if events table is empty before inserting initial events
        const eventsExist = await pool.query('SELECT COUNT(*) FROM events');
        if (parseInt(eventsExist.rows[0].count) === 0) {
            // Insert events only if none exist
            await pool.query(`
                INSERT INTO events (name, date) VALUES 
                    ('Nikkah', '06-13-2025'),
                    ('Mehndi', '06-19-2025'),
                    ('Baraat', '06-20-2025'),
                    ('Walima', '06-22-2025')
                ON CONFLICT DO NOTHING;
            `);
        }

        // Create or replace views
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
            CREATE OR REPLACE VIEW formatted_rsvp_responses AS
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
            CREATE OR REPLACE VIEW event_totals AS
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

        console.log('Database initialized successfully');
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

// Update the importGuestsFromCSV function to preserve existing data and only add new entries
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
                    delimiter: content.includes('\t') ? '\t' : ',',
                    quote: '"',
                    relax_quotes: true
                }, (err, records) => {
                    if (err) reject(err);
                    else resolve(records);
                });
            });
        };

        const records = await parseAsync(fileContent);
        console.log('CSV parsed successfully, found records:', records.length);
        
        await pool.query('BEGIN');
        
        // Get existing families and their RSVP codes
        const existingFamiliesResult = await pool.query(
            'SELECT id, family_name, rsvp_code FROM families'
        );
        const existingFamilies = new Map(
            existingFamiliesResult.rows.map(f => [f.rsvp_code, f])
        );

        // Get existing guests
        const existingGuestsResult = await pool.query(
            'SELECT id, name, family_id FROM guests'
        );
        const existingGuests = new Map(
            existingGuestsResult.rows.map(g => [`${g.name}-${g.family_id}`, g])
        );
        
        // Get existing events mapping
        const eventsResult = await pool.query('SELECT id, name FROM events');
        const eventMap = {};
        eventsResult.rows.forEach(event => {
            const normalizedName = event.name.toLowerCase().trim();
            eventMap[normalizedName] = event.id;
        });

        // Process each record
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
            
            // Check if family already exists
            const existingFamily = existingFamilies.get(cleanRecord.rsvp_code);
            if (existingFamily) {
                familyId = existingFamily.id;
                console.log(`Family with RSVP code ${cleanRecord.rsvp_code} already exists, using existing family`);
            } else {
                // Create new family
                const familyResult = await pool.query(
                    `INSERT INTO families (family_name, rsvp_code)
                     VALUES ($1, $2)
                     RETURNING id`,
                    [cleanRecord.family_name, cleanRecord.rsvp_code]
                );
                familyId = familyResult.rows[0].id;
                existingFamilies.set(cleanRecord.rsvp_code, { 
                    id: familyId, 
                    family_name: cleanRecord.family_name, 
                    rsvp_code: cleanRecord.rsvp_code 
                });
                console.log(`Created new family with RSVP code ${cleanRecord.rsvp_code}`);
            }
            
            // Check if guest already exists in this family
            const guestKey = `${cleanRecord.member_name}-${familyId}`;
            const existingGuest = existingGuests.get(guestKey);
            
            let guestId;
            if (existingGuest) {
                guestId = existingGuest.id;
                console.log(`Guest ${cleanRecord.member_name} already exists in family, skipping guest creation`);
            } else {
                // Create new guest
                const guestResult = await pool.query(
                    `INSERT INTO guests (name, family_id)
                     VALUES ($1, $2)
                     RETURNING id`,
                    [cleanRecord.member_name, familyId]
                );
                guestId = guestResult.rows[0].id;
                existingGuests.set(guestKey, { 
                    id: guestId, 
                    name: cleanRecord.member_name, 
                    family_id: familyId 
                });
                console.log(`Created new guest ${cleanRecord.member_name}`);
            }
            
            // Process events for this guest
            if (cleanRecord.invited_events) {
                const invitedEvents = [...new Set(
                    cleanRecord.invited_events
                        .split(',')
                        .map(e => e.trim())
                        .filter(e => e)
                )];
                
                // Get existing event assignments for this guest
                const existingEventsResult = await pool.query(
                    'SELECT event_id FROM guest_events WHERE guest_id = $1',
                    [guestId]
                );
                const existingEventIds = new Set(existingEventsResult.rows.map(e => e.event_id));
                
                for (const eventName of invitedEvents) {
                    const normalizedEventName = eventName.toLowerCase().trim();
                    const eventId = eventMap[normalizedEventName];
                    
                    if (eventId && !existingEventIds.has(eventId)) {
                        await pool.query(
                            `INSERT INTO guest_events (guest_id, event_id)
                             VALUES ($1, $2)
                             ON CONFLICT (guest_id, event_id) DO NOTHING`,
                            [guestId, eventId]
                        );
                        console.log(`Added event ${eventName} for guest ${cleanRecord.member_name}`);
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