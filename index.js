#!/bin/node

const fs = require('fs');
const oldAccounts = JSON.parse(fs.readFileSync("./accounts.json"));
const gameAmount = require("./src/gameAmount")
const Webhook = require('./src/webhook');
const { getUUID } = require('./src/mojangRequest');
const { getAccountWins } = require('./src/hypixelApi');
const args = process.argv;
const utils = require('./src/utils');
const sleep = utils.sleep;
const winsSorter = utils.winsSorter;
const logger = utils.logger;

// So you may be wondering, "why use such a horrible config 
// format venom?" Well you see this is a nodejs project, this
// means that if I start adding all kinds of modules, this 
// will become an issue really fast. So this is my way of not
// bloating this project with node modules and shit. 
const config = require('./config.json');

let { accounts, gamers, afkers } = require("./src/acclist");

// a module that exports an array of player objects from the player module
let players = require("./src/playerlist")(accounts);
let guilds = require("./src/guildlist")(accounts);
let status = require("./src/status");

// set flag for force file
let force = (fs.existsSync("./force") || config.alwaysForce);

async function updateAllAccounts(){
    // sort this before hand because otherwise everything dies
    // like seriously holy fuck its so bad
    // oogle ended up with 21k wins due to this bug
    // do not remove this
    // people will notice
    // just take the extra time
    sortAccounts();
    oldAccounts.sort(winsSorter);

    for(let i=0;i<accounts.length;i++){
        // check if player is online before updating wins
        // or if the force file has been added to make sure
        // all wins are updated
        if(status.isOnlineC(accounts[i].uuid) || force) {
            await accounts[i].updateData();
        } else {
            // fallback for new accounts
            oldver = oldAccounts.find(g=>g.uuid.toLowerCase()==accounts[i].uuid.toLowerCase())
            if(oldver != undefined) {
                // use previous wins if the player was not online
                accounts[i].wins = oldver.wins;
            } else {
                await accounts[i].updateData();
            }
        }
    }
    sortAccounts();
}

async function updateAllPlayers() {
    for(let i=0;i<players.length;i++){
        await players[i].updateWins();
    }

    sortPlayers();
}

async function updateAllGuilds() {
    for(let i=0;i<guilds.length;i++){
        await guilds[i].updateWins();
    }

    sortGuilds();
}

// just some wrappers because this was abstracted

function sortPlayers() {
    players.sort(winsSorter);
}

function sortGuilds() {
    guilds.sort(winsSorter);
}

function sortAccounts() {
    accounts.sort(winsSorter);
}

async function updateAll() {
    await updateAllAccounts();
    await updateAllPlayers();
    await updateAllGuilds();
}

async function txtPlayerList(list,maxamnt = -1){
    let str="";
    let len = (maxamnt != -1) ? maxamnt : list.length;
    for(let i = 0;i < len; i++){
        // don't print if player has 0 wins
        if(list[i].wins < 1 || config.printAllWins) continue;
        
        // this hack is because js has no real string formatting and its
        // not worth it to use wasm or nodenative for this
        let num = (
            "000"
            +(i+1)
        )
        .slice(-3);
        
        let name = (
            list[i].name
            	.slice(0,1)
            	.toUpperCase()
            + list[i].name
            	.slice(1)
            + "                       "
        ).slice(0,17);
        str+=`${num}) ${name}: ${list[i].wins}\n`;
    }
    return str;
}

async function save() {
    // get up to date info
    await updateAll();
    // write new data to json files to be used later
    fs.writeFileSync("accounts.json",JSON.stringify(accounts,null,4));
    fs.writeFileSync("players.json",JSON.stringify(players,null,4));
    fs.writeFileSync("guild.json",JSON.stringify(guilds,null,4));
}

async function listNormal(name, maxamnt) {
    let list = JSON.parse(fs.readFileSync(`${name}.json`));
    list.sort(winsSorter);
    list = list.slice(0,maxamnt);
    return list;
}

async function stringNormal(name,maxamnt) {
    let list = await listNormal(name,maxamnt);
    return await txtPlayerList(list);
}

async function logNormal(name) {
    logger.out(await stringNormal(name));
}

// wrappers because I abstracted this
async function logG() {
    await logNormal("guild");
}

async function logP() {
    await logNormal("players");
}

async function logA() {
    await logNormal("accounts");
}

async function webhookLog(type = 'players', maxamnt) {
    // send webhook messages, this is only currently 
    // in a small server and only does the unofficial 
    // leaderboard, this can be easily changed and if
    // someone else would like I can add this to 
    // another server

    await Webhook.send(await stringNormal(type, maxamnt));
    await Webhook.send(await stringDaily(type, maxamnt));
}

async function webhookEmbed(type = 'players', maxamnt) {
    // send webhook messages, this is only currently 
    // in a small server and only does the unofficial 
    // leaderboard, this can be easily changed and if
    // someone else would like I can add this to 
    // another server

    let normal = await listNormal(type,maxamnt);
    let day = await listDiff(type,'day',maxamnt);

    await Webhook.sendEmbed("WINS", normal);
    await Webhook.sendEmbed("DAILY", day);
}

/**
 * This is here because i abstracted this to archive
 * @param {String} timeType - the inbetween of the file
 */
async function snap(timeType = 'day') {
    // move all the current stats files to be the daily files
    await archive('./',timeType);
}

async function listDiff(name, timetype, maxamnt) {
    let newlist = JSON.parse(fs.readFileSync(`${name}.json`));
    let oldlist = JSON.parse(fs.readFileSync(`${name}.${timetype}.json`));

    // sort the list before hand
    oldlist = oldlist.sort(winsSorter);

    for(let i=0;i<oldlist.length;i++) {
        acc = newlist.find(g=>g.name.toLowerCase()==oldlist[i].name.toLowerCase())
        // make sure acc isnt null/undefined
        if (acc) {
            oldlist[i].wins = acc.wins - oldlist[i].wins;
        }
    }

    // use old list to ensure that players added today 
    // don't show up with a crazy amount of daily wins
    oldlist = oldlist.sort(winsSorter);
    return oldlist.slice(0,maxamnt);
}

async function stringDiff(name,timetype, maxamnt) {
    let list = await listDiff(name,timetype);
    return await txtPlayerList(list);
}

async function stringDaily(name,maxamnt) {
    return await stringDiff(name,'day',maxamnt);
}

async function logDaily(name) {
    logger.out(await stringDaily(name));
}

//more abstracted methods

async function logGD() {
    await logDaily("guild");
}

async function logPD() {
    await logDaily("players");
}

async function logAD() {
    await logDaily("accounts");
}

async function genStatus() {
    // old status
    let oldstatus = JSON.parse(fs.readFileSync('status.json'));
    // string at start
    let gamerstr = '';
    // string at end
    let nongamers = '';
    for(let i = 0; i < accounts.length; i++) {
        if(gamers.includes(accounts[i])) {
            gamerstr += await status.txtStatus(accounts[i].uuid);
        } else if(!force && afkers.includes(accounts[i])) {
            // get old status instead
            let old = oldstatus[accounts[i].uuid];
            if (old == undefined) {
                nongamers += await status.txtStatus(accounts[i].uuid);
            } else {
                nongamers += await status.genStatus(accounts[i].name, oldstatus[accounts[i].uuid]);
            }
        } else { // force true or not afker
            nongamers += await status.txtStatus(accounts[i].uuid);
        }
        
    }

    // write formatted
    fs.writeFileSync("status.txt",gamerstr + "\nNon gamers: \n\n" + nongamers);
    // write object 
    fs.writeFileSync("status.json",JSON.stringify(status.rawStatus,null,4));
    // store the cache misses
    fs.writeFileSync("cachemiss.json", JSON.stringify(utils.cacheMiss,null,4));
}

/**
 * @function - Generate uuids for all the accounts in the accounts list
 * @see acclist
 */
async function genUUID() {
    let uuids = {};
    for(let i = 0; i<accounts.length; i++) {
        logger.out(accounts[i].name)
        uuids[accounts[i].name] = await getUUID(accounts[i].name);
        // make sure no more than 600 requests are sent per 10 minutes
        // this is the mojang api limitation
        await sleep(config.mojang.sleep);
    }
    fs.writeFileSync("uuids.json", JSON.stringify(uuids,null,4));
}

/**
 * @function gameAmnt - reflects the amount of players in various hypixel games
 */
async function gameAmnt() {
    // write to file so that there isnt blank files in website at any point
    fs.writeFileSync('games.txt',gameAmount.formatCounts())
}

async function newAcc() {
    let name = args[3]
    let uuid = await getUUID(name);
    let wins = await getAccountWins(uuid);
    let formattedname = ('"'+name+'",                         ').slice(0,20)
    let formattedWins = (wins+',   ').slice(0,4);
    logger.out(`new Account(${formattedname}${formattedWins}"${uuid}"),`);
}

async function archive(path = './archive/', timeType = utils.day()) {
    await utils.archiveJson('guild',path,timetype);
    await utils.archiveJson('players',path,timetype);
    await utils.archiveJson('accounts',path,timetype);
}

async function writeFile(args) {
    let logName = args[3];
    let location = args[4];
    let str = await stringNormal(logName) 

    fs.writeFileSync(location,str);
}

async function writeFileD(args) {
    let logName = args[3];
    let location = args[4];
    let str = await stringDaily(logName);

    fs.writeFileSync(location,str);
}

// wrap main code in async function for nodejs backwards compatability

async function main(){
    // use different functions for different args
    // switch has one x86 instruction vs multiple for if statements
    switch (args[2]) {
        case 'logG':        await logG();                               break;
        case 'logA':        await logA();                               break;
        case 'logP':        await logP();                               break;
        case 'logGD':       await logGD();                              break;
        case 'logPD':       await logPD();                              break;
        case 'logAD':       await logAD();                              break;

        case 'write':       await writeFile(args);                      break;
        case 'writeD':      await writeFileD(args);                     break;

        case 'save':        await save();                               break;
        case 'snap':        await snap(args[3]);                        break;
        case 'status':      await genStatus();                          break;
        case 'discord':     await webhookLog(args[3], args[4]);         break;
        case 'discordE':    await webhookEmbed(args[3], args[4]);       break;
        case 'genUUID':     await genUUID();                            break;
        case 'games':       await gameAmnt();                           break;
        case 'newAcc':      await newAcc();                             break;
        case 'archive':     await archive();                            break;
    }
}

main();
