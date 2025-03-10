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
            15864815,
            interaction,
            {
                1: "1348776378983776348",
                2: "1348776417839550495",
                3: "1348782497240187021",
            },
            interaction.client
        );

        await interaction.followUp("Channels created.");
    },
};
