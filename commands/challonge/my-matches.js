const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const { fetchTournamentsFromDatabase } = require("../../util");
const {
    getParticipantDataFromTournamentUserId,
    getAllMatchesForPlayer,
    getTournamentIdByName,
    getTournamentStatus,
} = require("../../datamanager");
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
            let tId = await getTournamentIdByName(tournamentName);

            const status = await getTournamentStatus(tId);
            if (status == "pending") {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("Error")
                    .setDescription(
                        "The tournament has not started yet. Please wait for the tournament to start before viewing the standings."
                    );
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const participantData =
                await getParticipantDataFromTournamentUserId(tId, discordId);

            const { tournament_id: tournamentId, challonge_id: matchPlayerId } =
                participantData;
            // Step 2: Fetch matches for the participant from the Matches table
            let matches = await getAllMatchesForPlayer(
                matchPlayerId,
                tournamentId
            );

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
