let help = require("./Commands/Help");
let cs = help.options[0].choices;
help.options[0].choices = [ cs[0], cs[3], cs[7] ];
exports.help = help;

let statsCommand = require("./Commands/Stats");
statsCommand.options[0].required = true;
exports.statsCommand = statsCommand;

exports.compare = require("./Commands/Compare");
exports.info = require("./Commands/Info");
exports.gamecounts = require("./Commands/GameCounts");

let namehistory = require("./Commands/NameHistory");
namehistory.options[0].required = true;

let profile = require("./Commands/Profile");
profile.options[0].required = true;
exports.profile = profile;

let topgames = require("./Commands/TopGames");
topgames.options[0].required = true;
exports.topgames = topgames;

let arcade = require("./Commands/Arcade");
arcade.options = [ arcade.options[2], arcade.options[3] ];
exports.arcade = arcade;