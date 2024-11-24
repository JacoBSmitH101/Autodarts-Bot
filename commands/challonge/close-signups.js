//command to update tournament state to pending-start

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { updateTournamentStatus } = require("../../datamanager");
const { fetchTournamentsFromDatabase } = require("../../util");
const { getTournamentIdByName } = require("../../datamanager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("close-signups")
        .setDescription("Close signups for a tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("Tournament")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const tournament_id = await getTournamentIdByName(
            interaction.options.getString("tournament")
        );

        if (!tournament_id) {
            return interaction.reply("Tournament not found.");
        }

        await updateTournamentStatus(tournament_id, "pending-start");

        await interaction.reply("Signups closed for the tournament.");
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
