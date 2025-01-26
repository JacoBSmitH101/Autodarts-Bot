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
            15397196,
            interaction,
            {
                1: "1333040321189122210",
                2: "1333034600477360271",
                3: "1333034614171631656",
                4: "1333034625798373488",
            },
            interaction.client
        );

        await interaction.followUp("Channels created.");
    },
};
