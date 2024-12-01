const { SlashCommandBuilder } = require("@discordjs/builders");
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const {
    getMatchFromMatchId,
    createNewLiveMatch,
} = require("../../datamanager");
const { PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("start-game")
        .setDescription("Start a game on Autodarts.io with default settings.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
                isPrivate: false,
            };

            // Create the lobby
            const lobbyResponse =
                await interaction.client.keycloakClient.createLobby(lobbyData);

            if (!lobbyResponse) {
                throw new Error("Failed to create the game lobby.");
            }
            const autodarts_match_id = lobbyResponse.id;

            // Construct the full URL for the lobby
            const lobbyUrl = `https://play.autodarts.io/lobbies/${autodarts_match_id}`;

            // Get channel name from interaction
            const channel = interaction.channel;

            // Extract the match ID from the channel name
            const matchId = channel.name.match(/\[ID:(\d+)\]/)?.[1];

            // Get match info from the database
            const matchData = await getMatchFromMatchId(matchId);

            if (!matchData) {
                throw new Error("Failed to get match data from the database.");
            }

            // Create the embed with match details
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

            // Create the Abort button
            const abortButton = new ButtonBuilder()
                .setCustomId(`abort_lobbyCreate_${autodarts_match_id}`) // Unique ID for the button
                .setLabel(
                    ` ‎ ‎‎ ‎ ‎ ‎ ‎ ‎ ‎‎ ‎ ‎ ‎ ‎ ‎ ‎Cancel‎ ‎ ‎ ‎ ‎ ‎ ‎‎ ‎ ‎ ‎ ‎ ‎ ‎‎ ‎ ‎`
                )
                .setStyle(ButtonStyle.Danger); // Red button

            // Add the button to an ActionRow
            const actionRow = new ActionRowBuilder().addComponents(abortButton);

            // Respond with the embed and button

            // Insert match details into the database
            await createNewLiveMatch(
                matchId,
                matchData.tournament_id,
                matchData.player1_id,
                matchData.player2_id,
                autodarts_match_id,
                interaction.channel.id
            );
            await interaction.followUp({
                embeds: [embed],
                components: [actionRow],
                ephemeral: false,
            });

            await interaction.client.keycloakClient.subscribe(
                "autodarts.lobbies", // Channel
                `${autodarts_match_id}.state`, // Topic
                async (message) => {
                    //console.log("Received lobby event:", message);
                    interaction.client.matchHandler.lobby_event(message);
                },
                (ws) => {
                    console.log("Subscribed to lobby events.");
                }
            );
        } catch (error) {
            console.error("Error:", error);
            //TODO this needs to be actuall working
            if (
                error.message &&
                error.message.includes("Failed to create live match")
            ) {
                await interaction.followUp({
                    content: "This game has already been opened.",
                    ephemeral: true,
                });
                return;
            } else if (
                error.message &&
                error.message.includes("Failed to get match data")
            ) {
                await interaction.followUp({
                    content:
                        "This command can only be used in a match channel.",
                    ephemeral: true,
                });
            } else {
                await interaction.followUp({
                    content:
                        "Failed to start the game. Please try again later.",
                    ephemeral: true,
                });
            }
        }
    },
};
