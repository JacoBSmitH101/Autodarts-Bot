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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("start-game")
        .setDescription("Start a game on Autodarts.io with default settings.")
        .addBooleanOption((option) =>
            option
                .setName("private")
                .setDescription("Make lobby private")
                .setRequired(false)
        ),
    //show up please
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const isPrivate =
                interaction.options.getBoolean("private") ?? false;

            const lobbyData = {
                variant: "X01",
                settings: {
                    baseScore: 501,
                    inMode: "Straight",
                    outMode: "Double",
                    bullMode: "25/50",
                    maxRounds: 80,
                },
                bullOffMode: "Normal",
                isPrivate: isPrivate,
                legs: 4,
            };

            const lobbyResponse =
                await interaction.client.keycloakClient.createLobby(lobbyData);

            if (!lobbyResponse) {
                throw new Error("Failed to create the game lobby.");
            }

            const autodarts_match_id = lobbyResponse.id;
            const lobbyUrl = `https://play.autodarts.io/lobbies/${autodarts_match_id}`;

            const channel = interaction.channel;
            const matchId = channel.name.match(/\[ID:(\d+)\]/)?.[1];
            const matchData = await getMatchFromMatchId(matchId);

            if (!matchData) {
                throw new Error("Failed to get match data from the database.");
            }

            const embed = new EmbedBuilder()
                .setTitle(
                    "🎯 Get ready!! ⚠️ **JOIN USING THE LINK PROVIDED BELOW** ⚠️"
                )
                .setDescription(
                    `Click the button below to join your game on Autodarts:\n\n**[Join Your Match Now!](${lobbyUrl})** or copy this link: ${lobbyUrl}`
                )
                .setColor(0xe74c3c)
                .addFields(
                    {
                        name: "⚠️ Important Match Rules",
                        value: "Play **Best of 6** legs:\n- Match ends **3-3** (Draw)\n- Or **First to 4** (Win)",
                    },
                    {
                        name: "⚠️ Final Reminder",
                        value: "You must manually **click Finish** to end the match! Be careful **not to play extra legs** beyond the agreed Best of 6 format.",
                    }
                )
                .setFooter({ text: "Good luck and have fun!" })
                .setTimestamp();

            const abortButton = new ButtonBuilder()
                .setCustomId(`abort_lobbyCreate_${autodarts_match_id}`)
                .setLabel(
                    ` ‎ ‎‎ ‎ ‎ ‎ ‎ ‎ ‎‎ ‎ ‎ ‎ ‎ ‎ ‎Cancel‎ ‎ ‎ ‎ ‎ ‎ ‎‎ ‎ ‎ ‎ ‎ ‎ ‎‎ ‎ ‎`
                )
                .setStyle(ButtonStyle.Danger);

            const actionRow = new ActionRowBuilder().addComponents(abortButton);

            await createNewLiveMatch(
                matchId,
                matchData.tournament_id,
                matchData.player1_id,
                matchData.player2_id,
                autodarts_match_id,
                interaction.channel.id
            );
            console.log("Created new live match in the database.");
            console.log(interaction.channel.id);

            await interaction.followUp({
                embeds: [embed],
                components: [actionRow],
                ephemeral: false,
            });

            await interaction.client.keycloakClient.subscribe(
                "autodarts.lobbies",
                `${autodarts_match_id}.state`,
                async (message) => {
                    interaction.client.matchHandler.lobby_event(message);
                },
                (ws) => {
                    console.log("Subscribed to lobby events.");
                }
            );
        } catch (error) {
            console.error("Error:", error);

            if (error.message.includes("Failed to create live match")) {
                await interaction.followUp({
                    content: "This game has already been opened.",
                    ephemeral: true,
                });
            } else if (error.message.includes("Failed to get match data")) {
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
