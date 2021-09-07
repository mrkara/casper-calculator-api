const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express');
let MobileDetect = require('mobile-detect');
let axios = require('axios');
let mongoose = require('mongoose');
let casper = require('./casper.js');
let database = require('./database.js');

const updateValidatorMainList = async () => {
    let validatorsInfoFromNetwork = await casper.getValidatorsInfo();
    let val = await database.ValidatorsMainInfo.findOne({
        api_version: validatorsInfoFromNetwork.api_version,
        state_root_hash: validatorsInfoFromNetwork.auction_state.state_root_hash,
        block_height: validatorsInfoFromNetwork.auction_state.block_height
    });
    if (val == null) {
        await database.ValidatorsMainInfo.create({
            api_version: validatorsInfoFromNetwork.api_version,
            state_root_hash: validatorsInfoFromNetwork.auction_state.state_root_hash,
            block_height: validatorsInfoFromNetwork.auction_state.block_height,
            auction_state: validatorsInfoFromNetwork.auction_state
        });
    } else {
        await database.ValidatorsMainInfo.updateOne({
                api_version: validatorsInfoFromNetwork.api_version,
                state_root_hash: validatorsInfoFromNetwork.auction_state.state_root_hash,
                block_height: validatorsInfoFromNetwork.auction_state.block_height
            },
            {
                $set: {
                    api_version: validatorsInfoFromNetwork.api_version,
                    state_root_hash: validatorsInfoFromNetwork.auction_state.state_root_hash,
                    block_height: validatorsInfoFromNetwork.auction_state.block_height,
                    auction_state: validatorsInfoFromNetwork.auction_state
                }
            }
        );
    }
};

const updateValidatorList = async () => {
    let validatorsInfo = await casper.getValidatorsInfo();
    let status = await casper.getStatus();
    let current_Era = parseInt(status.last_added_block_info.era_id);
    let max_Era = current_Era - 360;
    await database.ValidatorsCommissions.remove(
        {eraId: {$lt: max_Era}}
    );
    let bids_length = validatorsInfo.auction_state.bids.length;
    let count = 0;
    for (let i = 0; i < bids_length; i++) {
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
        }
    }
};

const updateValidatorRewardRatio = async () => {
    let validators = await database.Validators.find({});
    let length = validators.length;
    for (let i = 0; i < length; i++) {
        let delegator_length = validators[i].delegators.length;
        if (delegator_length === 0) {
            let rewards = null;
            await axios.get('https://event-store-api-clarity-mainnet.make.services/validators/' + validators[i].public_key + '/rewards?with_amounts_in_currency_id=1&page=1&limit=20').then(resp => {
                rewards = resp.data.data;
            }).catch(function (error) {
                console.log(error);
            });
            if (rewards) {
                let reward_length = rewards.length;
                if (reward_length === 0) continue;
                let ratio = 0;
                ratio = rewards[0].amount / validators[i].staked_amount * (1 - validators[i].delegation_rate / 100);
                //update
                await database.Validators.updateOne(
                    {public_key: validators[i].public_key},
                    {$set: {currentRewardRatio: ratio}}
                );
            }
            await sleep(5000);
        } else {
            for (let j = 0; j < delegator_length; j++) {
                let delegator = validators[i].delegators[j];
                let rewards = null;
                await axios.get('https://event-store-api-clarity-mainnet.make.services/delegators/' + delegator.public_key + '/rewards?with_amounts_in_currency_id=1&page=1&limit=20').then(resp => {
                    rewards = resp.data.data;
                }).catch(function (error) {
                    console.log(error);
                });
                if (rewards) {
                    let reward_length = rewards.length;
                    if (reward_length === 0) continue;
                    let ratio = 0;
                    for (let k = 0; k < reward_length; k++) {
                        if (rewards[k].validatorPublicKey === validators[i].public_key) {
                            ratio = rewards[k].amount / delegator.staked_amount;
                            //update
                            await database.Validators.updateOne(
                                {public_key: validators[i].public_key},
                                {$set: {currentRewardRatio: ratio}}
                            );
                            console.log('Updated', validators[i].public_key, ratio);
                            break;
                        }
                    }
                    if (ratio !== 0) break;
                }
            }
            await sleep(5000);

        }
    }
    console.log('updateValidatorRewardRatio DONE');
};

const monitorValidatorRewards = async () => {
    //only keep data in 1 month
    // 30 days = 30 * 24 = 720 hours = 360 eras
    let status = await casper.getStatus();
    let current_Era = parseInt(status.last_added_block_info.era_id);
    let max_Era = current_Era - 360;
    await database.ValidatorsRewards.remove(
        {eraId: {$lt: max_Era}}
    );
    let validators = await database.Validators.find({});
    let leng = validators.length;
    for (let i = 0; i < leng; i++) {
        let rewards = null;
        await axios.get('https://event-store-api-clarity-mainnet.make.services/validators/' + validators[i].public_key + '/rewards?with_amounts_in_currency_id=1&page=1&limit=20').then(resp => {
            rewards = resp.data.data;
        }).catch(function (error) {
            console.log(error);
        });
        if (rewards) {
            let reward_length = rewards.length;
            if (reward_length === 0) continue;
            for (let k = 0; k < reward_length; k++) {
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
            let count_invalid_era = 0;
            for (let i = maxEra - 1; i > maxEra - 1 - res.length; i--) {
                let res = await database.ValidatorsRewards.findOne({
                    public_key: public_key,
                    eraId: i
                });
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
    return mongoose.connect("mongodb://127.0.0.1:27017/casper", {useNewUrlParser: true});
};

connectDb().then(async () => {
    //await monitorValidatorRewards();
    setInterval(monitorValidatorRewards, 2 * 60 * 60 * 1000);
    //await updateValidatorList();
    setInterval(updateValidatorList, 60 * 60 * 1000);
    //await updateValidatorRewardRatio();
    setInterval(updateValidatorRewardRatio, 3 * 60 * 60 * 1000);
    setInterval(updateValidatorMainList, 45 * 1000);
});
