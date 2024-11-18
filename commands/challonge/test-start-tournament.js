//create command template

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
        .setName("test-start-tournament")
        .setDescription("Starts a test tournament")
        .addStringOption((option) =>
            option
                .setName("tournament_name")
                .setDescription("Name of the tournament")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        //check all the matches in the tournament, then create a forum channel for each group
        fixtureForumChannels = [];
        const tournamentName = interaction.options.getString("tournament_name");
        const tournamentId = await getTournamentIdByName(tournamentName);

        const matches = await getAllMatchesFromTournamentId(tournamentId);
        //get all the different groups
        const groups = new Set();
        for (const match of matches) {
            groups.add(match.group_id);
        }
        //console.log(matches);

        const divisionNumbers = await getDivisionNumbers(tournamentId);

        //create a dictionary of emojis with different colours circles for each division
        const divisionEmojis = {
            1: "🟠",
            2: "🔵",
            3: "🟢",
            4: "🟣",
            5: "🟡",
            6: "🔴",
            7: "⚪",
            8: "⚫",
        };

        //create a forum channel for each group
        for (const group of groups) {
            try {
                // Create a forum channel for each group
                const forumChannel = await interaction.guild.channels.create({
                    name: `${divisionEmojis[divisionNumbers[group]]}division-${
                        divisionNumbers[group]
                    }-fixtures`,
                    type: ChannelType.GuildForum,
                });

                console.log(`Created forum channel: ${forumChannel.name}`);

                // Create forum posts (threads) for each match in the group
                //sort the matches by suggested play order
                matches.sort(
                    (a, b) => b.suggested_play_order - a.suggested_play_order
                );
                for (const match of matches) {
                    if (match.group_id === group) {
                        const suggested_play_order = match.suggested_play_order;
                        const player1_name = await getNameFromChallongeId(
                            match.player1_id
                        );
                        const player2_name = await getNameFromChallongeId(
                            match.player2_id
                        );
                        const player1_discord_id =
                            await getUserIdFromChallongeId(match.player1_id);
                        const player2_discord_id =
                            await getUserIdFromChallongeId(match.player2_id);
                        const thread = await forumChannel.threads.create({
                            name: `Round ${suggested_play_order}: ${player1_name} vs ${player2_name} [ID:${match.match_id}]`,
                            message: {
                                content: `Thread for match between <@${player1_discord_id}> and <@${player2_discord_id}>. Organise your match here!`,
                            },
                        });

                        console.log(
                            `Created thread: ${thread.name} in forum channel: ${forumChannel.name}`
                        );

                        // Add the created thread to the fixtureForumChannels
                        fixtureForumChannels.push(thread);
                    }
                }

                // Add the forum channel to the list
                fixtureForumChannels.push(forumChannel);
            } catch (error) {
                console.error(
                    `Error creating forum channel or thread for group ${group}:`,
                    error
                );
            }
        }

        await interaction.reply("Starting test tournament");
    },

    async autocomplete(interaction) {
        if (interaction.options.getFocused(true).name === "tournament_name") {
            const focusedValue = interaction.options.getFocused();

            // Fetch tournament names from the database
            const tournaments = await fetchTournamentsFromDatabase();

            // Filter tournaments based on user input and limit results to 25
            const filteredTournaments = tournaments
                .filter((tournament) =>
                    tournament.name
                        .toLowerCase()
                        .includes(focusedValue.toLowerCase())
                )
                .slice(0, 25);

            await interaction.respond(
                filteredTournaments.map((tournament) => ({
                    name: tournament.name,
                    value: tournament.name,
                }))
            );
        }
    },
};
