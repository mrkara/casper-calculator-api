const cors = require('cors') ;
const bodyParser = require('body-parser');
const express = require('express');
var MobileDetect = require('mobile-detect');

var axios = require('axios');

var fs = require('fs');
var https = require('https');
var privateKey  = fs.readFileSync('./server.key', 'utf8');
var certificate = fs.readFileSync('./server.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};
var mongoose = require('mongoose');

var casper = require('./casper.js');
var database = require('./database.js');

const app = express();
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

//getLatestBlockInfo
app.post('/getLatestBlockInfo', async (req, res) => {
  let latestBlockResponse = await casper.getLatestBlockInfo();
  return res.send(latestBlockResponse);
});

//getAccountBalance
app.post('/getAccountBalance', async (req, res) => {
  let stateRootHash = req.body.stateRootHash;
  let publicKey = req.body.publicKey;
  let balance = await casper.getAccountBalance(stateRootHash,publicKey);
  return res.send({balance:balance});
});

//getValidatorsInfo
app.post('/getValidatorsInfo', async (req, res) => {
  let validatorsInfo = await casper.getValidatorsInfo();
  return res.send(validatorsInfo);
});

//getStatus
app.post('/getStatus', async (req, res) => {
  let status = await casper.getStatus();
  return res.send(status);
});

app.post('/getValidators', async (req, res) => {
  console.log("getValidators:", req.body);
  let public_key = req.body.public_key;
  if (public_key === "" || !public_key)
    return res.send({"status": 'OK',validators:await database.Validators.find({})});
  else {
    return res.send({"status": 'OK',validators:await database.Validators.find({"public_key":public_key})});
  }
});

app.post('/getValidatorsRewards', async (req, res) => {
  console.log("getValidatorsRewards:", req.body);
  let public_key = req.body.public_key;
  return res.send({"status": 'OK',rewards:await database.ValidatorsRewards.find({"public_key":public_key})});
});

app.post('/getValidatorsCommissions', async (req, res) => {
  console.log("getValidatorsCommissions:", req.body);
  let public_key = req.body.public_key;
  return res.send({"status": 'OK',commissions:await database.ValidatorsCommissions.find({"public_key":public_key})});
});

app.use(express.static('public'));
const connectDb = () => {
  return mongoose.connect("mongodb://localhost:27017/casper", {useNewUrlParser: true});
};

connectDb().then(async () => {
  var httpsServer = https.createServer(credentials, app);
  httpsServer.listen(3399, () => {
    console.log(`Capser API listening on port 3399!`);
  });
});
