const https = require('https');
const { key, failDelay } = require('../config.json');
const { getUUIDFromCache , getUUID } = require('./mojangRequest');
const utils = require('./utils');
const sleep = utils.sleep;

function getData(url) {
    return new Promise((resolve,reject)=>{
        https.get(url, res => {
            let reply = '';
            res.on('data',d=>{reply+=d});
            res.on('end',()=>{resolve(reply)});
            res.on('error',err=>{reject(err)});
        });
    });
}

async function basicRequest(page, extraArgs = [] ) {
    let url = `https://api.hypixel.net/${page}?key=${key}`
    // this is my handling of adding other args that work
    // in urls, its not perfect but it works well here
    if (extraArgs != []) {
        for(let i = 0; i < extraArgs.length; i++) {
            url += `&${extraArgs[i].key}=${extraArgs[i].val}`
        }
    }

    // this next section of code results in the ability
    // for me to make api requests without sleeping after 
    // each request. I like this because it allows me to 
    // use my key an unexpected amount of times without 
    // any issues, it allow can improve the speed of the
    // requests due to the amount of time to get data from
    // the hypixel api being uncertain other than it is !0

    // flag if the request was successful
    let success = false;
    // data needs to be outside the loop because it is the return
    let data = '';
    while(!success) {
        // raw data from hypixel api endpoint
        data = await getData(url);
        // json data
        let json = JSON.parse(data);

        // upon the data not having the response needed
        if(json.success == false && json.throttle == true) {
            // current time so I can see difference in logs

            console.error(`${utils.daytime()}ERROR: ${json.cause.toUpperCase()}, WAITING ${failDelay}ms AND RETRYING...`);
            // sleep for 1 second and retry getting the data
            await sleep(failDelay);
            success = false;
        } else {
            // allow the loop to end
            success = true;
        }
    }
    return data;
} 

async function getStatusRAW(uuid) {
    return await basicRequest('status', [{ key : 'uuid', val : uuid}] );
}

async function getAccountDataRaw(uuid) {
    return await basicRequest('player', [{ key : 'uuid', val : uuid}] );
}

async function getGameCountsRAW() {
    // dont put empty array since that is automatically done
    return await basicRequest('gameCounts');
}

async function getGuildRaw(id) {
    return await basicRequest('guild', [{ key : 'id', val : id }]);
}

async function getAccountWins(uuid) {
    let data = await getAccountDataRaw(uuid);
    let json = JSON.parse(data);
    // make sure player has stats to be checked
    if(!json.player || !json.player.stats || !json.player.stats.Arcade) {
        return 0;
    }
    let arcade = json.player.stats.Arcade;
    let wins = 0;
    if(arcade.wins_party) wins += arcade.wins_party;
    if(arcade.wins_party_2) wins += arcade.wins_party_2;
    if(arcade.wins_party_3) wins += arcade.wins_party_3;
    return wins;
}

async function getStatus(name) {
    let uuid = await getUUIDFromCache(name);
    // cache miss
    if(!uuid) {
        // store the cache miss for later
        // this helps me identify name changes
        utils.cacheMiss.push(name);
        uuid = getUUID(name);
    }
    
    // account does not exist
    if(!uuid) {
        return undefined;
    }
    let raw = await getStatusRAW(uuid);
    let json = JSON.parse(raw);
    return json.session;
}

module.exports = { getStatusRaw : getStatusRAW, getStatus : getStatus, getGuildRaw : getGuildRaw, getAccountDataRaw : getAccountDataRaw, getGameCountsRAW : getGameCountsRAW, getAccountWins : getAccountWins }
