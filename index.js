require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    messageLink,
    REST,
    Routes,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");
const AutodartsKeycloakClient = require("./adauth");
const { handleConfirmRemove, handleCancelRemove } = require("./util"); //#endregion
const {
    rejectMatch,
    calculateStandings,
    getDivisionNumbers,
    getLiveMatchDataFromAutodartsMatchId,
    updateLiveMatchStatus,
    getLiveMatchStatus,
    getAllLiveMatches,
    deleteLiveMatch,
} = require("./datamanager");
const confirmMatch = require("./datamanager").confirmMatch;

const TOKEN = process.env.TOKEN;

const AUTODARTS_WEBSOCKET_URL = "wss://api.autodarts.io/ms/v0/subscribe";
const CERT_CHECK = false; // Set to true if you want to enable certificate checking
const username = process.env.USERNAMES;
const password = process.env.PASSWORDS;
const clientId = process.env.AD_CLIENT_ID;
const clientSecret = process.env.AD_CLIENT_SECRET; // Optional, if needed
const debug = process.env.DEBUG == "True";
const {
    getTournamentIdByName,
    getMatchFromAutodartsMatchId,
    getAllMatchesFromTournamentId,
    getTournamentIdFromAutodartsMatchId,
    getChallongeIdFromUserIdTournamentId,
    getLocalMatchFromPlayersChallongeIdTournamentId,
    getUserIdFromAutodartsId,
    getActiveTournamentId,
    getNameFromChallongeId,
    findThreadByMatchId,
    getUserIdFromChallongeId,
} = require("./datamanager");

//run deploy-commands.js to deploy commands to discord below
const commands = [];
// Grab all the command folders from the commands directory you created earlier
const dfoldersPath = path.join(__dirname, "commands");
const dcommandFolders = fs.readdirSync(dfoldersPath).filter((folder) => {
    const fullPath = path.join(dfoldersPath, folder);
    return fs.statSync(fullPath).isDirectory(); // Ensure only directories are included
});

for (const folder of dcommandFolders) {
    const commandsPath = path.join(dfoldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            if ("data" in command && "execute" in command) {
                commands.push(command.data.toJSON());
            } else {
                console.warn(
                    `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
                );
            }
        } catch (err) {
            console.error(`Error loading command file ${filePath}:`, err);
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN);

// and deploy your commands!
(async () => {
    try {
        console.log(
            `Started refreshing ${commands.length} application (/) commands.`
        );

        // The put method is used to fully refresh all commands in the guild with the current set
        //TODO AT DEPLOY CHANGE TO CORRECT GUILD ID
        const data = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        const data2 = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.AD_GUILD
            ),
            { body: commands }
        );

        console.log(
            `Successfully reloaded ${data2.length} application (/) commands.`
        );
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
const keycloakClient = new AutodartsKeycloakClient({
    username,
    password,
    clientId,
    clientSecret,
    debug,
});
client.keycloakClient = keycloakClient;

const MatchHandler = require("./match-handler");
const { match } = require("assert");
const matchHandler = new MatchHandler(client);
client.matchHandler = matchHandler;

// Load commands
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath).filter((folder) => {
    const fullPath = path.join(foldersPath, folder);
    return fs.statSync(fullPath).isDirectory(); // Ensure only directories are included
});
for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(
                `Error: ${file} does not have a data and execute property`
            );
        }
    }
}

// Event: Client Ready
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    // try {
    //     // Subscribe to "autodarts.matches" events
    //     await client.keycloakClient.subscribe(
    //         "autodarts.matches", // Channel
    //         "matches", // Topic
    //         async (message) => {
    //             if (message.data.event === "create") {
    //                 handleNewMatch(message);
    //             }
    //         },
    //         (ws) => {
    //             console.log("Subscribed to matches");
    //         }
    //     );
    // } catch (error) {
    //     console.error("Failed to subscribe to matches:", error);
    // }

    //look through all rows in live_matches table and subscribe to each match if status is not waiting for players
    const matches = await getAllLiveMatches();
    for (const match of matches) {
        if (match.status !== "waiting for players") {
            subscribeToMatchUpdates(
                match.autodarts_match_id,
                match.tournament_id
            );
        }
    }
});

// Event: Interaction Create
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command.autocomplete) return;
        await command.autocomplete(interaction);
        return;
    }

    if (interaction.isModalSubmit()) {
        // Modal example
        await interaction.reply(
            interaction.fields.fields.get("hobbiesInput").value
        );
        return;
    }
    if (interaction.isButton()) {
        // Parse button ID into components
        let [action, commandName, ...extra] = interaction.customId.split("_");

        console.log(interaction.customId);
        console.log(action);
        //finally user name
        try {
            console.log(interaction.user.username);
        } catch (error) {
            console.log("Error getting user name");
        }

        console.log(interaction.customId);
        // Route based on action and command name
        if (commandName === "remove-tournament") {
            if (action === "confirm") {
                await handleConfirmRemove(interaction, extra);
            } else if (action === "cancel") {
                await handleCancelRemove(interaction);
            }
        }
        if (commandName == "joinTestChannel") {
            const testChannelID = "1299461110465826859";
            const guild = await client.guilds.cache.get("1279646324987265086");

            const member = await guild.members.fetch(interaction.user.id);
            const channel = await client.channels.fetch(testChannelID);
            const permissions = await channel.permissionsFor(member);

            await channel.permissionOverwrites.edit(member, {
                1024: true,
            });
            await interaction.reply({
                content: "You have been granted access to the testing channel",
                ephemeral: true,
            });
        }
        if (commandName === "autoMatch") {
            if (action === "confirm") {
                const [submitterDiscordId, autodarts_match_id] = extra;

                console.log("Confirming match");

                const tournamentId = await getTournamentIdFromAutodartsMatchId(
                    autodarts_match_id
                );
                console.log("Tournament ID:", tournamentId);
                const submitterChallongeId =
                    await getChallongeIdFromUserIdTournamentId(
                        submitterDiscordId,
                        tournamentId
                    );
                console.log("Submitter Challonge ID:", submitterChallongeId);
                const player = await getMatchFromAutodartsMatchId(
                    autodarts_match_id
                );

                if (
                    !submitterChallongeId == player.player1_id &&
                    !submitterChallongeId == player.player2_id
                ) {
                    await interaction.reply({
                        content: "You are not in this match!",
                        ephemeral: true,
                    });
                    return;
                }

                if (
                    (submitterChallongeId != player.player1_id &&
                        player.player1_confirmed == -1) ||
                    (submitterChallongeId != player.player2_id &&
                        player.player2_confirmed == -1)
                ) {
                    await interaction.reply({
                        content:
                            "Other player has rejected the match! If this was unexpected, please contact an H3RBSKIx or JacoBSmitH.",
                        ephemeral: true,
                    });
                    return;
                }

                try {
                    const confirmIndex =
                        submitterChallongeId == player.player1_id ? 0 : 1;
                    await confirmMatch(autodarts_match_id, confirmIndex);
                    await interaction.message.delete();
                    await interaction.reply({
                        content: "Match confirmation recorded!",
                        ephemeral: true,
                    });
                } catch (error) {
                    console.error("Error confirming match:", error);
                    await interaction.followUp({
                        content: "Failed to confirm match.",
                        ephemeral: true,
                    });
                }

                // Process match confirmation status
                const match = await getMatchFromAutodartsMatchId(
                    autodarts_match_id
                );
                if (process.env.DEBUG == "True") {
                    console.log("------------------");
                    console.log("SUBMITTER", submitterChallongeId);
                    console.log("PLAYER1", player.player1_id);
                    console.log("PLAYER2", player.player2_id);
                    console.log("CONFIRMED", match.player1_confirmed);
                    console.log("CONFIRMED", match.player2_confirmed);
                    console.log("MATCH", match);
                    console.log("------------------");
                }

                if (
                    match.player1_confirmed == 1 &&
                    match.player2_confirmed == 1
                ) {
                    const guild = await client.guilds.cache.get(
                        process.env.AD_GUILD
                    );
                    console.log("Both players have confirmed");
                    const channel = await findThreadByMatchId(
                        guild,
                        match.match_id
                    );

                    let db_match =
                        await getLocalMatchFromPlayersChallongeIdTournamentId(
                            player.player1_id,
                            player.player2_id,
                            tournamentId
                        );
                    const api_url = `https://api.challonge.com/v1/tournaments/${match.tournament_id}/matches/${match.match_id}.json`;
                    const params = { api_key: process.env.API_KEY };

                    const winnerIndex =
                        db_match.player1_score > db_match.player2_score
                            ? 0
                            : db_match.player1_score < db_match.player2_score
                            ? 1
                            : null;
                    const winnerChallongeId =
                        winnerIndex !== null
                            ? winnerIndex === 0
                                ? db_match.player1_id
                                : db_match.player2_id
                            : null;

                    const scores_csv = `${db_match.player1_score}-${db_match.player2_score}`;
                    const data = {
                        match: {
                            scores_csv: scores_csv,
                            winner_id: winnerChallongeId,
                        },
                    };

                    try {
                        const response = await axios.put(api_url, data, {
                            params,
                        });
                        if (response.status === 200) {
                            console.log("Challonge match updated");
                        }
                    } catch (error) {
                        console.error("Error updating challonge match:", error);
                    }

                    if (channel) {
                        const player1_name = await getNameFromChallongeId(
                            match.player1_id
                        );
                        const player2_name = await getNameFromChallongeId(
                            match.player2_id
                        );
                        const embed = new EmbedBuilder()
                            .setTitle("Match Confirmed")
                            .setDescription(
                                `Match between ${player1_name} and ${player2_name} has been confirmed. This thread will now be archived.`
                            )
                            .setColor(0x00ff00);

                        await channel.send({ embeds: [embed] });

                        // const { embedTitle, tables, tournamentUrl } =
                        //     await calculateStandings(
                        //         match.tournament_id,
                        //         false,
                        //         divisionNumber
                        //     );
                        // for (const tableContent of tables) {
                        //     const embed = new EmbedBuilder()
                        //         .setColor(0x3498db)
                        //         .setTitle(embedTitle)
                        //         .setDescription(`Division Standings`)
                        //         .addFields({
                        //             name: `${tournamentUrl}`,
                        //             value: tableContent,
                        //         })
                        //         .setTimestamp();

                        //     await channel.send({
                        //         embeds: [embed],
                        //     });
                        // }
                        channel.setArchived(true);

                        //now update the live matches channel
                        const liveMatchesChannel = client.channels.cache.get(
                            process.env.LIVE_MATCHES_CHANNEL_ID
                        );
                        if (liveMatchesChannel) {
                            const embed = new EmbedBuilder()
                                .setTitle("Match Confirmed")
                                .setDescription(
                                    `Match between ${player1_name} and ${player2_name} has been confirmed`
                                )
                                .setColor(0x00ff00);
                            await liveMatchesChannel.send({ embeds: [embed] });
                        } else {
                            console.log("Channel not found");
                        }
                    } else {
                        await interaction.followUp({
                            content:
                                "Match confirmation recorded, but announcement channel not found.",
                            ephemeral: true,
                        });
                    }
                }
            } else if (action === "reject") {
                const [submitterDiscordId, autodarts_match_id] = extra;

                const tournamentId = await getTournamentIdFromAutodartsMatchId(
                    autodarts_match_id
                );

                const submitterChallongeId =
                    await getChallongeIdFromUserIdTournamentId(
                        submitterDiscordId,
                        tournamentId
                    );

                const player = await getMatchFromAutodartsMatchId(
                    autodarts_match_id
                );

                if (
                    !submitterChallongeId == player.player1_id &&
                    !submitterChallongeId == player.player2_id
                ) {
                    await interaction.reply({
                        content: "You are not in this match!",
                        ephemeral: true,
                    });
                    return;
                }

                //dont need to check if the other player has confirmed as they have rejected
                const isSubmitterPlayer1 =
                    submitterChallongeId == player.player1_id;
                await rejectMatch(
                    autodarts_match_id,
                    isSubmitterPlayer1 ? 0 : 1
                );
                await matchHandler.markMatchRejected(player);
                const guild = await client.guilds.cache.get(
                    process.env.AD_GUILD
                );
                const matchChannel = await findThreadByMatchId(
                    guild,
                    player.match_id
                );
                //just say match begun
                const embed2 = new EmbedBuilder()
                    .setTitle(`🎯 Match Started`)
                    .setDescription(`Match has been rejected`)
                    .setColor(0xff0000) // Green color for active match
                    .setTimestamp();
                await matchChannel.send({ embeds: [embed2] });
                await interaction.reply({
                    content:
                        "Match rejection recorded, admins have been notified!",
                    ephemeral: true,
                });

                moderatorChannelId = "1308190896159719437";

                const moderatorChannel =
                    client.channels.cache.get(moderatorChannelId);

                if (!moderatorChannel) {
                    console.error("Could not find the moderator channel.");
                    return;
                }

                const player1_discord_id = await getUserIdFromChallongeId(
                    player.player1_id
                );
                const player2_discord_id = await getUserIdFromChallongeId(
                    player.player2_id
                );

                const message = await moderatorChannel.send(
                    `Match between <@${player1_discord_id}> and <@${player2_discord_id}> has been rejected.
                        Match ID: ${autodarts_match_id}
                        Database match ID: ${player.match_id}`
                );

                try {
                    //delete interaction message
                    await interaction.message.delete();
                } catch (error) {
                    console.error("Error deleting interaction message:", error);
                }
            } else if (action === "start") {
                const [lobbyId] = extra;

                const status = await getLiveMatchStatus(lobbyId);

                if (status !== "start offered") {
                    await interaction.reply({
                        content: "Match has already been started!",
                        ephemeral: true,
                    });
                    return;
                }

                await client.keycloakClient.startLobby(lobbyId);

                await interaction.reply({
                    content: "Game started! Good luck have fun!",
                    ephemeral: false,
                });
                //edit the original message to remove the button
                await interaction.message.edit({
                    components: [],
                });
                //get the origina message and remove button as well
                const data = await getLiveMatchDataFromAutodartsMatchId(
                    lobbyId
                );
                const int = await interaction.channel.messages.fetch(
                    data.match_channel_interaction_id
                );
                await int.edit({
                    components: [],
                });

                //TODO then continue match handling
                //first unsubscribe from the lobby

                await client.keycloakClient.unsubscribe(
                    "autodarts.loobies",
                    `${lobbyId}.events`
                );

                //update live_match row status to bull up
                await updateLiveMatchStatus(lobbyId, "bullup");

                await client.keycloakClient.subscribe(
                    "autodarts.matches",
                    `${lobbyId}.state`,
                    async (message) => {
                        matchHandler.match_update(message, data.tournament_id);
                    }
                );
                await client.keycloakClient.subscribe(
                    "autodarts.matches",
                    `${lobbyId}.events`,
                    async (message) => {
                        matchHandler.match_event(message, data.tournament_id);
                    }
                );
            }
        }

        if (commandName === "lobbyCreate") {
            if (action == "abort") {
                const [matchId] = extra;
                const data = await getLiveMatchDataFromAutodartsMatchId(
                    matchId
                );
                if (data) {
                    await client.keycloakClient.deleteLobby(matchId);
                    await client.keycloakClient.unsubscribe(
                        "autodarts.lobbies",
                        `${matchId}.state`
                    );
                    await client.keycloakClient.unsubscribe(
                        "autodarts.lobbies",
                        `${matchId}.events`
                    );
                    await interaction.message.delete();
                    await deleteLiveMatch(matchId);
                    await interaction.reply({
                        content: "Match creation cancelled!",
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: "Match not found!",
                        ephemeral: true,
                    });
                }
            }
        }

        if (commandName === "confirmMatch") {
            extra = extra.join("_");
            const [matchId, submitterId, opponentId] = extra.split("_");
            if (action === "confirm") {
                if (
                    interaction.user.id === opponentId ||
                    interaction.user.id === submitterId
                ) {
                    confirmMatch(interaction, extra);
                } else {
                    await interaction.reply({
                        content: "You are not the opponent of this match!",
                        ephemeral: true,
                    });
                }
            } else if (action === "reject") {
                if (
                    interaction.user.id === opponentId ||
                    interaction.user.id === submitterId
                )
                    rejectMatch(interaction);
            }
        }
        return;
    }
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(
            `No command matching ${interaction.commandName} was found.`
        );
        return;
    }

    try {
        //for logging purposes, log the user name, id and command name
        const timestamp = new Date().toISOString();
        console.log(
            `${timestamp} User: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id}) ran command ${interaction.commandName}`
        );
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "There was an error while executing this command!",
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: "There was an error while executing this command!",
                    ephemeral: true,
                });
            }
        } catch (error) {
            console.error("Error sending error message:", error);
        }
    }
});

// Handle new match messages
const handleNewMatch = async (message) => {
    //TODO - Check matches for all matchups
    // In future will have list of matches from database with userids to check
    //for now just use mine
    //const userId = "bb229295-742d-429f-bbbf-fe4a179ef537";
    //get both playerIds from the message
    let player1_id = "";
    let player2_id = "";

    try {
        player1_id = message.data.body.players[0].user.id;
        player2_id = message.data.body.players[1].user.id;
    } catch (error) {
        return;
    }
    if (process.env.DEBUG == "True") {
        console.log(player1_id, player2_id);
    }

    const player1_user_id = await getUserIdFromAutodartsId(player1_id);

    const player2_user_id = await getUserIdFromAutodartsId(player2_id);

    if (!player1_user_id || !player2_user_id) {
        if (process.env.DEBUG == "True") {
            console.log(`Rejection: ${player1_user_id} ${player2_user_id}`);
        }
        return;
    }

    //get tournament from participants table
    let tournamentId = await getActiveTournamentId();

    //use participants table to get challonge_ids using user_ids and tournament_id
    if (process.env.DEBUG == "True") {
        console.log(player1_user_id, player2_user_id, tournamentId);
    }
    const player1_challonge_id = await getChallongeIdFromUserIdTournamentId(
        player1_user_id,
        tournamentId
    );
    const player2_challonge_id = await getChallongeIdFromUserIdTournamentId(
        player2_user_id,
        tournamentId
    );

    //get the match from the matches table
    const match = await getLocalMatchFromPlayersChallongeIdTournamentId(
        player1_challonge_id,
        player2_challonge_id,
        tournamentId
    );

    if (!player1_challonge_id || !player2_challonge_id) {
        if (process.env.DEBUG == "True") {
            console.log(
                `Rejection: ${player1_challonge_id} ${player2_challonge_id}`
            );
        }
        return;
    }
    if (!match) {
        if (process.env.DEBUG == "True") {
            console.log("Match not found");
        }
        return;
    }

    if (
        match.state != "open" &&
        match.player1_confirmed != -1 &&
        match.player2_confirmed != -1
    ) {
        return console.log("Match already played");
    }

    const channel = client.channels.cache.get(
        process.env.LIVE_MATCHES_CHANNEL_ID
    );
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle("New Match")
            .setDescription(`You have a new match`)
            .setColor(0x00ff00);
        //channel.send({ embeds: [embed] });
    } else {
        console.log("Channel not found");
    }
    subscribeToMatchUpdates(message.data.body.id, tournamentId);
    setTimeout(
        subscribeToMatchEvents,
        1000,
        message.data.body.id,
        tournamentId
    );
    if (process.env.DEBUG == "True") {
        console.log("Match:", match);
    }
};

// Subscribe to a match
const subscribeToMatchUpdates = async (matchId, tournamentId) => {
    const paramsSubscribeMatchesEvents = {
        channel: "autodarts.matches",
        type: "subscribe",
        topic: `${matchId}.state`,
    };

    await client.keycloakClient.subscribe(
        "autodarts.matches", // Channel
        `${matchId}.state`, // Topic (match-specific updates)
        async (message) => {
            matchHandler.match_update(message, tournamentId);
        },
        () => {
            console.log(`Subscribed to match updates for match ${matchId}`);
        }
    );
};

const subscribeToMatchEvents = async (matchId, tournamentId) => {
    const paramsSubscribeMatchesEvents = {
        channel: "autodarts.matches",
        type: "subscribe",
        topic: `${matchId}.events`,
    };

    await client.keycloakClient.subscribe(
        "autodarts.matches", // Channel
        `${matchId}.events`, // Topic (specific for match events)
        async (message) => {
            matchHandler.match_event(message, tournamentId);
        },
        (ws) => {
            console.log(`Subscribed to match events for match ${matchId}`);
        }
    );
};

// Test API stats
const testApiStats = async () => {
    const url =
        "https://play.autodarts.io/users/bb229295-742d-429f-bbbf-fe4a179ef537";
    const userId = url.split("/").pop();
    const apiURL = `https://api.autodarts.io/as/v0/users/${userId}/stats/x01?limit=100`;
    const headers = {
        Authorization: `Bearer ${client.keycloakClient.accessToken}`,
    };
    const response = await axios.get(apiURL, { headers });
    console.log("Authenticated response:", response.data);
};

async function createLobby(data) {
    const returndata = await client.keycloakClient.createLobby(data);
    return returndata;
}
module.exports = { createLobby };
// Login to Discord
client.login(TOKEN);
