const config = {
    apiUrl: process.env.NODE_ENV === 'production'
        ? 'https://mkandua-rsvp.onrender.com'
        : 'http://localhost:3001'
};

export default config; 