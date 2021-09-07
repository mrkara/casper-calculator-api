const cors = require('cors') ;
const bodyParser = require('body-parser');
const express = require('express');
let MobileDetect = require('mobile-detect');
let axios = require('axios');
let fs = require('fs');
let https = require('https');
let privateKey  = fs.readFileSync('./server.key', 'utf8');
let certificate = fs.readFileSync('./server.crt', 'utf8');
let credentials = {key: privateKey, cert: certificate};
let mongoose = require('mongoose');
let casper = require('./casper.js');
let database = require('./database.js');
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
  let listData = await database.ValidatorsMainInfo.find({}).sort({_id: -1}).limit(1);
  if (listData.length === 1){
    return res.send(listData[0]);
  }else{
    return res.send([]);
  }
});

//getStatus
app.post('/getStatus', async (req, res) => {
  let status = await casper.getStatus();
  return res.send(status);
});

app.post('/getValidators', async (req, res) => {
  let public_key = req.body.public_key;
  if (public_key === "" || !public_key)
    return res.send({"status": 'OK',validators:await database.Validators.find({})});
  else {
    return res.send({"status": 'OK',validators:await database.Validators.find({"public_key":public_key})});
  }
});

app.post('/getValidatorsRewards', async (req, res) => {
  let public_key = req.body.public_key;
  return res.send({"status": 'OK',rewards:await database.ValidatorsRewards.find({"public_key":public_key})});
});

app.post('/getValidatorsCommissions', async (req, res) => {
  let public_key = req.body.public_key;
  return res.send({"status": 'OK',commissions:await database.ValidatorsCommissions.find({"public_key":public_key})});
});

app.use(express.static('public'));
const connectDb = () => {
  return mongoose.connect("mongodb://127.0.0.1:27017/casper", {useNewUrlParser: true});
};

connectDb().then(async () => {
  let httpsServer = https.createServer(credentials, app);
  httpsServer.listen(3399, () => {
    console.log(`Capser API listening on port 3399!`);
  });
});
