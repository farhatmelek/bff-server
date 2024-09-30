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

// Route POST /tableOrders
app.post('/tableOrders', async (req, res) => {
  try {
    // Récupérer les données du body de la requête (tableNumber et customersCount)
    const { tableNumber, customersCount } = req.body;
    console.log("createTableOrder")
    console.log(tableNumber);
    console.log(customersCount);

    // Vérification basique des données
    if (typeof tableNumber !== 'number' || typeof customersCount !== 'number') {
      return res.status(400).json({ message: 'Invalid data format. Expected numbers.' });
    }

    // Envoyer une requête POST à une API externe (par exemple : 'http://localhost:9500/tableOrders')
    const response = await axios.post('http://localhost:9500/dining/tableOrders', {
      tableNumber,
      customersCount
    });

    // Si la requête réussit, renvoyer la réponse de l'API externe au client
    res.status(201).json({
      message: 'Table order sent to the external API successfully',
      data: response.data
    });

  } catch (error) {
    console.error('Erreur lors de la requête à l\'API externe:', error);

    // Gérer les erreurs en renvoyant une réponse appropriée au client
    if (error.response) {
      // Erreur venant de l'API externe
      res.status(error.response.status).json({
        message: 'Erreur lors de la communication avec l\'API externe',
        error: error.response.data
      });
    } else {
      // Erreur côté serveur ou autre
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
});


app.use('/dining',diningRoutes);
app.listen(PORT, () => {
  console.log(`Le serveur BFF écoute sur le port ${PORT}`);
});

