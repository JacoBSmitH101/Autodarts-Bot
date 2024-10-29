const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
} = require("discord.js");
const {
    fetchTournamentsFromDatabase,
    getTournamentIdByName,
} = require("../../util");
const sqlite3 = require("sqlite3").verbose();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("submit-match")
        .setDescription(
            "Used to submit a match to Challonge pending confirmation"
        )
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The tournament or league name")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption((option) =>
            option
                .setName("match_url")
                .setDescription("URL of the match on AutoDarts")
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("opponent")
                .setDescription("Opponent name")
                .setRequired(true)
        )
        .addNumberOption((option) =>
            option
                .setName("your_score")
                .setDescription("Legs won by you")
                .setRequired(true)
        )
        .addNumberOption((option) =>
            option
                .setName("opponent_score")
                .setDescription("Legs won by opponent")
                .setRequired(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const tournaments = await fetchTournamentsFromDatabase(
            interaction.guildId
        );

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
    },

    async execute(interaction) {
        const tournament = interaction.options.getString("tournament");
        const matchUrl = interaction.options.getString("match_url");
        const opponent = interaction.options.getUser("opponent");
        const submitter = interaction.user;
        const yourScore = interaction.options.getNumber("your_score");
        const opponentScore = interaction.options.getNumber("opponent_score");

        const tournamentId = await getTournamentIdByName(tournament);
        const db = new sqlite3.Database("./data.db", (err) => {
            if (err) {
                console.error("Database connection error:", err.message);
                return interaction.reply("Failed to connect to the database.");
            }
        });

        let match;
        try {
            const submitterChallongeId = await new Promise(
                (resolve, reject) => {
                    db.get(
                        `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                        [submitter.id, tournamentId],
                        (err, row) => {
                            if (err)
                                return reject(
                                    "Failed to retrieve submitter's challonge_id."
                                );
                            resolve(row ? row.challonge_id : null);
                        }
                    );
                }
            );

            const opponentChallongeId = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                    [2 || opponent.id, tournamentId],
                    (err, row) => {
                        if (err)
                            return reject(
                                "Failed to retrieve opponent's challonge_id."
                            );
                        resolve(row ? row.challonge_id : null);
                    }
                );
            });

            if (!submitterChallongeId || !opponentChallongeId) {
                return interaction.reply(
                    "One or both participants are not registered in this tournament."
                );
            }

            match = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT * FROM Matches 
                    WHERE tournament_id = ? 
                    AND ((player1_id = ? AND player2_id = ?) 
                    OR (player1_id = ? AND player2_id = ?))`,
                    [
                        tournamentId,
                        submitterChallongeId,
                        opponentChallongeId,
                        opponentChallongeId,
                        submitterChallongeId,
                    ],
                    (err, row) => {
                        if (err)
                            return reject("Failed to retrieve match details.");
                        resolve(row);
                    }
                );
            });

            if (!match) {
                return interaction.reply(
                    "Match not found for the specified participants."
                );
            }
        } catch (error) {
            console.error("An error occurred:", error);
            interaction.reply(
                "An error occurred while retrieving match details."
            );
        }

        // Placeholder stats for demonstration
        const stats = {
            "180s": 2,
            "100+ Scores": 15,
            "60+ Scores": 25,
            "Checkout %": 65.3,
            "Average Score": 87.4,
        };

        // Embed message with placeholder stats
        const embed = new EmbedBuilder()
            .setColor(0x0000ff)
            .setTitle("Match Submission Pending Confirmation")
            .setDescription(`League: ${tournament}`)
            .addFields(
                {
                    name: "Match URL",
                    value: `[View Match](${matchUrl})`,
                    inline: false,
                },
                {
                    name: "Submitted By",
                    value: `<@${submitter.id}>`,
                    inline: true,
                },
                {
                    name: "Score",
                    value: `${yourScore} - ${opponentScore}`,
                    inline: true,
                }
            )
            .setFooter({ text: `Waiting for ${opponent.tag} approval` })
            .setTimestamp();

        const buttonId = `_${match.match_id}_${submitter.id}_${opponent.id}`;
        const confirmButton = new ButtonBuilder()
            .setCustomId("confirm_confirmMatch" + buttonId)
            .setLabel("Confirm")
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId("reject_confirmMatch" + buttonId)
            .setLabel("Reject")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(
            confirmButton,
            rejectButton
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
