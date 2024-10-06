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
    const data = readData(dataFilePath);

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

  // console.log('items:', data.find(item => item.commandId === order.orderNumber).tables[0].clients[0].items.shortName);
    writeData(data, dataFilePath);

    // Répondre avec un statut de succès
    res.status(201).json({ message: "Commande mise à jour avec succès" });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});


app.post('/validateOrder',async (req, res) => {
  try {
  const orderId = req.body;
  console.log('Commande à valider:', orderId);

  let ordersData = readData(dataFilePath);
  let reservationsData = readData(dataReservationFilePath);

  // delete the reservation from the reservation file
  reservationsData = reservationsData.filter(reservation => reservation.commandId !== orderId.commandId);
  writeData(reservationsData, dataReservationFilePath);

  let order = ordersData.find(order => order.commandId === orderId.commandId);
  for (let table of order.tables) {
    let clientsForTable = table.clients.length;
    let tableNumber = table.tableNumber;
    const body = {
      "tableNumber": tableNumber,
      "customersCount": clientsForTable
    };
    const response = await axios.post( 'http://localhost:9500/dining/tableOrders', body);
    table.table= response.data["_id"]
    for (let client of table.clients){
      for (let item of client.items) {
        const itemBody = {
          "menuItemId": item._id,
          "menuItemShortName": item.shortName,
          "howMany":  item.quantity
        };
        await axios.post(`http://localhost:9500/dining/tableOrders/${table.table}`, itemBody);
        //console.log('item added to the table', table.table.tableNumber);
      }
    }
    await axios.post(`http://localhost:9500/dining/tableOrders/${table.table}/prepare`);
    console.log('table order sent to the kitchen');
  }
  //lancement des preparation pour chaque item
    for (let table of order.tables) {
      for (let client of table.clients){
        for(let item of client.items){
          const bodyPrep = {
            "tableNumber": table.tableNumber,
            "itemsToBeCooked": [
              {
                "menuItemShortName": item.shortName,
                "howMany": item.quantity
              }
            ]
          };
         const response= await axios.post(`http://localhost:9500/kitchen/preparations`,bodyPrep);
          console.log('Lancement de la préparation de: ',item.shortName);
          // Parcourir chaque élément du tableau principal avec `for...of`
          for (const tableOrder of response.data) {
            // Parcourir chaque `preparedItem` dans `preparedItems`
            for (const preparedItem of tableOrder.preparedItems) {
              await axios.post(`http://localhost:9500/kitchen//preparedItems/${preparedItem._id}/start`);
              console.log('Lancement de la cuisson de:',item.shortName);
              await axios.post(`http://localhost:9500/kitchen//preparedItems/${preparedItem._id}/finish`);
              console.log("le cuisson est terminée pour :",item.shortName);
            }
          }




        }
      }
    }

    writeData(ordersData, dataFilePath);
    res.status(201).json({ message: "Commande validée avec succès" });
  } catch (error) {
    console.error('Erreur lors de la validation de la commande:', error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});



app.get('/tables', async (req, res) => {
  try {
    const tempReservation = readData(dataReservationFilePath);
    console.log('Requête au back-end pour récupérer les tables');
    const response = await axios.get('http://localhost:9500/dining/tables');


    response.data.forEach(table => {
      if (!table.taken) {
        table.taken = tempReservation.some(reservation =>
            reservation.tables.some(reservedTable => reservedTable.tableNumber === table.number)
        );
      }
    });

   // console.log('Tables:', response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Erreur lors de la requête au back-end:', error);
    res.status(500).json({message: 'Erreur interne du serveur'});
  }
});


app.post('/cancelOrder', async (req, res) => {
  try {
    console.log('Annuler commande');
    const orderId = req.body;
    console.log('Commande à annuler:', orderId);

    let ordersData = readData(dataFilePath);
    let reservationsData = readData(dataReservationFilePath);

    // delete the reservation from the reservation file
    reservationsData = reservationsData.filter(reservation => reservation.commandId !== orderId.commandId);
    writeData(reservationsData, dataReservationFilePath);

    ordersData = ordersData.filter(order => order.commandId !== orderId.commandId);
    writeData(ordersData, dataFilePath);

    res.status(201).json({ message: "Commande annulée avec succès" });
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la commande:', error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});


app.get('/orders/:commandId/:clientId/:tableId', async (req, res) => {
  const { commandId, clientId, tableId } = req.params;
  console.log(`Requête au back-end pour récupèrer les commandes : commandId=${commandId}, clientId=${clientId}, tableId=${tableId}`);

  try {
    const data = await readData(dataFilePath);
    console.log('Commandes:', data);
    const order = data.find(item => item.commandId == commandId);
    console.log('Commande:', order);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    console.log('Commande:', order);

    const table = order.tables.find(item => item.tableNumber == tableId);
    if (!table) {
      return res.status(404).json({ message: 'Table non trouvée' });
    }
    console.log('Table:', table);

    //recuperer la liste des tous les clients avec des ids différent a commandId
    const clients = table.clients.filter(item => item.client != clientId);

    console.log('Clients:', clients);

    return res.status(200).json(clients);
  } catch (error) {
    console.error(`Erreur lors de la requête au back-end pour la commande ${commandId}, client ${clientId}, table ${tableId}:`, error);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.use('/dining',diningRoutes);
app.listen(PORT, () => {
  console.log(`Le serveur BFF écoute sur le port ${PORT}`);
});


const dataFilePath = path.join(__dirname, './routes/Commands.json');
const dataReservationFilePath = path.join(__dirname, './routes/reservation.json');

// Function to read JSON file
function readData(path) {
  const data = fs.readFileSync(path, 'utf-8');
  return JSON.parse(data);
}

// Function to write to JSON file
function writeData(data, path) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}
