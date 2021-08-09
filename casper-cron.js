const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express');
var MobileDetect = require('mobile-detect');

var axios = require('axios');

var mongoose = require('mongoose');

var casper = require('./casper.js');
var database = require('./database.js');


const updateValidatorList = async () => {
    // console.log('updateValidatorList');
    let validatorsInfo = await casper.getValidatorsInfo();
    let status = await casper.getStatus();

    let current_Era = parseInt(status.last_added_block_info.era_id);
    let max_Era = current_Era - 360;
    // console.log('Removing old Data...');
    await database.ValidatorsCommissions.remove(
        {eraId: {$lt: max_Era}}
    );

    var bids_length = validatorsInfo.auction_state.bids.length;

    var count = 0;
    for (var i = 0; i < bids_length; i++) {
        var delegator_length = validatorsInfo.auction_state.bids[i].bid.delegators.length;
        let val = await database.Validators.findOne({
            public_key: validatorsInfo.auction_state.bids[i].public_key
        });
        if (val == null) {
            val = await database.Validators.create({
                name: "",
                public_key: validatorsInfo.auction_state.bids[i].public_key,
                currentRewardRatio: 0,
                delegators: validatorsInfo.auction_state.bids[i].bid.delegators,
                delegation_rate: validatorsInfo.auction_state.bids[i].bid.delegation_rate,
                staked_amount: validatorsInfo.auction_state.bids[i].bid.staked_amount,
                uptime: 0,
                isActive: validatorsInfo.auction_state.bids[i].bid.inactive
            });
            // console.log('not exist adding',validatorsInfo.auction_state.bids[i].public_key);
        } else {
            count++;
            await database.Validators.updateOne(
                {public_key: validatorsInfo.auction_state.bids[i].public_key},
                {
                    $set: {
                        isActive: validatorsInfo.auction_state.bids[i].bid.inactive,
                        delegators: validatorsInfo.auction_state.bids[i].bid.delegators,
                        delegation_rate: validatorsInfo.auction_state.bids[i].bid.delegation_rate,
                        staked_amount: validatorsInfo.auction_state.bids[i].bid.staked_amount
                    }
                }
            );
            // console.log('already existed',validatorsInfo.auction_state.bids[i].public_key);
        }

        let res = await database.ValidatorsCommissions.findOne({
            public_key: validatorsInfo.auction_state.bids[i].public_key,
            eraId: status.last_added_block_info.era_id
        });
        if (res == null) {
            val = await database.ValidatorsCommissions.create({
                public_key: validatorsInfo.auction_state.bids[i].public_key,
                eraId: status.last_added_block_info.era_id,
                commission: validatorsInfo.auction_state.bids[i].bid.delegation_rate
            });
            // console.log('Comm not exist adding',validatorsInfo.auction_state.bids[i].public_key,status.last_added_block_info.era_id,validatorsInfo.auction_state.bids[i].bid.delegation_rate);
        }
    }
    // console.log('updateValidatorList DONE');
};

const updateValidatorRewardRatio = async () => {
    // console.log('updateValidatorRewardRatio');
    let validators = await database.Validators.find({});
    var leng = validators.length;
    for (var i = 0; i < leng; i++) {
        var delegator_length = validators[i].delegators.length;
        // console.log(i,validators[i].public_key,delegator_length);
        if (delegator_length == 0) {
            let rewards = null;
            await axios.get('https://event-store-api-clarity-mainnet.make.services/validators/' + validators[i].public_key + '/rewards?with_amounts_in_currency_id=1&page=1&limit=20').then(resp => {
                rewards = resp.data.data;
            }).catch(function (error) {
                console.log(error);
            });
            if (rewards) {
                var reward_length = rewards.length;
                if (reward_length == 0) continue;
                var ratio = 0;
                ratio = rewards[0].amount / validators[i].staked_amount * (1 - validators[i].delegation_rate / 100);
                //update
                await database.Validators.updateOne(
                    {public_key: validators[i].public_key},
                    {$set: {currentRewardRatio: ratio}}
                );
                // console.log('Updated',validators[i].public_key,ratio);
            }
            await sleep(5000);
        } else {
            for (var j = 0; j < delegator_length; j++) {
                var delegator = validators[i].delegators[j];
                let rewards = null;
                await axios.get('https://event-store-api-clarity-mainnet.make.services/delegators/' + delegator.public_key + '/rewards?with_amounts_in_currency_id=1&page=1&limit=20').then(resp => {
                    rewards = resp.data.data;
                }).catch(function (error) {
                    console.log(error);
                });
                if (rewards) {
                    var reward_length = rewards.length;
                    if (reward_length == 0) continue;
                    var ratio = 0;
                    for (var k = 0; k < reward_length; k++) {
                        if (rewards[k].validatorPublicKey == validators[i].public_key) {
                            ratio = rewards[k].amount / delegator.staked_amount;
                            //update
                            await database.Validators.updateOne(
                                {public_key: validators[i].public_key},
                                {$set: {currentRewardRatio: ratio}}
                            );
                            console.log('Updated', validators[i].public_key, ratio);
                            break; // break k for loop
                        }
                    }

                    if (ratio !== 0) break;
                }

            }
            await sleep(5000);

        }
        //console.log(validators[i].public_key);
        //await sleep(5000);
    }

    console.log('updateValidatorRewardRatio DONE');
};

const monitorValidatorRewards = async () => {
    //only keep data in 1 month
    // 30 days = 30 * 24 = 720 hours = 360 eras
    // console.log('monitorValidatorRewards');
    let status = await casper.getStatus();
    //console.log(status);
    let current_Era = parseInt(status.last_added_block_info.era_id);
    let max_Era = current_Era - 360;
    // console.log('Removing old Data...');
    await database.ValidatorsRewards.remove(
        {eraId: {$lt: max_Era}}
    );
    // console.log('Done');
    // console.log('Checking all validators to get data...');
    let validators = await database.Validators.find({});
    var leng = validators.length;
    for (var i = 0; i < leng; i++) {
        let rewards = null;
        await axios.get('https://event-store-api-clarity-mainnet.make.services/validators/' + validators[i].public_key + '/rewards?with_amounts_in_currency_id=1&page=1&limit=20').then(resp => {
            //console.log(delegator,resp.data);
            rewards = resp.data.data;
            //console.log(rewards);
        }).catch(function (error) {
            console.log(error);
        });
        if (rewards) {
            var reward_length = rewards.length;
            if (reward_length == 0) continue;
            for (var k = 0; k < reward_length; k++) {
                let res = await database.ValidatorsRewards.findOne({
                    public_key: validators[i].public_key,
                    eraId: rewards[k].eraId
                });
                if (res == null) {
                    val = await database.ValidatorsRewards.create({
                        public_key: validators[i].public_key,
                        eraId: rewards[k].eraId,
                        amount: rewards[k].amount
                    });
                    // console.log('not exist adding',validators[i].public_key,rewards[k].eraId,rewards[k].amount);
                }
            }
            //Calculate Uptime
            await calculateUptime(validators[i].public_key, current_Era);
        }
        await sleep(5000);
    }
};

const calculateUptime = async (public_key, maxEra) => {
    let res = await database.ValidatorsRewards.find({
        public_key: public_key
    });
    if (res) {
        if (res.length > 0) {
            var count_invalid_era = 0;
            for (var i = maxEra - 1; i > maxEra - 1 - res.length; i--) {
                let res = await database.ValidatorsRewards.findOne({
                    public_key: public_key,
                    eraId: i
                });
                //console.log(public_key,i,res);
                if (!res) count_invalid_era++;
                else {
                    if (res.amount === 0) count_invalid_era++;
                }
            }
            console.log(public_key, count_invalid_era, res.length, maxEra);
            await database.Validators.updateOne(
                {public_key: public_key},
                {$set: {uptime: 1 - count_invalid_era / res.length}}
            );
            return count_invalid_era / res.length;
        }
        return 0;
    }
    return 0;
};

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const connectDb = () => {
    return mongoose.connect("mongodb://localhost:27017/casper", {useNewUrlParser: true});
};

connectDb().then(async () => {

    //await monitorValidatorRewards();
    setInterval(monitorValidatorRewards, 2 * 60 * 60 * 1000);
    //await updateValidatorList();
    setInterval(updateValidatorList, 1 * 60 * 60 * 1000);
    //await updateValidatorRewardRatio();
    setInterval(updateValidatorRewardRatio, 3 * 60 * 60 * 1000);

});
