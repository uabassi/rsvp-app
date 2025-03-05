const fs = require('fs');
const csv = require('csv-parse');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function importGuestsFromCSV(filePath) {
    const results = [];
    
    // Read CSV file
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv.parse({ columns: true, trim: true }))
            .on('data', (data) => results.push(data))
            .on('end', resolve)
            .on('error', reject);
    });

    // Process each row
    for (const row of results) {
        try {
            // Start transaction
            await pool.query('BEGIN');

            // Insert family
            const familyResult = await pool.query(
                `INSERT INTO families (rsvp_code, has_children, has_spouse)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [row.rsvp_code, row.has_children === '1', row.has_spouse === '1']
            );

            // Insert guest
            const guestResult = await pool.query(
                `INSERT INTO guests (name, family_id)
                 VALUES ($1, $2)
                 RETURNING id`,
                [row.name, familyResult.rows[0].id]
            );

            // Handle events
            const events = row.invited_events.split(',');
            const children_events = (row.children_invited_events || '').split(',');

            for (const eventName of events) {
                await pool.query(
                    `INSERT INTO guest_events (guest_id, event_id, children_invited)
                     SELECT $1, id, $2 FROM events WHERE name = $3`,
                    [
                        guestResult.rows[0].id,
                        children_events.includes(eventName.trim()),
                        eventName.trim()
                    ]
                );
            }

            // Commit transaction
            await pool.query('COMMIT');
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    }
}

module.exports = { importGuestsFromCSV }; 