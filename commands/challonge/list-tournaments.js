const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
//TODO maybe make this a user facing command?
module.exports = {
    data: new SlashCommandBuilder()
        .setName("list-tournaments")
        .setDescription("Lists all tournaments in the bot’s database")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Connect to SQLite database
        const db = new sqlite3.Database("./data.db", (err) => {
            if (err) {
                console.error("Database connection error:", err.message);
                return interaction.reply("Failed to connect to the database.");
            }
        });
        await interaction.reply("NOT UP TO DATE - DO NOT USE");
        return;

        // Fetch tournaments from the database
        const query = `
            SELECT name, status, start_date, end_date,
                   (SELECT COUNT(*) FROM Participants WHERE tournament_id = Tournaments.tournament_id) AS participant_count
            FROM Tournaments
            ORDER BY start_date;
        `;

        db.all(query, [], async (err, rows) => {
            if (err) {
                console.error("Database query error:", err.message);
                return interaction.reply(
                    "Failed to retrieve tournaments from the database."
                );
            }

            if (rows.length === 0) {
                await interaction.reply(
                    "No tournaments found in the database."
                );
                return;
            }

            // Create an embed to display the tournaments
            const embed = new EmbedBuilder()
                .setTitle("Tournaments List")
                .setColor(0x00ff99)
                .setDescription(
                    "Here are the current tournaments in the database."
                );

            rows.forEach((tournament) => {
                // Format status and dates for readability
                const status =
                    tournament.status === "pending"
                        ? "Awaiting Start"
                        : "In Progress";
                const startDate = tournament.start_date || "TBD";
                const endDate = tournament.end_date || "TBD";

                embed.addFields({
                    name: tournament.name,
                    value: `**Status:** ${status}\n**Start Date:** ${startDate}\n**End Date:** ${endDate}\n**Participants:** ${tournament.participant_count}`,
                });
            });

            await interaction.reply({ embeds: [embed] });
        });

        // Close the database connection
        db.close((err) => {
            if (err) {
                console.error("Error closing the database:", err.message);
            }
        });
    },
};
