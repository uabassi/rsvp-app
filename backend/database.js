const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parse');

// Create a new database instance
// This will create a new file called rsvp.db if it doesn't exist
const db = new sqlite3.Database('./rsvp.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Function to set up all database tables and initial test data
function initializeDatabase() {
    db.serialize(() => {
        // Drop existing views and tables
        db.run(`DROP VIEW IF EXISTS formatted_rsvp_responses`);
        db.run(`DROP TABLE IF EXISTS rsvp_responses`);
        db.run(`DROP TABLE IF EXISTS guest_events`);
        db.run(`DROP TABLE IF EXISTS events`);
        db.run(`DROP TABLE IF EXISTS guests`);
        db.run(`DROP TABLE IF EXISTS families`);
        db.run(`DROP VIEW IF EXISTS event_totals`);

        // Modified Families table - added has_children and has_spouse fields
        db.run(`
            CREATE TABLE IF NOT EXISTS families (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rsvp_code TEXT UNIQUE NOT NULL,
                has_children BOOLEAN DEFAULT 0,
                has_spouse BOOLEAN DEFAULT 0
            )
        `);

        // Create Guests table - stores individual guest information
        // Links to families table through family_id
        db.run(`
            CREATE TABLE IF NOT EXISTS guests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                family_id INTEGER,
                FOREIGN KEY (family_id) REFERENCES families (id)
            )
        `);

        // New table for events
        db.run(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date TEXT
            )
        `);

        // New table for guest event invitations
        db.run(`
            CREATE TABLE IF NOT EXISTS guest_events (
                guest_id INTEGER,
                event_id INTEGER,
                children_invited BOOLEAN DEFAULT 0,
                FOREIGN KEY (guest_id) REFERENCES guests (id),
                FOREIGN KEY (event_id) REFERENCES events (id),
                PRIMARY KEY (guest_id, event_id)
            )
        `);

        // Modified RSVP responses table to include children info
        db.run(`
            CREATE TABLE IF NOT EXISTS rsvp_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guest_id INTEGER,
                event_id INTEGER,
                attending BOOLEAN,
                children_attending BOOLEAN,
                number_of_children INTEGER,
                children_comments TEXT,
                comment TEXT,
                FOREIGN KEY (guest_id) REFERENCES guests (id),
                FOREIGN KEY (event_id) REFERENCES events (id)
            )
        `);

        // Modified view for formatted RSVP responses
        db.run(`
            CREATE VIEW formatted_rsvp_responses AS
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
            ORDER BY r.id
        `);

        //permanent view for event totals that can be seen in DB Browser
        db.run(`
            CREATE VIEW event_totals AS
            SELECT 
                e.id as event_id,
                e.name as event_name,
                e.date as event_date,
                (
                    SELECT COUNT(DISTINCT g2.id) + 
                    SUM(CASE WHEN f2.has_spouse = 1 THEN 1 ELSE 0 END)
                    FROM guests g2
                    JOIN families f2 ON g2.family_id = f2.id
                    JOIN guest_events ge2 ON g2.id = ge2.guest_id
                    LEFT JOIN rsvp_responses r2 ON g2.id = r2.guest_id AND e.id = r2.event_id
                    WHERE ge2.event_id = e.id AND r2.attending = 1
                ) as total_adults,
                (
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN r3.children_attending = 1 THEN COALESCE(r3.number_of_children, 0)
                            ELSE 0 
                        END
                    ), 0)
                    FROM rsvp_responses r3
                    WHERE r3.event_id = e.id AND r3.attending = 1
                ) as total_children,
                (
                    SELECT 
                        (COUNT(DISTINCT g2.id) + 
                        SUM(CASE WHEN f2.has_spouse = 1 THEN 1 ELSE 0 END)) +
                        COALESCE(SUM(
                            CASE 
                                WHEN r2.children_attending = 1 THEN COALESCE(r2.number_of_children, 0)
                                ELSE 0 
                            END
                        ), 0)
                    FROM guests g2
                    JOIN families f2 ON g2.family_id = f2.id
                    JOIN guest_events ge2 ON g2.id = ge2.guest_id
                    LEFT JOIN rsvp_responses r2 ON g2.id = r2.guest_id AND e.id = r2.event_id
                    WHERE ge2.event_id = e.id AND r2.attending = 1
                ) as total_attendees
            FROM events e
        `);

        //view for invited guests per event
        db.run(`
            CREATE VIEW IF NOT EXISTS event_guest_list AS
            SELECT 
                e.name as event_name,
                g.name as guest_name,
                f.rsvp_code,
                f.has_spouse,
                f.has_children,
                CASE 
                    WHEN r.attending = 1 THEN 'Yes'
                    WHEN r.attending = 0 THEN 'No'
                    ELSE 'Pending'
                END as attending_status,
                CASE 
                    WHEN f.has_spouse = 1 THEN 2
                    ELSE 1
                END as adult_count,
                COALESCE(r.number_of_children, 0) as children_count,
                COALESCE(r.children_comments, '') as children_details,
                COALESCE(r.comment, '') as comments
            FROM events e
            JOIN guest_events ge ON e.id = ge.event_id
            JOIN guests g ON ge.guest_id = g.id
            JOIN families f ON g.family_id = f.id
            LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
            ORDER BY e.date, g.name
        `);

        // Insert test data with a family that has children
        // db.run(`INSERT OR IGNORE INTO families (id, rsvp_code, has_children) VALUES (1, 'TEST123', 1)`);
        // db.run(`INSERT OR IGNORE INTO guests (id, name, family_id) VALUES (1, 'John Doe', 1)`);
        
        // Insert events
        db.run(`INSERT OR IGNORE INTO events (id, name, date) VALUES (1, 'Nikkah', '06-13-2025')`);
        db.run(`INSERT OR IGNORE INTO events (id, name, date) VALUES (2, 'Mehndi', '06-19-2025')`);
        db.run(`INSERT OR IGNORE INTO events (id, name, date) VALUES (3, 'Baraat', '06-21-2025')`);
        db.run(`INSERT OR IGNORE INTO events (id, name, date) VALUES (4, 'Valima', '06-22-2025')`);

        // Assign John Doe to Baraat and Valima
        // db.run(`INSERT OR IGNORE INTO guest_events (guest_id, event_id) VALUES (1, 2)`); // Baraat
        // db.run(`INSERT OR IGNORE INTO guest_events (guest_id, event_id) VALUES (1, 3)`); // Valima
    });
}

// Function to get formatted RSVP responses
function getFormattedRsvpResponses() {
    return new Promise((resolve, reject) => {
        db.all(`
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
            ORDER BY r.id
        `, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

//function to import CSV data
function importGuestsFromCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        
        fs.createReadStream(filePath)
            .pipe(csv.parse({ columns: true, trim: true }))
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', () => {
                const processRows = async () => {
                    for (const row of results) {
                        // First, insert or get family
                        const family = await new Promise((resolve, reject) => {
                            db.get(
                                `INSERT OR REPLACE INTO families (rsvp_code, has_children, has_spouse)
                                 VALUES (?, ?, ?)
                                 RETURNING id`,
                                [
                                    row.rsvp_code, 
                                    row.has_children === '1' ? 1 : 0,
                                    row.has_spouse === '1' ? 1 : 0
                                ],
                                (err, result) => {
                                    if (err) reject(err);
                                    else resolve(result);
                                }
                            );
                        });

                        // Then, insert guest with the correct family_id
                        await new Promise((resolve, reject) => {
                            db.run(
                                `INSERT OR REPLACE INTO guests (name, family_id)
                                 VALUES (?, ?)`,
                                [row.name, family.id],
                                function(err) {
                                    if (err) reject(err);
                                    else {
                                        // After guest is inserted, handle their events
                                        const guestId = this.lastID;
                                        const events = row.invited_events.split(',');
                                        const children_events = (row.children_invited_events || '').split(',');
                                        
                                        // Insert event associations
                                        const eventPromises = events.map(eventName => {
                                            return new Promise((resolve, reject) => {
                                                db.run(
                                                    `INSERT OR IGNORE INTO guest_events (guest_id, event_id, children_invited)
                                                     SELECT ?, id, ? FROM events WHERE name = ?`,
                                                    [
                                                        guestId, 
                                                        children_events.includes(eventName.trim()) ? 1 : 0,
                                                        eventName.trim()
                                                    ],
                                                    (err) => {
                                                        if (err) reject(err);
                                                        else resolve();
                                                    }
                                                );
                                            });
                                        });

                                        Promise.all(eventPromises)
                                            .then(() => resolve())
                                            .catch(reject);
                                    }
                                }
                            );
                        });
                    }
                };

                processRows()
                    .then(() => resolve())
                    .catch(reject);
            })
            .on('error', reject);
    });
}

// Export the database connection, initialization function, and the new function
module.exports = { 
    db, 
    initializeDatabase,
    getFormattedRsvpResponses,
    importGuestsFromCSV
}; 