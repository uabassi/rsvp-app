const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const csvPath = '../guests.csv';

// Check if file exists
if (!fs.existsSync(csvPath)) {
    console.error('Error: guests.csv file not found!');
    process.exit(1);
}

const form = new FormData();
form.append('file', fs.createReadStream(csvPath));

axios.post('http://localhost:3001/api/upload-guests', form, {
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
    } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from server. Is the server running?');
    } else {
        // Something happened in setting up the request
        console.error('Error setting up request:', error.message);
    }
}); 