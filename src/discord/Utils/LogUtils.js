const { Message, Webhook } = require("discord.js");
const Webhooks = require("./Webhooks");
const config = require("../../Config");
const { LOG_COMMAND_EXECUTION } = require("./Embeds/DynamicEmbeds");
const cfg = config.fromJSON();

module.exports = class LogUtils {

    /**
     * Log a message when someone types in a specifed ign channel
     * @param {Message} msg 
     */
    static async logIgns(msg) {
        let channelID = msg.channel.id;
        for (let c of cfg.discord.listenChannels) {
            if (channelID == c) {
                await LogUtils.logcopy(msg, Webhooks.ignHook);
            }
        }
    }

    /**
     * 
     * @param {Message} msg 
     * @param {Webhook} hook 
     */
    static async logcopy(msg, hook) {
        let pfp = msg.author.avatarURL();
        let name = "unknown";
        if (msg.member) {
            name = msg.member.displayName;
        }

        await hook.send({ content: msg.content, username: name, avatarURL: pfp });
        await hook.send({ content: msg.url, username: name, avatarURL: pfp });
    }

    /**
     * Log a command run
     * @param {String} command The command that was run
     * @param {String} args The arguments used with the command
     * @param {Message} message The message object that the command came from
     */
    static async logCommand(command, args, message) {
        await Webhooks.commandHook.send({ embeds: [LOG_COMMAND_EXECUTION(command, args, message)] });
    }
}