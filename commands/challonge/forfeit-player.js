const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("forfeit")
        .setDescription(
            "Forefeit remianing games for this player that havent been played"
        )
        .addUserOption((option) =>
            option
                .setName("player")
                .setDescription("The player to forfeit the match")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        interaction.followUp("This command is not implemented yet.");
        return;
        try {
            // Check if the user has admin permissions
            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return await interaction.followUp({
                    content: "You don't have permission to use this command.",
                    ephemeral: true,
                });
            }

            // Get the player to forfeit
            const player = interaction.options.getUser("player");

            // Placeholder for the forfeit logic
            // TODO: Insert the logic to handle the match forfeit here

            // Send confirmation message
            const embed = new EmbedBuilder()
                .setTitle("⚠️ Forfeit Action Taken")
                .setDescription(
                    `Player ${player} has been forfeited from their match.`
                )
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.followUp({
                embeds: [embed],
                ephemeral: false,
            });
        } catch (error) {
            console.error("Error executing /forfeit:", error);
            await interaction.followUp({
                content: "An error occurred while processing the forfeit.",
                ephemeral: true,
            });
        }
    },
};
