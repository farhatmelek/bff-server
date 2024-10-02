const express = require('express');
const axios = require('axios');
const cors = require('cors');
const diningRoutes = require('./routes/diningRoutes');
const fs = require('fs');
const path = require("path");

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

app.get('/menu', async (req, res) => {
  try {
    console.log('Requête au back-end pour récupérer le menu');
    const type = req.query.type;  // Récupérer le type (category) depuis les paramètres de la requête
    const response = await axios.get('http://localhost:9500/menu/menus');  // Récupérer les données du back-end

    const menuItems = response.data;

    const filteredItems = menuItems.filter(item => item.category.toLowerCase() === type.toLowerCase());

    res.status(200).json(filteredItems);
  } catch (error) {
    console.error('Erreur lors de la requête au back-end:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.post('/order', async (req, res) => {
  try {
    console.log('Requête au back-end pour passer une commande');
    const order = req.body;
    const data = readData();

    const command = data.find(item => item.commandId === order.orderNumber);

    if (command) {
      command.tables.forEach(table => {
        if (table.tableNumber === order.tableNumber) {
          table.clients.forEach(client => {
            if (client.client == order.clientNumber) {
              client.items = order.items;
            }
          });
        }
      });
    } else {
      return res.status(404).json({ message: "Commande non trouvée" });
    }

    console.log('items:', data.find(item => item.commandId === order.orderNumber).tables[0].clients[0].items);
    writeData(data);

    // Répondre avec un statut de succès
    res.status(201).json({ message: "Commande mise à jour avec succès" });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});

app.use('/dining',diningRoutes);
app.listen(PORT, () => {
  console.log(`Le serveur BFF écoute sur le port ${PORT}`);
});


const dataFilePath = path.join(__dirname, './routes/Commands.json');


function readData() {
  const data = fs.readFileSync(dataFilePath, 'utf-8');
  return JSON.parse(data);
}


function writeData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
}
