const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const { fetchTournamentsFromDatabase } = require("../../util");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("my-matches")
        .setDescription("Lists all your matches in the specified tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The name of the tournament")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("The number of matches to display")
                .setRequired(false)
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
        const matchAmount = interaction.options.getInteger("amount") || 5;

        const tournamentName = interaction.options.getString("tournament");
        const discordId = interaction.user.id;

        const db = new sqlite3.Database("./data.db", (err) => {
            if (err) {
                console.error("Database connection error:", err.message);
                return interaction.reply("Failed to connect to the database.");
            }
        });

        try {
            // Step 1: Get tournament ID and participant's match-specific Challonge ID
            const participantData = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT T.tournament_id, P.challonge_id 
           FROM Tournaments T
           JOIN Participants P ON T.tournament_id = P.tournament_id
           WHERE T.name = ? AND P.user_id = ?`,
                    [tournamentName, discordId],
                    (err, row) => {
                        if (err || !row) {
                            console.error(
                                "Error fetching tournament/participant data:",
                                err
                            );
                            reject("Tournament or participant not found.");
                        }
                        resolve(row);
                    }
                );
            });

            const { tournament_id: tournamentId, challonge_id: matchPlayerId } =
                participantData;
            console.log("Tournament ID:", tournamentId);
            // Step 2: Fetch matches for the participant from the Matches table
            let matches = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT M.match_id, M.player1_id, M.player2_id, M.winner_id, M.state, 
                            M.player1_score, M.player2_score, M.suggested_play_order, M.group_id,
                            U1.autodarts_name AS player1_name, U1.discord_tag AS discord1_tag, U2.discord_tag as discord2_tag, U2.autodarts_name AS player2_name
                     FROM Matches M
                     JOIN Participants P1 ON M.player1_id = P1.challonge_id
                     JOIN Participants P2 ON M.player2_id = P2.challonge_id
                     JOIN Users U1 ON P1.user_id = U1.user_id
                     JOIN Users U2 ON P2.user_id = U2.user_id
                     WHERE M.tournament_id = ? AND (M.player1_id = ? OR M.player2_id = ?)
                     ORDER BY M.suggested_play_order ASC`, // Order by suggested_play_order directly in SQL
                    [tournamentId, matchPlayerId, matchPlayerId],
                    (err, rows) => {
                        if (err) {
                            console.error("Error fetching matches:", err);
                            reject("Failed to retrieve matches.");
                        }
                        resolve(rows);
                    }
                );
            });

            //ensure that the matches are all in the same group else something is wrong so error out
            const groupIds = matches.map((match) => match.group_id);
            if (groupIds.some((id) => id !== groupIds[0])) {
                return interaction.reply(
                    "Error: Matches are not in the same group."
                );
            }

            matches.sort(
                (a, b) => a.suggested_play_order - b.suggested_play_order
            );
            matches = matches.slice(0, matchAmount);

            // Step 3: Format matches for display
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`Matches for ${interaction.user.username}`)
                .setDescription(`League: **${tournamentName}**`)
                .setTimestamp();

            if (matches.length === 0) {
                embed.addFields({
                    name: "🎯 No Matches Found",
                    value: "You have no matches scheduled.",
                });
            } else {
                matches.forEach((match, index) => {
                    // Determine if the user is player 1 or player 2
                    const isPlayer1 = match.player1_id == matchPlayerId;
                    const opponentName = isPlayer1
                        ? match.player2_name
                        : match.player1_name;
                    const opponentTag = isPlayer1
                        ? match.discord2_tag
                        : match.discord1_tag;

                    const opponentDisplayName =
                        opponentTag + " (" + opponentName + ")";
                    // Parse the score from the `score_csv` field
                    let scoreCsv = "0-0";
                    if (match.state == "complete") {
                        scoreCsv = `${match.player1_score}-${match.player2_score}`;
                    }
                    const [playerScore, opponentScore] = scoreCsv
                        .split("-")
                        .map(Number);

                    // Display match result with icons
                    const result = match.winner_id
                        ? match.winner_id === matchPlayerId
                            ? "✅ **Won**"
                            : "❌ **Lost**"
                        : "⌛ **Pending**";

                    // Display match state with better labels
                    const matchStatus =
                        match.state.charAt(0).toUpperCase() +
                        match.state.slice(1);

                    // Format each match in an inline style within a full-width field
                    console.log(playerScore, opponentScore);
                    if (playerScore === 0 && opponentScore === 0) {
                        embed.addFields({
                            name: `⚪ Match ${index + 1} 🎯`,
                            value: `> **Opponent**: ${opponentDisplayName} | **Status**: ${result}`,
                        });
                    } else {
                        // use status indicators: 🟢, 🔴, ⚪
                        embed.addFields({
                            name: `${
                                result == "✅ **Won**" ? "🟢 " : "🔴 "
                            }Match ${index + 1} 🎯`,
                            value: `> **Opponent**: ${opponentDisplayName} | **Status**: ${matchStatus} | **Score**: ${playerScore} - ${opponentScore} **Result**: ${result}`,
                        });
                    }
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error("Error retrieving match data:", error);
            await interaction.reply("Failed to retrieve your matches.");
        } finally {
            db.close((err) => {
                if (err) console.error("Database close error:", err.message);
            });
        }
    },
};
