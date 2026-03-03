const axios = require('axios');
axios.post('http://127.0.0.1:3003/api/auth/otp/generate', {
    identifier: 'muna@example.com'
}).then(res => console.log(res.data)).catch(err => console.error(err.message, err.response?.data));
