// const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
// const axios = require("axios");
// const { insertNewTournament } = require("../../datamanager");
// const sqlite3 = require("sqlite3").verbose();
// require("dotenv").config();

// module.exports = {
//     data: new SlashCommandBuilder()
//         .setName("testreject")
//         .setDescription("Testing the reject functionality")
//         .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

//     async execute(interaction) {
//         const adminIds = ["414395899570290690"];

//         const moderatorChannelId = "1308144826218188947";

//         if (!adminIds.includes(interaction.user.id)) {
//             return interaction.reply(
//                 "You do not have permission to use this command."
//             );
//         }

//         const moderatorChannel =
//             interaction.guild.channels.cache.get(moderatorChannelId);

//         if (!moderatorChannel) {
//             return interaction.reply("Could not find the moderator channel.");
//         }

//         const message = await moderatorChannel.send(
//             `<@${interaction.user.id}> testing`
//         );
//     },
// };
