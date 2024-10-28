const express = require('express');
const axios = require('axios');
const cors = require('cors');
const diningRoutes = require('./routes/diningRoutes');
const fs = require('fs');
const path = require("path");
const events = require("node:events");
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3003;

const wss = new WebSocket.Server({ port: 3004 });

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
  }
    console.log('tables orders are sent to the kitchen');
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
          console.log('preparation launched for each item in the kitchen');
          // Parcourir chaque élément du tableau principal avec `for...of`
          for (const tableOrder of response.data) {
            // Parcourir chaque `preparedItem` dans `preparedItems`
            for (const preparedItem of tableOrder.preparedItems) {
              await axios.post(`http://localhost:9500/kitchen//preparedItems/${preparedItem._id}/start`);
              console.log("Item is being cooked in kitchen");
              await axios.post(`http://localhost:9500/kitchen//preparedItems/${preparedItem._id}/finish`);
              console.log("Item finished cooking");
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
app.post('/addEvent', async (req, res) => {
  try {
    console.log('Requête au back-end pour ajouter un événement');
    const event = req.body.event;

    // Validation de l'entrée
    if (!event) {
      return res.status(400).json({ message: "L'événement est requis." });
    }

    console.log('Ajouter un évènement:', event);

    // Lire les données existantes
    let eventsData = readData(dataEventsFilePath);

    // Ajouter le nouvel événement
    eventsData.push(event);

    // Sauvegarder les données mises à jour dans le fichier
    writeData(eventsData,dataEventsFilePath ); // Vous devez définir cette fonction

    // Répondre avec succès
    res.status(201).json({ message: "Événement ajouté avec succès" });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'événement:', error);
    res.status(500).json({ message: "Erreur interne du serveur", error: error.message });
  }
});


app.get('/orders/:commandId/:clientId/:tableId', async (req, res) => {
  const { commandId, clientId, tableId } = req.params;
  console.log(`Requête au back-end pour récupérer les commandes`);

  try {
    const data = await readData(dataFilePath);
    const order = data.find(item => item.commandId == commandId);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    const table = order.tables.find(item => item.tableNumber == tableId);
    if (!table) {
      return res.status(404).json({ message: 'Table non trouvée' });
    }

    const clients = table.clients.filter(client => client.client != clientId && client.items.length > 0);

    return res.status(200).json(clients);
  } catch (error) {
    console.error(`Erreur lors de la requête au back-end pour la commande ${commandId}, client ${clientId}, table ${tableId}:`, error);
    return res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.get('/event', async (req, res) => {
    try {
        console.log('Requête au back-end pour récupérer les événements');
        let eventData = readData(dataEventsFilePath);
        res.status(200).json(eventData[0]);

    } catch (error) {
        console.error('Erreur lors de la requête au back-end:', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});


app.post('/event/menu', async (req, res) => {
  try {
    console.log('Requête au back-end pour ajouter un menu à un événement');
    let eventData = readData(dataEventsFilePath);
    if (!Array.isArray(eventData[0].menu)) {
      eventData[0].menu = [];
    }
    if (!Array.isArray(eventData[0].BEVERAGES)) {
      eventData[0].BEVERAGES = [];
    }


    const menuExists = eventData[0].menu.some(existingMenu => existingMenu.name === req.body.menu.name);
    if (menuExists) {
      return res.status(400).json({ message: 'Le menu existe déjà' });
    }

    const { items } = req.body.menu;
    const beverages = items.BEVERAGES || [];
    delete items.BEVERAGES;

    eventData[0].menu.push({ ...req.body.menu, items });

    beverages.forEach(drink => {
      const drinkExists = eventData[0].BEVERAGES.some(existingDrink => existingDrink._id === drink._id);
      if (!drinkExists) {
        eventData[0].BEVERAGES.push(drink);
      }
    });

    writeData(eventData, dataEventsFilePath);

    res.status(201).json({ message: 'Menu ajouté à l\'événement avec succès' });
  } catch (error) {
    console.error('Erreur lors de la requête au back-end:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.delete('/event/menu/:menuName', async (req, res) => {
  console.log('Requête au back-end pour supprimer un menu d un événement');
    const menuName = req.params.menuName;
    try {
        let eventData = readData(dataEventsFilePath);
        const menuIndex = eventData[0].menu.findIndex(menu => menu.name === menuName);
        if (menuIndex === -1) {
            return res.status(404).json({ message: 'Menu non trouvé' });
        }
        eventData[0].menu.splice(menuIndex, 1);
        writeData(eventData, dataEventsFilePath);
        res.status(200).json({ message: 'Menu supprimé avec succès' });
    }catch (error) {
        console.error('Erreur lors de la requête au back-end:', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

wss.on('connection', ws => {
  console.log('Client connecté via WebSocket');

  // Envoyer le contenu initial du fichier dès la connexion
  const initialData = readData(dataEventsFilePath);

  console.log('Initial data:', initialData);
  ws.send(JSON.stringify({ message: 'Initial file data', data: initialData[0] }));

  fs.watch(dataEventsFilePath, (eventType) => {
    console.log(`File event: ${eventType}`);
    if (eventType === 'change') {
      const updatedData = readData(dataEventsFilePath);
      ws.send(JSON.stringify({ message: 'File updated', data: updatedData[0] }));
    }
  });
});

app.delete('/event/drink/:drinkId', async (req, res) => {
    console.log('Requête au back-end pour supprimer une boisson d un événement');
    const drinkId = req.params.drinkId;
    console.log('Boisson à supprimer:', drinkId);
    try {
        let eventData = readData(dataEventsFilePath);
        const drinkIndex = eventData[0].BEVERAGES.findIndex(drink => drink._id === drinkId);
        if (drinkIndex === -1) {
          return res.status(404).json({ message: 'Boisson non trouvée' });
        }
        eventData[0].BEVERAGES.splice(drinkIndex, 1);
        writeData(eventData, dataEventsFilePath);
        res.status(200).json({ message: 'Boisson supprimée avec succès' });
    }catch (error) {
        console.error('Erreur lors de la requête au back-end:', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

app.get('/event/validate', async (req, res) => {
  try {
    console.log('Requête au back-end pour valider un événement');
    let eventData = readData(dataEventsFilePath);
    let finalEvents = readData(dataFinalEvents);
    finalEvents.push(eventData[0]);
    writeData(finalEvents, dataFinalEvents);
    eventData = [];
    writeData(eventData, dataEventsFilePath);
    res.status(201).json({ message: 'Evénement validé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la requête au back-end:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});



app.use('/dining',diningRoutes);
app.listen(PORT, () => {
  console.log(`Le serveur BFF écoute sur le port ${PORT}`);
});


const dataFilePath = path.join(__dirname, './routes/Commands.json');
const dataReservationFilePath = path.join(__dirname, './routes/reservation.json');
const dataEventsFilePath = path.join(__dirname, './routes/events.json');
const dataFinalEvents = path.join(__dirname, './routes/finalEvent.json');

// Function to read JSON file
function readData(path) {
  const data = fs.readFileSync(path, 'utf-8');
  return JSON.parse(data);
}

// Function to write to JSON file
function writeData(data, path) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}
