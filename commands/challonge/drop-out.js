const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const { fetchTournamentsFromDatabase } = require("../../util");
const {
    getTournamentIdByName,
    getParticipantDataFromTournamentUserId,
    removeParticipantFromTournament,
} = require("../../testdatamanager");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("drop-out")
        .setDescription("Drop out from a tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("Tournament name to drop out from")
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        //TODO if player drops out mid tournament, update the matches to give 2-0 wins to the other player so they get 4 points
        const tournamentName = interaction.options.getString("tournament");
        const discordId = interaction.user.id;

        // Connect to SQLite database

        try {
            // Step 1: Retrieve tournament_id and participant details
            const tournamentRow = await getTournamentIdByName(tournamentName);

            if (!tournamentRow) {
                return interaction.reply(
                    "Tournament not found in the database."
                );
            }

            const participantRow = await getParticipantDataFromTournamentUserId(
                tournamentRow,
                discordId
            );

            if (!participantRow) {
                return interaction.reply(
                    "You are not registered in this tournament."
                );
            }

            const challongeParticipantId = participantRow.participant_id;

            // Step 2: Remove participant from Challonge
            const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentRow}/participants/${challongeParticipantId}.json`;
            const params = { api_key: process.env.API_KEY };
            await axios.delete(apiUrl, { params });

            if (tournamentRow.status == "started") {
                //award wins to the other player 4-0 and update in challong etc
                //then mark the participant as dropped out in status
                //get the matches of the participant
            }

            // Step 3: Remove participant from the local database
            try {
                await removeParticipantFromTournament(tournamentRow, discordId);
                //create an embed
                const embed = new EmbedBuilder()
                    .setTitle("Dropped out from the tournament")
                    .setDescription(
                        `You have successfully dropped out from the tournament **${tournamentName}**.`
                    )
                    .setFooter({ text: "Tournament ID: " + tournamentRow })
                    .setColor(0xff0000);

                return interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error("Database error:", error.message);
                return interaction.reply(
                    "Failed to drop out from the tournament in the database."
                );
            }
        } catch (error) {
            if (error.response) {
                // API returned an error
                console.error("API error:", error.response.data);
                interaction.reply(
                    "Failed to drop out from the tournament on Challonge."
                );
            } else if (error.request) {
                // No response from Challonge
                console.error("No response from Challonge API:", error.request);
                interaction.reply(
                    "No response from Challonge. Please try again."
                );
            } else {
                // General error
                console.error("Error:", error.message);
                interaction.reply(
                    "An unexpected error occurred. Please try again."
                );
            }
        }
    },

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
};
