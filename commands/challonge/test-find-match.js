//testing command to search through all the posts in all forum channels to find a match
//match found with const matchId = thread.name.match(/\[ID:(\d+)\]/)?.[1];

const { SlashCommandBuilder } = require("@discordjs/builders");
const { fetchTournamentsFromDatabase } = require("../../util");
const {
    getTournamentIdByName,
    getDivisionNumbers,
    getNameFromChallongeId,
    getUserIdFromAutodartsId,
    getUserIdFromChallongeId,
} = require("../../testdatamanager");
const { getAllMatchesFromTournamentId } = require("../../testdatamanager");
const {
    ChannelType,
    PermissionFlagsBits,
    ThreadAutoArchiveDuration,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("test-find-match")
        .setDescription("Finds a match in a tournament")

        .addStringOption((option) =>
            option
                .setName("match_id")
                .setDescription("ID of the match")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        try {
            // Fetch all channels in the guild
            const channels = await interaction.guild.channels.fetch();

            // Filter for GuildForum channels
            const forumChannels = channels.filter(
                (channel) => channel.type === ChannelType.GuildForum
            );

            if (forumChannels.size === 0) {
                return interaction.reply({
                    content: "No forum channels found in this guild.",
                    ephemeral: true,
                });
            }

            for (const [channelId, forumChannel] of forumChannels) {
                // Add the forum channel name to the response

                // Fetch active threads in the forum channel
                const threads = await forumChannel.threads.fetchActive();

                if (threads.size === 0) {
                    continue;
                }

                // List all threads (forum posts)
                for (const [threadId, thread] of threads.threads) {
                    // check if the thread contains the match id
                    const matchId = thread.name.match(/\[ID:(\d+)\]/)?.[1];
                    if (matchId === interaction.options.getString("match_id")) {
                        // send a message in that thread
                        await thread.send({
                            content: "Match found!",
                        });
                    }
                }
            }

            // Send the response
            await interaction.reply({
                content: "cool",
                ephemeral: true, // Set to false if you want everyone to see the output
            });
        } catch (error) {
            console.error("Error listing forum posts:", error);
            await interaction.reply({
                content: "There was an error retrieving forum posts.",
                ephemeral: true,
            });
        }
    },
};
