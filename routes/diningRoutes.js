// routes/userRoutes.js

const express = require('express');
const axios = require('axios'); 
const fs = require('fs');
const path = require('path');


// Path to the JSON file
const dataFilePath = path.join(__dirname, 'Commands.json');
const dataReservationFilePath = path.join(__dirname, 'reservation.json');

// Function to read JSON file
function readData(path) {
    const data = fs.readFileSync(path, 'utf-8');
    return JSON.parse(data);
}

  // Function to write to JSON file
function writeData(data, path) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

const router = express.Router();
const serverLink = "http://localhost:3001";

//list all Tables
router.get('/tables', async (req, res) => {
    const response = await axios.get(serverLink+'/tables');
    res.status(200).json(response.data);
});

//this not fake data, wa gathered this data during the previous steps
//the api didnt contain some additional data that we needed during the payment
router.get('/command/:commandId/tables', (req, res) => {
    const { commandId } = req.params;
    const data = readData(dataFilePath);
  
    // Find the command by commandId
    const command = data.find(item => item.commandId == commandId);
    if (command) {
      res.json({ tables: command.tables });
    } else {
      res.status(404).json({ message: 'Command not found' });
    }
});

router.post('/payment/byTable', (req, res) => {
    const commandId  = req.body.commandId;
    var selectedTables = []
    selectedTables = req.body.selectedTables;

    const data = readData(dataFilePath);
  
    // Find the command by commandId
    const command = data.find(item => item.commandId === commandId);
    if (command) {
      
      var bill = [];
      var commandTotal = 0
      command.tables.filter(table=>!table.tablePaid && selectedTables.includes(table.tableNumber)).forEach(table => {
        var tableBill = {};
        tableBill["tableNumber"]=table.tableNumber;
        var tableTotal = 0 ;
        var clientsBill = []
        table.clients.filter(client=>!client.clientPaid).forEach(client=>{
          var clientBill = {}
          clientBill["clientNumber"]=client.client
          clientBill["price"] = 0;
        
          client.items.forEach(item => {
            clientBill["price"] += item.price;
          });
          clientsBill.push(clientBill);
          tableTotal += clientBill["price"];
        })
        
        tableBill["clients"] = clientsBill;
        tableBill["tableTotal"] = tableTotal; 
        
        commandTotal += tableTotal ;
        bill.push(tableBill);
        
      });
      
      res.json({"tablesBill":bill,"commandTotal":commandTotal});
    } else {
      res.status(404).json({ message: 'Command not found' });
    }
});

router.post('/payment/process/byTables', async (req,res)=>{
  const paidTables = req.body.paidTables;
  const commandId  = req.body.commandId;

  const data = readData(dataFilePath);
  
  // Find the command by commandId
  const command = data.find(item => item.commandId == commandId);

  command.tables.filter(item=>paidTables.includes(item.tableNumber))
                .forEach(async(item)=>{
                  item.tablePaid = true;
                  await axios.post(serverLink+"/tableOrders/"+item.table+"/bill");
                });
  writeData(data,dataFilePath);

  res.status(200).json({ message: 'Tables marked as paid successfully' });

})
router.get("/freeTables",async (req,res)=>{
    const resp = await axios.get(serverLink+"/tableOrders");
    const orders = resp.data;
    for (let index = 0; index < orders.length; index++) {

        if(orders[index]["billed"]==null)
            await axios.post(serverLink+"/tableOrders/"+orders[index]["_id"]+"/bill");
        
    }

});

router.post('/add-command', async (req, res) => {
  const tablesNumber = req.body.tablesNumber; // Expecting an array of table IDs
  let customersCount = req.body.customersCount; // Change const to let

  // Validate input
  if (!Array.isArray(tablesNumber) || tablesNumber.some(num => typeof num !== 'number') || typeof customersCount !== 'number') {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Read existing commands
  const commands = readData(dataFilePath);
  const reservations = readData(dataReservationFilePath);
  const commandId = generateCommandId();

  // Create new command
  const newCommand = {
    commandId,
    tables: []
  };
  let newReservation = {
    commandId,
    tables: []
  };


  // Calculate how many clients can fit per table
  const clientsPerTable = 4;

  // Loop through tables and add clients
  for (let i = 0; i < tablesNumber.length; i++) {
    const tableNumber = tablesNumber[i];
    const clientsForTable = Math.min(clientsPerTable, customersCount); // 4 clients max per table
    /*const body = {
      "tableNumber": tableNumber, // Use the actual table ID in the request
      "customersCount": clientsForTable
    };*/
    //const response = await axios.post(serverLink + '/tableOrders', body);
    // Create a table entry in the command
    newCommand.tables.push({
      //table: response.data["_id"], // Use the actual table ID
      tablePaid: false,
      tableNumber: tableNumber, // Assuming tableNumber is 1-indexed
      clients: []
    });
    newReservation.tables.push({
        tableNumber: tableNumber,
    });


    // Assign clients to the table
    var clientNumber = 1;
    for (let k = 0; k < clientsForTable; k++) {
      newCommand.tables[newCommand.tables.length - 1].clients.push({
        client: (clientNumber++).toString(),
        clientPaid: false,
        items: [] // You can add items if needed
      });
    }

    // Decrease remaining customersCount
    customersCount -= clientsForTable;

    // If needed, make an Axios request for each table after assigning clients
    // Example: You can post to a separate server or endpoint if required


    // Handle the response from the server if needed
  }

  // Add new command to commands array
  commands.push(newCommand);
  reservations.push(newReservation);

  // Write updated commands back to the JSON file
  writeData(commands,dataFilePath);
  writeData(reservations,dataReservationFilePath);

  res.status(201).json(newCommand); // Return the newly created command
});

  const generateCommandId = () => {
    return Math.floor(Math.random() * 10000) + 1; // Adjust the range as needed
  };

module.exports = router;
