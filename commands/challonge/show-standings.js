const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");
const { fetchTournamentsFromDatabase } = require("../../util");
const { calculateStandings } = require("../../datamanager");
const {
    getTournamentIdByName,
    getChallongeTournamentURL,
    getTournamentStatus,
} = require("../../datamanager");
const sqlite3 = require("sqlite3").verbose();
const { table } = require("table");
const { getAllMatchesFromTournamentId } = require("../../datamanager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("standings")
        .setDescription("Shows the standings of the specified tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The name of the tournament")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
            option

                .setName("division")
                .setDescription("The division number")
                .setRequired(false)
        )

        .addBooleanOption((option) =>
            option
                .setName("mobile")
                .setDescription(
                    "If true, shows a reduced table for mobile viewing"
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        interaction.deferReply({ ephemeral: true });
        const tournamentName = interaction.options.getString("tournament");
        const mobileView = interaction.options.getBoolean("mobile") || true;

        if (mobileView === false) {
            interaction.followUp(
                "Larger tables are not supported yet. Please run with mobile view enabled."
            );
            return;
        }
        const division = interaction.options.getInteger("division");

        const tournamentId = await getTournamentIdByName(tournamentName);

        const { embedTitle, tables, tournamentUrl } = await calculateStandings(
            tournamentId,
            mobileView,
            division
        );

        for (const tableContent of tables) {
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(embedTitle)
                .setDescription(`Tournament: **${tournamentName}**`)
                .addFields({
                    name: `${tournamentUrl}`,
                    value: tableContent,
                })
                .setTimestamp();

            // Send an ephemeral message for each table content
            await interaction.followUp({ embeds: [embed], ephemeral: true });
        }
    },
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
};
