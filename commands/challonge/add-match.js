const {
    getLocalMatchFromMatchId,
    updateLocalMatch,
    saveAdStats,
    deleteLiveMatch,
} = require("../../datamanager");
const axios = require("axios");
const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add-match")
        .setDescription(
            "Manually finish an Autodarts match and update stats. DOES NOT UPDATE CHALLONGE"
        )
        .addStringOption((option) =>
            option
                .setName("autodarts-match-url")
                .setDescription("URL of the Autodarts match")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("score")
                .setDescription(
                    "Manually enter the score (format x-y, first to 4)"
                )
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const matchUrl = interaction.options.getString("autodarts-match-url");
        const scoreInput = interaction.options.getString("score");
        const matchId = matchUrl.split("/").pop();

        if (!/^\d+-\d+$/.test(scoreInput)) {
            return interaction.editReply(
                "Invalid score format. Please enter it as x-y."
            );
        }

        const [score1, score2] = scoreInput.split("-").map(Number);
        if (score1 < 4 && score2 < 4) {
            return interaction.editReply(
                "At least one player must reach 4 legs to complete the match."
            );
        }

        try {
            const channel = interaction.channel;
            const match_id = channel.name.match(/\[ID:(\d+)\]/)?.[1];

            const matchUrl = interaction.options.getString(
                "autodarts-match-url"
            );
            const matchId = matchUrl.split("/").pop();

            const statsResponse = await axios.get(
                `https://api.autodarts.io/as/v0/matches/${matchId}/stats`,
                {
                    headers: {
                        Authorization: `Bearer ${interaction.client.keycloakClient.accessToken}`,
                    },
                }
            );
            const stats = statsResponse.data;

            const db_match = await getLocalMatchFromMatchId(match_id);

            // Check if match is already marked as complete
            if (db_match.completed) {
                return interaction.editReply(
                    "This match is already marked as complete."
                );
            }
            console.log(score1);
            console.log(score2);

            let winnerChallongeId;
            if (score1 > score2) winnerChallongeId = db_match.player1_id;
            else if (score2 > score1) winnerChallongeId = db_match.player2_id;
            else winnerChallongeId = "tie";

            // Update match completion in database
            await updateLocalMatch({
                scores_csv: `${score1}-${score2}`,
                winnerChallongeId: winnerChallongeId,
                state: "complete",
                matchId: match_id,
                db_match: db_match,
            });

            // Save stats if needed
            await saveAdStats(
                db_match.match_id,
                db_match.tournament_id,
                statsResponse.data
            );

            // Delete live match entry
            await deleteLiveMatch(matchId);
            await interaction.editReply("Match manually added successfully.");
        } catch (error) {
            console.error(error);
            await interaction.editReply(
                "Failed to complete the match due to an error."
            );
        }
    },
};
