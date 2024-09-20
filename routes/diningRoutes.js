// routes/userRoutes.js

const express = require('express');
const axios = require('axios'); 

const router = express.Router();

router.get('/tables', async (req, res) => {
    console.log("tablesssss");
    const response = await axios.get('http://localhost:3001/tables');   

    
    res.status(200).json(response.data);


});



module.exports = router;
