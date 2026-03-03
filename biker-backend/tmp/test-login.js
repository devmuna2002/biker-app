const axios = require('axios');
axios.post('http://127.0.0.1:3003/api/auth/login', {
    email: "customer222@example.com",
    password: "password123",
    role: "customer"
}).then(res => console.log(res.data)).catch(err => console.error(err.message, err.response?.data));
