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
        await createTournmentChannels(
            15904276,
            interaction,
            {
                1: "1347881493539721238",
                2: "1341513530670715002",
                3: "1341513539713761281",
                4: "1341513547431153674",
            },
            interaction.client
        );

        await interaction.followUp("Channels created.");
    },
};
