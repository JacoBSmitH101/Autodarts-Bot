const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");
const {
    fetchTournamentsFromDatabase,
    getTournamentIdByName,
} = require("../../util");
const sqlite3 = require("sqlite3").verbose();

const { getSortedParticipants } = require("./show-seeds");
const { autocomplete } = require("./sign-up");
const { updateParticipantMatchPlayerIdsAndMatches } = require("../../util");
const axios = require("axios");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("start-tournament")
        .setDescription("Begin a league/tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The name of the tournament.")
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async autocomplete(interaction) {
        if (interaction.options.getFocused(true).name === "tournament") {
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

    async execute(interaction) {
        const tournamentName = interaction.options.getString("tournament");
        const tournamentId = await getTournamentIdByName(tournamentName);

        if (!tournamentId) {
            return interaction.reply(
                `Tournament "${tournamentName}" not found.`
            );
        }

        //use challonge API to start the tournament
        //and use include_matches=1 to get the matches and put them in the database
        //POST https://api.challonge.com/v1/tournaments/{tournament}/start.{json|xml}

        //TODO
        //For season 2 we will just start manually and then run this command
        // const apiURL = `https://api.challonge.com/v1/tournaments/${tournamentId}/start.json`;
        // const params = {
        //     api_key: process.env.API_KEY, // Replace with your actual API key
        // };
        // const response = await axios.post(apiURL, null, { params });

        // if (response.status !== 200) {
        //     return interaction.reply("Failed to start the tournament.");
        // }
        // console.log(response.data);
        updateParticipantMatchPlayerIdsAndMatches(tournamentId);
        await interaction.reply(`Tournament "${tournamentName}" started.`);
    },
};
