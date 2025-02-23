const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { PermissionFlagsBits } = require("discord.js");
const {
    getActiveTournamentId,
    getParticipantDataFromTournamentUserId,
    forfeitAllGames,
} = require("../../datamanager");

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
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("user-id")
                .setDescription(
                    "The user id of the player to forfeit the match"
                )
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });
        //make sure either player or user-id is provided
        if (
            !interaction.options.getUser("player") &&
            !interaction.options.getString("user-id")
        ) {
            return await interaction.followUp({
                content:
                    "You must provide either the player or user-id to forfeit the match.",
                ephemeral: true,
            });
        }
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
            const userId = interaction.options.getString("user-id");

            // Placeholder for the forfeit logic
            // TODO: Insert the logic to handle the match forfeit here
            //GET ACTIVE tournament ID
            const tournamentId = await getActiveTournamentId();
            // let playerId = await getParticipantDataFromTournamentUserId(
            //     tournamentId,
            //     player.id
            // );
            let playerId;
            if (userId) {
                playerId = await getParticipantDataFromTournamentUserId(
                    tournamentId,
                    userId
                );
            } else {
                playerId = await getParticipantDataFromTournamentUserId(
                    tournamentId,
                    player.id
                );
            }
            playerId = await playerId.challonge_id;
            await forfeitAllGames(tournamentId, playerId);
            // Send confirmation message
            const embed = new EmbedBuilder()
                .setTitle("⚠️ Forfeit Action Taken")
                .setDescription(`Player has been forfeited from their match.`)
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
