const cfg = require("hyarcade-config").fromJSON();
const { WebhookClient, TextChannel, Guild } = require("discord.js");
const Runtime = require("hyarcade-config/Runtime");
const logger = require("hyarcade-logger");
const BotUtils = require("./BotUtils");
const registerSlashCommands = require("./registerSlashCommands");
const roleHandler = require("./roleHandler");
const fs = require("fs-extra");
const Webhooks = require("./Utils/Webhooks");
const SetPresence = require("./Utils/SetPresence");

module.exports = class BotEvents {
    static async rateLimit(rlInfo) {
        let timeout = rlInfo.timeout;
        let str = `Bot rate limited\nTime : ${timeout}\nCause : ${rlInfo.method.toUpperCase()} - ${rlInfo.path}\n`;
        logger.err(str);
        try {
            await Webhooks.errHook.send(str);
        } catch (e) {
            logger.err("Can't log to error hook");
        }
    }

    static async messageDelete(msg) {
        if(BotUtils.botMode == "mw") {
            if (msg.content.charAt(0) == ".") {
                let str = `Command Deleted: ${msg.guild.name}#${msg.channel.name} ${msg.author.tag} - ${msg.content} `;
                logger.warn(str);
                await Webhooks.logHook.send(str);
            }
        } else {
            if(msg.content.charAt(0) == cfg.commandCharacter) {
                let str = `Command Deleted: ${msg.guild.name}#${msg.channel.name} ${msg.author.tag} - ${msg.content} `;
                logger.warn(str);
                await Webhooks.logHook.send(str);
            }
        }
    }

    static async ready(mode) {
        BotUtils.isBotInstance = true;
        BotUtils.botMode = mode;
    
        logger.info("Fetching logging channels");
        let errchannel = await BotUtils.client.channels.fetch(cfg.discord.errChannel);
        let logchannel = await BotUtils.client.channels.fetch(cfg.discord.logChannel);

        logger.info("Fetching logging hooks");
        let errhooks = await errchannel.fetchWebhooks();
        let loghooks = await logchannel.fetchWebhooks();
        let errHook = await errhooks.first();
        let logHook = await loghooks.first();
        Webhooks.errHook = errHook;
        Webhooks.logHook = logHook;
        logger.info("Creating message copy hook");
        Webhooks.commandHook = new WebhookClient(cfg.loggingHooks.copyHook.id, cfg.loggingHooks.copyHook.token);

        logger.info("Reading trusted users");
        let trustedFile = await fs.readFile('data/trustedUsers');
        let tus = trustedFile.toString().trim().split("\n");
        BotUtils.tus = tus;

        logger.info("Selecting mode");
        if (mode == "role") {
            await roleHandler(BotUtils.client);
            await BotUtils.client.destroy();
        } else if (mode == "slash") {
            await registerSlashCommands(BotUtils.client);
            logger.out(`Logged in as ${BotUtils.client.user.tag} - Interaction module`);
            logHook.send(`Logged in as ${BotUtils.client.user.tag} - Interaction module`);
        } else if (mode == "mini") {
            await registerSlashCommands(BotUtils.client);
            logger.out(`Logged in as ${BotUtils.client.user.tag} - Micro module`);
            logHook.send(`Logged in as ${BotUtils.client.user.tag} - Micro module`);
        } else if (BotUtils.botMode == "mw") {
            logger.out(`Logged in as ${BotUtils.client.user.tag} - MW module`);
            logHook.send(`Logged in as ${BotUtils.client.user.tag} - MW module`);
        } else if(BotUtils.botMode == "test") {
            await registerSlashCommands(BotUtils.client);
            logger.out(`Logged in as ${BotUtils.client.user.tag}!`);
            logHook.send(`Logged in as ${BotUtils.client.user.tag}!`);
        } else {
            logger.out(`Logged in as ${BotUtils.client.user.tag}!`);
            logHook.send(`Logged in as ${BotUtils.client.user.tag}!`);
        }
        await SetPresence(BotUtils.client, mode);
    }

    static async tick() {
        let runtime = Runtime.fromJSON();
        if (runtime.needRoleupdate && BotUtils.botMode == undefined) {
            await roleHandler(BotUtils.client);
            await Webhooks.logHook.send("Roles Updated");
            runtime.needRoleupdate = false;
            await runtime.save();
        }
    }

    static async heartBeat() {
        let runtime = Runtime.fromJSON();
        runtime[BotUtils.botMode + "HeartBeat"] = Date.now();
        await runtime.save();
        logger.info("Heart beat - I'm alive!");
    }

    static warn(info) {
        logger.warn(`Discord sent a warning:`);
        logger.warn(info);
    }

    static invalidated() {
        logger.error("Discord session invalidated!");
    }

    /**
     * 
     * @param {Guild} guild 
     */
    static guildCreate(guild) {
        logger.out(`Bot was added to guild ${guild.name} with ${guild.memberCount} members!`);
        logger.debug(`Guild owner: ${guild.ownerID}`);
        logger.debug(`Guild ID: ${guild.id}`);
    }

    /**
     * 
     * @param {Error} error 
     */
    static error(error) {
        logger.err("Discord encountered an error");
        logger.err(`${error.name} : ${error.message}`);
        logger.err(`Current stack:\n${error.stack}`);
    }

    /**
     * 
     * @param {TextChannel} channel 
     */
    static webhookUpdate(channel) {
        logger.debug(`${channel.guild.name}#${channel.name} had a webhook change`);
    }

    /**
     * 
     * @param {Guild} guild 
     */
    static guildUnavailable(guild) {
        logger.warn(`Guild ${guild.name} has become unavailable!`)
    }

    /**
     * 
     * @param {import("discord.js").InvalidRequestWarningData} warning 
     */
    static invalidRequestWarning(warning) {
        logger.warn(`An invalid request was made, this is number ${warning.count}!`)
    }

    static debug(info) {
        logger.debug(info);
    }

    static async cyclePresence() {
        logger.info("Cycling presence...");
        await SetPresence(BotUtils.client, BotUtils.botMode);
    }
};
