//just to run the createTournamentChannels function

const { SlashCommandBuilder } = require("@discordjs/builders");
const { createTournamentChannels } = require("../../datamanager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("create-channels")
        .setDescription("Create channels for a tournament"),

    async execute(interaction) {
        interaction.deferReply({ ephemeral: true });

        await createTournamentChannels(
            15397196,
            interaction,
            1279767527530168401
        );

        await interaction.followUp("Channels created.");
    },
};
