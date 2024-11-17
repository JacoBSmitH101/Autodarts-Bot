//command to list all participants signed up for a tournament

const {
    getAllParticipants,
    getNameFromChallongeId,
} = require("../../testdatamanager");
const { fetchTournamentsFromDatabase } = require("../../util");
const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");
const { getTournamentIdByName } = require("../../testdatamanager");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("view-participants")
        .setDescription("Shows all participants signed up for a league")
        .addStringOption((option) =>
            option
                .setName("league")
                .setDescription("The name of the league.")
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async autocomplete(interaction) {
        if (interaction.options.getFocused(true).name === "league") {
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
    async execute(interaction) {
        const tournamentName = interaction.options.getString("league");
        const tournamentId = await getTournamentIdByName(tournamentName);

        if (!tournamentId) {
            return interaction.reply(
                `Tournament "${tournamentName}" not found.`
            );
        }

        const participants = await getAllParticipants(tournamentId);

        const embed = new EmbedBuilder()
            .setTitle("Participants")
            .setColor(0x00ff00)
            .setDescription(
                participants
                    .map(
                        async (participant) =>
                            await getNameFromChallongeId(
                                participant.challonge_id
                            )
                    )
                    .join("\n")
            );

        interaction.reply({ embeds: [embed], ephemeral: true });
    },
};