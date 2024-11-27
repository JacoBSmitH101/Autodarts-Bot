const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getAdStats } = require("../../datamanager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("match-stats")
        .setDescription("Display stats for a specific match.")
        .addIntegerOption((option) =>
            option
                .setName("matchid")
                .setDescription("The ID of the match to fetch stats for.")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("tournamentid")
                .setDescription(
                    "The ID of the tournament the match belongs to."
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const matchId = interaction.options.getInteger("matchid");
        const tournamentId = interaction.options.getInteger("tournamentid");

        try {
            // Fetch stats from the database
            const matchData = await getAdStats(matchId, tournamentId);

            if (!matchData) {
                return interaction.reply({
                    content: "No data found for this match and tournament.",
                    ephemeral: true,
                });
            }

            const player1 = matchData.players[0];
            const player2 = matchData.players[1];
            const stats1 = matchData.matchStats[0];
            const stats2 = matchData.matchStats[1];

            // Initialize counters for specific scores
            const specificScores = [26, 60, 180];
            const scoreCounts = {
                [player1.id]: { 26: 0, 60: 0, 180: 0 },
                [player2.id]: { 26: 0, 60: 0, 180: 0 },
            };

            // Process all games except the last two
            const games = matchData.games.slice(0, -2); // Exclude last two games
            games.forEach((game) => {
                game.turns.forEach((turn) => {
                    if (specificScores.includes(turn.score)) {
                        scoreCounts[turn.playerId][turn.score] += 1;
                    }
                });
            });

            // Embed creation
            const embed = new EmbedBuilder()
                .setTitle(`Match Statistics: Match ID ${matchId}`)
                .setColor(0x3498db)
                .addFields(
                    {
                        name: "Matchup",
                        value: `**${player1?.name || "Player 1"}** vs **${
                            player2?.name || "Player 2"
                        }**`,
                        inline: false,
                    },
                    {
                        name: "Score",
                        value: `${matchData.scores[0]?.legs || 0} - ${
                            matchData.scores[1]?.legs || 0
                        }`,
                        inline: false,
                    },
                    {
                        name: "Player Stats",
                        value: `**180s**: ${stats1?.total180 || 0} vs ${
                            stats2?.total180 || 0
                        }\n**Average**: ${
                            stats1?.average?.toFixed(2) || "N/A"
                        } vs ${
                            stats2?.average?.toFixed(2) || "N/A"
                        }\n**Checkout %**: ${
                            (stats1?.checkoutPercent * 100).toFixed(2) || "0.00"
                        } vs ${
                            (stats2?.checkoutPercent * 100).toFixed(2) || "0.00"
                        }\n**Highest Checkout**: ${
                            stats1?.checkoutPoints || "0"
                        } vs ${stats2?.checkoutPoints || "0"}`,
                        inline: false,
                    },

                    {
                        name: "Specific Scores",
                        value: `**${player1?.name || "Player 1"}**:\n26: ${
                            scoreCounts[player1.id][26]
                        }, 60: ${scoreCounts[player1.id][60]}, 180: ${
                            scoreCounts[player1.id][180]
                        }\n\n**${player2?.name || "Player 2"}**:\n26: ${
                            scoreCounts[player2.id][26]
                        }, 60: ${scoreCounts[player2.id][60]}, 180: ${
                            scoreCounts[player2.id][180]
                        }`,
                        inline: false,
                    }
                )
                .setFooter({ text: "Darts League Stats" });

            // Add a thumbnail if available
            if (matchData.host?.avatarUrl) {
                embed.setThumbnail(matchData.host.avatarUrl);
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error fetching match stats:", error);
            return interaction.reply({
                content:
                    "An error occurred while fetching the stats. Please try again later.",
                ephemeral: true,
            });
        }
    },
};
