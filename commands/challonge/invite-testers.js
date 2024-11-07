const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("invite-testers")
        .setDescription("Send DM invites to a list of testers for the bot")
        .addStringOption((option) =>
            option
                .setName("user_ids")
                .setDescription("Comma-separated list of user IDs to invite")
                .setRequired(true)
        ),

    async execute(interaction) {
        // Get the list of user IDs
        const userIds = interaction.options.getString("user_ids").split(",");

        // Message to send
        const inviteMessage =
            "Hello! Thanks for wanting to help test the bot! If you are free on Sunday the 10th at 8PM GMT please click the button below to join the testing channel. (or message Jacob if it crashes)";

        // Create the button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_joinTestChannel")
                .setLabel("Join Testing Channel")
                .setStyle(ButtonStyle.Primary)
        );

        // Send the DM with the button to each user
        for (const userId of userIds) {
            try {
                const guildId = interaction.guild.id;
                const guild = await interaction.client.guilds.fetch(guildId);
                const user = await guild.members.fetch(userId);
                await user.send({ content: inviteMessage, components: [row] });
            } catch (error) {
                console.error(
                    `Failed to send invite to user ${userId}:`,
                    error
                );
            }
        }

        await interaction.reply({ content: "Invites sent!", ephemeral: true });
    },
};
