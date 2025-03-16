const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const csvPath = './guests.csv';
const API_URL = process.env.NODE_ENV === 'production' 
    ? 'https://mkandua-rsvp.onrender.com'
    : 'http://localhost:3001';

// Check if file exists
if (!fs.existsSync(csvPath)) {
    console.error('Error: guests.csv file not found!');
    process.exit(1);
}

// Validate CSV format
try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const firstLine = fileContent.split('\n')[0].trim();
    const expectedHeaders = ['family_name', 'rsvp_code', 'member_name', 'invited_events'];
    const headers = firstLine.split('\t');
    
    const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
        console.error('Error: CSV is missing required headers:', missingHeaders.join(', '));
        console.error('Expected headers:', expectedHeaders.join(', '));
        console.error('Found headers:', headers.join(', '));
        process.exit(1);
    }
    
    console.log('CSV format validation passed');
} catch (err) {
    console.error('Error validating CSV format:', err);
    process.exit(1);
}

console.log('Reading CSV file...');
console.log('CSV Path:', csvPath);

const form = new FormData();
form.append('file', fs.createReadStream(csvPath));

console.log('Uploading to:', `${API_URL}/api/upload-guests`);

axios.post(`${API_URL}/api/upload-guests`, form, {
    headers: {
        ...form.getHeaders()
    }
}).then(response => {
    console.log('Upload successful:', response.data);
}).catch(error => {
    console.error('Upload failed!');
    if (error.response) {
        // The request was made and the server responded with a status code
        console.error('Server responded with:', error.response.status);
        console.error('Error data:', error.response.data);
        if (error.response.data.details) {
            console.error('Error details:', error.response.data.details);
        }
    } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from server. Is the server running?');
    } else {
        // Something happened in setting up the request
        console.error('Error setting up request:', error.message);
    }
    process.exit(1);
}); 