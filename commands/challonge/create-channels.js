//just to run the createTournamentChannels function

const { SlashCommandBuilder } = require("@discordjs/builders");
const { createTournamentChannels } = require("../../datamanager");
const {
    PermissionFlagsBits,
    IntegrationExpireBehavior,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("create-channels")
        .setDescription("!! DO NOT RUN !! Create channels for a tournament")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        interaction.deferReply({ ephemeral: true });
        //TODO make sure this is set for production
        await createTournamentChannels(
            15428772,
            interaction,
            {
                1: "1330313936020443297",
            },
            interaction.client
        );

        await interaction.followUp("Channels created.");
    },
};
