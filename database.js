let mongoose = require('mongoose');

const validatorsSchema = new mongoose.Schema({
  public_key: {
    type: String,
  },
  name: {
    type: String,
  },
  currentRewardRatio:{
    type: Number
  },
  delegators:{
    type: Array
  },
  delegation_rate:{
    type: Number
  },
  staked_amount:{
    type: Number
  },
  uptime:{
    type: Number
  },
  isActive:{
    type:Boolean
  },
  website:{
    type: String
  },
  isTrusted:{
    type: Boolean
  }
});

const validatorsRewardsSchema = new mongoose.Schema({
  public_key: {
    type: String,
  },
  eraId: {
    type: Number,
  },
  amount: {
    type: Number,
  }
});

const validatorsCommissionsSchema = new mongoose.Schema({
  public_key: {
    type: String,
  },
  eraId: {
    type: Number,
  },
  commission: {
    type: Number,
  }
});

const validatorsMainInfoSchema = new mongoose.Schema({
  api_version: {
    type: String,
  },
  state_root_hash: {
    type: String,
  },
  block_height: {
    type: Number,
  },
  auction_state: {
    type: Object,
  }
});

module.exports = {
  Validators:mongoose.model('Validators', validatorsSchema),
  ValidatorsRewards:mongoose.model('ValidatorsRewards', validatorsRewardsSchema),
  ValidatorsCommissions:mongoose.model('ValidatorsCommissions', validatorsCommissionsSchema),
  ValidatorsMainInfo:mongoose.model('ValidatorsMainInfo', validatorsMainInfoSchema),

};
