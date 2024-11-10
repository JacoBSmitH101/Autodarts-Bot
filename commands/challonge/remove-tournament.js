const {
    SlashCommandBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove-tournament")
        .setDescription(
            "Removes a tournament from the local database using a Challonge ID."
        )
        .addStringOption((option) =>
            option
                .setName("challonge_id")
                .setDescription("The ID of the Challonge tournament")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const challongeId = interaction.options.getString("challonge_id");
        // Create buttons with structured IDs
        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_remove-tournament_${challongeId}`)
            .setLabel("Confirm Removal")
            .setStyle(ButtonStyle.Danger);
        const cancelButton = new ButtonBuilder()
            .setCustomId(`cancel_remove-tournament_${challongeId}`)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(
            confirmButton,
            cancelButton
        );

        // Send confirmation message
        await interaction.reply({
            content: `Are you sure you want to remove the tournament with Challonge ID: ${challongeId}?`,
            components: [row],
            ephemeral: true, // Optional: keep the interaction private
        });
    },
};
