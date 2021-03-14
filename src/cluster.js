const config = require("../config.json");
const task = require("./task");
const { logger } = require("./utils");
const { exec } = require("child_process");

/**
 * Run a shell command
 *
 * @param {String} command
 * @return {String}
 */
function run(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            resolve(stdout);
            if (err) {
                logger.err(stderr);
                reject(err);
            }
        });
    });
}

class clusterClient {
    /**
     * The cluster name
     *
     * @memberof clusterClient
     */
    name = "";

    /**
     * The key the cluster uses
     *
     * @memberof clusterClient
     */
    key = "";

    /**
     * The tasks for the cluster to execute
     *
     * @memberof clusterClient
     */
    tasks = [];

    /**
     * The files this cluster affects
     *
     * @memberof clusterClient
     */
    files = [];

    /**
     * Creates an instance of clusterClient.
     * @param {String} name
     * @memberof clusterClient
     */
    constructor(name) {
        this.name = name;
        this.key = config.clusters[name].key;
        this.tasks = config.clusters[name].tasks;
    }

    /**
     * Execute all of the tasks this cluster has
     *
     * @memberof clusterClient
     */
    async doTasks() {
        for (let t of this.tasks) {
            logger.out("Executing task " + t);
            this.files.concat(await task[t]());
        }
    }

    /**
     * Send the updated data to the main cluster
     *
     * @memberof clusterClient
     */
    async uploadData() {
        if (this.name != "main") {
            for (let file of this.files) {
                await run(
                    `rsync -a --rsh=ssh ${file} ${config.cluserTarget}/${file}`
                );
            }
        }
    }
}

module.exports = clusterClient;
