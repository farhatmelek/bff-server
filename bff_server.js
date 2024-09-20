const express = require('express');
const axios = require('axios');
const cors = require('cors');
const diningRoutes = require('./routes/diningRoutes');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

app.get('/menu', async (req, res) => {
  try {
    const type = req.query.type;  // Récupérer le type (category) depuis les paramètres de la requête
    const response = await axios.get('http://localhost:9500/menu/menus');  // Récupérer les données du back-end
    
    // Supposons que le back-end renvoie une liste d'items
    const menuItems = response.data;

    // Filtrer les items selon la catégorie (type)
    const filteredItems = menuItems.filter(item => item.category.toLowerCase() === type.toLowerCase());

    // Renvoyer les items filtrés au front-end
    res.status(200).json(filteredItems);
  } catch (error) {
    console.error('Erreur lors de la requête au back-end:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});
app.use('/dining',diningRoutes);
app.listen(PORT, () => {
  console.log(`Le serveur BFF écoute sur le port ${PORT}`);
});
