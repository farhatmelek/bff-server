// routes/userRoutes.js

const express = require('express');
const axios = require('axios'); 
const fs = require('fs');
const path = require('path');


// Path to the JSON file
const dataFilePath = path.join(__dirname, 'Commands.json');

// Function to read JSON file
function readData() {
    const data = fs.readFileSync(dataFilePath, 'utf-8');
    return JSON.parse(data);
  }

  // Function to write to JSON file
function writeData(data) {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  }

const router = express.Router();
const serverLink = "http://localhost:3001";
router.get('/tables', async (req, res) => {
    console.log("tablesssss");
    const response = await axios.get(serverLink+'/tables');   

    
    res.status(200).json(response.data);


});
//this not fake data, wa gathered this data during the previous steps
//the api didnt contain some additional data that we needed during the payment
router.get('/command/:commandId/tables', (req, res) => {
    const { commandId } = req.params;
    const data = readData();
  
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

    const data = readData();
  
    // Find the command by commandId
    const command = data.find(item => item.commandId == commandId);
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
      
      console.log(bill);
      bill.forEach(el=>console.log(el.clients))
      res.json({"tablesBill":bill,"commandTotal":commandTotal});
    } else {
      res.status(404).json({ message: 'Command not found' });
    }
  });
router.post('/payment/process/byTables', async (req,res)=>{
  const paidTables = req.body.paidTables;
  const commandId  = req.body.commandId;

  const data = readData();
  console.log(`paid tables ${paidTables}`);
  
  // Find the command by commandId
  const command = data.find(item => item.commandId == commandId);

  command.tables.filter(item=>paidTables.includes(item.tableNumber))
                .forEach(async(item)=>{
                  item.tablePaid = true;
                  console.log(item.tableNumber);
                  await axios.post(serverLink+"/tableOrders/"+item.table+"/bill");
                });
  writeData(data);

  res.status(200).json({ message: 'Tables marked as paid successfully' });

})
router.get("/freeTables",async (req,res)=>{
    const resp = await axios.get(serverLink+"/tableOrders");
    const orders = resp.data;
    for (let index = 0; index < orders.length; index++) {
        // console.log(orders[index]["_id"])
        // console.log(orders[index])
        // console.log(orders[index]["billed"])
        if(orders[index]["billed"]==null)
            await axios.post(serverLink+"/tableOrders/"+orders[index]["_id"]+"/bill");
        
    }

});

router.post("/payment",async(req,res)=>{
    var tables = req.body.tables;
    var clients = req.body.clients;

})



module.exports = router;
