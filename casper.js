var casperClient = require('casper-client-sdk');
const GRPC_URL = "https://node-clarity-mainnet.make.services/rpc";

module.exports = {
  casperService:new casperClient.CasperServiceByJsonRPC(GRPC_URL),
  async getValidatorsInfo(){
    var validatorsInfo = null;
    await this.casperService.getValidatorsInfo().then((res) => {
      validatorsInfo = res;
      //console.log('validatorsInfo',res);
    });
    return validatorsInfo;
  },
  async getStatus(){
    var status = null;
    await  this.casperService.getStatus().then((res) => {
      status = res;
      //console.log('status',res);
    });
    return status;
  },
  async getLatestBlockInfo(){
    var latestBlockResponse = null;
    await this.casperService.getLatestBlockInfo().then((res) => {
      latestBlockResponse = res;
      //console.log('validatorsInfo',res);
    });
    return latestBlockResponse;
  },
  async getAccountBalance(stateRootHash, publicKey){
    let balance = 0;
    let casperBalanceService = new casperClient.BalanceServiceByJsonRPC(this.casperService);
    await casperBalanceService
      .getAccountBalance(stateRootHash, casperClient.PublicKey.fromHex(publicKey))
      .then((res) => {
        balance = res/1e9;
      });
    return balance;
  }
};
