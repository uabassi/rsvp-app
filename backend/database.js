const sqlite3 = require('sqlite3').verbose();

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

        // Modified Families table - added has_children field
        db.run(`
            CREATE TABLE IF NOT EXISTS families (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rsvp_code TEXT UNIQUE NOT NULL,
                has_children BOOLEAN DEFAULT 0
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

        // Insert test data with a family that has children
        db.run(`INSERT OR IGNORE INTO families (id, rsvp_code, has_children) VALUES (1, 'TEST123', 1)`);
        db.run(`INSERT OR IGNORE INTO guests (id, name, family_id) VALUES (1, 'John Doe', 1)`);
        
        // Insert events
        db.run(`INSERT OR IGNORE INTO events (id, name, date) VALUES (1, 'Mehndi', '2024-06-01')`);
        db.run(`INSERT OR IGNORE INTO events (id, name, date) VALUES (2, 'Baraat', '2024-06-02')`);
        db.run(`INSERT OR IGNORE INTO events (id, name, date) VALUES (3, 'Valima', '2024-06-03')`);

        // Assign John Doe to Baraat and Valima
        db.run(`INSERT OR IGNORE INTO guest_events (guest_id, event_id) VALUES (1, 2)`); // Baraat
        db.run(`INSERT OR IGNORE INTO guest_events (guest_id, event_id) VALUES (1, 3)`); // Valima
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

// Export the database connection, initialization function, and the new function
module.exports = { 
    db, 
    initializeDatabase,
    getFormattedRsvpResponses 
}; 