const {
    getLiveMatchDataFromAutodartsMatchId,
    getLocalMatchFromMatchId,
    updateLiveInteraction,
    updateLocalMatch,
    saveAdStats,
    deleteLiveMatch,
} = require("../../datamanager");
const axios = require("axios");
const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("finishmatch")
        .setDescription("Manually finish an Autodarts match and update stats.")
        .addStringOption((option) =>
            option
                .setName("autodarts-match-url")
                .setDescription("URL of the Autodarts match")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const matchUrl = interaction.options.getString("autodarts-match-url");
        const matchId = matchUrl.split("/").pop();
        console.log(matchId);

        try {
            const match = await getLiveMatchDataFromAutodartsMatchId(
                matchUrl.split("/").pop()
            );
            // if (!match) {
            //     return interaction.editReply("No match found with this URL.");
            // }

            const matchStatsUrl = `https://api.autodarts.io/as/v0/matches/${matchId}/stats`;
            const headers = {
                Authorization: `Bearer ${interaction.client.keycloakClient.accessToken}`,
            };

            const statsResponse = await axios.get(matchStatsUrl, { headers });
            const stats = await statsResponse.data;

            const db_match = await getLocalMatchFromMatchId(match.match_id);

            // Check if match is already marked as complete
            if (db_match.state === "complete") {
                return interaction.editReply("Match is already completed.");
            }

            // Build the embed with match details
            const embed = new EmbedBuilder()
                .setColor(
                    stats.data.scores[0].legs === stats.data.scores[1].legs
                        ? "#ffaa00"
                        : "#00ff00"
                )
                .setTitle("🎯 Match Finished!")
                .setDescription(
                    `Match between ${stats.data.players[0].name} and ${stats.data.scores[1].name} is completed.`
                )
                .addFields(
                    {
                        name: stats.data.players[0].name,
                        value: `Legs Won: ${
                            stats.data.scores[0].legs
                        }\nAverage: ${stats.data.scores[0].average.toFixed(2)}`,
                        inline: true,
                    },
                    {
                        name: stats.data.players[1].name,
                        value: `Legs Won: ${
                            stats.data.scores[1].legs
                        }\nAverage: ${stats.data.scores[1].average.toFixed(2)}`,
                        inline: true,
                    }
                )
                .setTitle("🎯 Match Finished!")
                .setDescription(
                    `Match results have been updated. [View Match](${matchUrl})`
                );

            await interaction.editReply({ embeds: [embed] });

            const winnerIndex = stats.data.winner;
            const winnerUserId =
                winnerIndex !== null
                    ? stats.data.players[winnerIndex].id
                    : null;
            const winnerChallongeId =
                winnerIndex !== null
                    ? winnerIndex === 0
                        ? db_match.player1_id
                        : db_match.player2_id
                    : "tie";

            const scores_csv = `${stats.data.scores[0].legs}-${stats.data.scores[1].legs}`;

            // Update match details in local DB
            await updateLocalMatch({
                matchId: matchId,
                db_match: db_match,
                scores_csv,
                winnerChallongeId,
                state: "complete",
            });

            // Save match stats to DB
            await saveAdStats(
                db_match.match_id,
                db_match.tournament_id,
                stats.data
            );

            // Cleanup live match entry
            await deleteLiveMatch(matchId);
        } catch (error) {
            console.error(error);
            await interaction.editReply(
                "An error occurred while finishing the match. Please contact an admin."
            );
        }
    },
};
