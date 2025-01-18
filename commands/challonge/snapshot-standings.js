const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require("discord.js");

const {
    getActiveTournamentId,
    calculateStandings,
    saveStandingsSnapshot,
} = require("../../datamanager");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("snapshot-standings")
        .setDescription("Stores a snapshot of the current standings")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const snapshotStandings = async () => {
            //get all active tournaments
            const activeTournamentId = await getActiveTournamentId();
            const standings = await calculateStandings(
                activeTournamentId,
                false,
                null,
                true
            );

            await saveStandingsSnapshot(activeTournamentId, standings);
        };
        snapshotStandings();

        await interaction.reply({
            content: "Standings snapshot saved!",
            ephemeral: true,
        });
    },
};
