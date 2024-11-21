const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const { fetchTournamentsFromDatabase } = require("../../util");
const {
    getTournamentIdByName,
    getParticipantDataFromTournamentUserId,
    removeParticipantFromTournament,
    getAllMatchesForPlayer,
    updateLocalMatch,
    getTournamentStatus,
} = require("../../datamanager");
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

        try {
            // Step 1: Retrieve tournament_id and participant details
            const tournamentId = await getTournamentIdByName(tournamentName);

            if (!tournamentId) {
                return interaction.reply(
                    "Tournament not found in the database."
                );
            }
            const participantRow = await getParticipantDataFromTournamentUserId(
                tournamentId,
                discordId
            );

            if (!participantRow) {
                return interaction.reply(
                    "You are not registered in this tournament."
                );
            }

            const challongeParticipantId = participantRow.challonge_id;
            const participantId = participantRow.participant_id;
            console.log("challongeParticipantId");
            console.log(challongeParticipantId);
            const tournamentStatus = await getTournamentStatus(tournamentId);
            // Step 2: Remove participant from Challonge
            const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants/${participantId}.json`;
            const params = { api_key: process.env.API_KEY };

            if (tournamentStatus == "started") {
                //award wins to the other player 4-0 and update in challong etc
                //then mark the participant as dropped out in status
                //get the matches of the participant
                const matches = await getAllMatchesForPlayer(
                    challongeParticipantId,
                    tournamentId
                );
                for (const match of matches) {
                    if (match.state == "complete") {
                        continue;
                    }
                    console.log(match);
                    const matchId = match.match_id;
                    const opponentId =
                        match.player1_id == challongeParticipantId
                            ? match.player2_id
                            : match.player1_id;
                    const isPlayer1 =
                        match.player1_id == challongeParticipantId;
                    const opponentRow =
                        await getParticipantDataFromTournamentUserId(
                            tournamentId,
                            opponentId
                        );
                    const scores_csv = isPlayer1 ? "0-2" : "2-0";
                    const winnerId = opponentId;
                    const data = {
                        match: {
                            scores_csv,
                            winner_id: winnerId,
                        },
                    };
                    const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/matches/${matchId}.json`;
                    const res = await axios.put(apiUrl, data, { params });
                    console.log(res.data);
                    const matchInfo = {
                        winnerChallongeId: winnerId,
                        state: "forfeit",
                        scores_csv: scores_csv,
                        matchId: matchId,
                        db_match: {
                            match_id: matchId,
                        },
                    };

                    await updateLocalMatch(matchInfo);
                }
            }
            try {
                //TODO (currently crashes challonge tournament for some reason)
                //await axios.delete(apiUrl, { params });
            } catch (error) {
                console.error("API error:", error.data);
                return interaction.reply(
                    "Failed to drop out from the tournament on Challonge."
                );
            }
            // Step 3: Remove participant from the local database
            try {
                const status = getTournamentStatus(tournamentId);
                if (status == "pending") {
                    await removeParticipantFromTournament(
                        tournamentId,
                        discordId
                    );
                }

                //create an embed
                const embed = new EmbedBuilder()
                    .setTitle("Dropped out from the tournament")
                    .setDescription(
                        `You have successfully dropped out from the tournament **${tournamentName}**.`
                    )
                    .setFooter({ text: "Tournament ID: " + tournamentId })
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
