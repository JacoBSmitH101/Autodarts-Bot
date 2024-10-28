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

        // Fetch tournament names from the database
        const tournaments = await fetchTournamentsFromDatabase(
            interaction.guildId
        );

        // Filter tournaments based on the user's input and limit results to 25 (Discord's max)
        const filteredTournaments = tournaments
            .filter((tournament) =>
                tournament.name
                    .toLowerCase()
                    .includes(focusedValue.toLowerCase())
            )
            .slice(0, 25);

        // Respond with formatted choices
        await interaction.respond(
            filteredTournaments.map((tournament) => ({
                name: tournament.name,
                value: tournament.name,
            }))
        );
    },

    async execute(interaction) {
        const tournament = interaction.options.getString("tournament");
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
            // Retrieve challonge_id for both submitter and opponent
            const submitterChallongeId = await new Promise(
                (resolve, reject) => {
                    db.get(
                        `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                        [submitter.id, tournamentId],
                        (err, row) => {
                            if (err) {
                                console.error(
                                    "Error fetching submitter challonge_id:",
                                    err
                                );
                                return reject(
                                    "Failed to retrieve submitter's challonge_id."
                                );
                            }
                            resolve(row ? row.challonge_id : null);
                        }
                    );
                }
            );

            const opponentChallongeId = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                    [3 || opponent.id, tournamentId],
                    (err, row) => {
                        if (err) {
                            console.error(
                                "Error fetching opponent challonge_id:",
                                err
                            );
                            return reject(
                                "Failed to retrieve opponent's challonge_id."
                            );
                        }
                        resolve(row ? row.challonge_id : null);
                    }
                );
            });

            // Verify both challonge_id values were found
            if (!submitterChallongeId || !opponentChallongeId) {
                console.log(
                    "One or both participants not found in the tournament."
                );
                return interaction.reply(
                    "One or both participants are not registered in this tournament."
                );
            }

            // Find the match in the Matches table
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
                        if (err) {
                            console.error("Error fetching match details:", err);
                            return reject("Failed to retrieve match details.");
                        }
                        resolve(row);
                    }
                );
            });

            // Check if the match was found and log the details
            if (match) {
            } else {
                console.log("Match not found.");
                interaction.reply(
                    "Match not found for the specified participants."
                );
            }
        } catch (error) {
            console.error("An error occurred:", error);
            interaction.reply(
                "An error occurred while retrieving match details."
            );
        }

        // Create the embed message
        const embed = new EmbedBuilder()
            .setColor(0x0000ff)
            .setTitle("Match Submission Pending Confirmation")
            .setDescription(`Match Category:`)
            .addFields(
                {
                    name: "Submitted By",
                    value: `<@${submitter.id}>`,
                    inline: true,
                },
                {
                    name: "Score",
                    value: `${yourScore} - ${opponentScore}`,
                    inline: true,
                },
                { name: "Opponent", value: `<@${opponent.id}>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Waiting for ${opponent.tag} approval` });

        //create button id for the interaction as confirm/reject_challongeMatchID_submitterID_opponentID
        const buttonId = `_${match.match_id}_${submitter.id}_${opponent.id}`;
        // Create buttons for Confirm and Reject
        const confirmButton = new ButtonBuilder()
            .setCustomId("confirm_confirmMatch" + buttonId)
            .setLabel("Confirm")
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId("reject_confirmMatch" + buttonId)
            .setLabel("Reject")
            .setStyle(ButtonStyle.Danger);

        // Action row to hold the buttons
        const row = new ActionRowBuilder().addComponents(
            confirmButton,
            rejectButton
        );

        // Send the embed with buttons
        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
