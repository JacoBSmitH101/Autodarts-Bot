const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("start-game")
        .setDescription("Start a game on Autodarts.io with default settings."),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            // Define the lobby settings
            const lobbyData = {
                variant: "X01",
                settings: {
                    baseScore: 501,
                    inMode: "Straight",
                    outMode: "Double",
                    bullMode: "25/50",
                    maxRounds: 50,
                },
                bullOffMode: "Normal",
                isPrivate: true,
            };

            // Create the lobby
            const lobbyResponse =
                await interaction.client.keycloakClient.createLobby(lobbyData);

            // Construct the full URL for the lobby
            const lobbyUrl = `https://play.autodarts.io/lobbies/${lobbyResponse.id}`;

            // Create an embed with match details
            const embed = new EmbedBuilder()
                .setTitle("🎯 Your Game is Ready!")
                .setDescription(
                    `Click the button below to join your game on Autodarts:\n\n**[Join Your Match Now!](${lobbyUrl})**`
                )
                .setColor(0xe74c3c) // Warning red color
                .addFields(
                    {
                        name: "⚠️ Important Match Rules",
                        value: "Play **Best of 6** legs:\n- Match ends **3-3** (Draw)\n- Or **First to 4** (Win)",
                        inline: false,
                    },
                    {
                        name: "⚠️ Final Reminder",
                        value: "You must manually **click Finish** to end the match! Be careful **not to play extra legs** beyond the agreed Best of 6 format.",
                        inline: false,
                    }
                )
                .setFooter({ text: "Good luck and have fun!" })
                .setTimestamp();

            // Respond with the embed
            await interaction.followUp({ embeds: [embed], ephemeral: false });
        } catch (error) {
            console.error("Error:", error);
            await interaction.followUp({
                content: "Failed to start the game. Please try again later.",
                ephemeral: true,
            });
        }
    },
};
