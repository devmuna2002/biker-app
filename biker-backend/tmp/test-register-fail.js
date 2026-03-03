const axios = require('axios');
axios.post('http://127.0.0.1:3003/api/auth/register', {
    name: "Biker Test",
    email: "customerxxx@example.com",
    password: "password123",
    phone: "+263777777777",
    city: "Harare",
    country: "Zimbabwe",
    countryCode: "ZW",
    role: "user"
}).then(res => console.log(res.data)).catch(err => console.error(err.message, err.response?.data));
