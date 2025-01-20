//just to run the createTournamentChannels function

const { SlashCommandBuilder } = require("@discordjs/builders");
const { createTournamentChannels } = require("../../datamanager");
const {
    PermissionFlagsBits,
    IntegrationExpireBehavior,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unarchive")
        .setDescription("!! DO NOT RUN !! Create channels for a tournament")
        .addStringOption((option) =>
            option
                .setName("thread-id")
                .setDescription("The id of the thead to unarchive")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const threadId = interaction.options.getString("thread-id");
        const thread = await interaction.channel.threads.fetch(threadId);
        await thread.setArchived(false);

        await interaction.followUp("Channels created.");
    },
};
