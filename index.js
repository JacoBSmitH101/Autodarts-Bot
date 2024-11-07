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
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");
const AutodartsKeycloakClient = require("./adauth");
const {
    handleConfirmRemove,
    handleCancelRemove,
    rejectMatch,
    confirmMatch,
} = require("./util");

const TOKEN = process.env.TOKEN;
const ALLOWED_USER_IDS = [
    "414395899570290690",
    "335970728811954187",
    "1142632757206466590",
    "335970728811954187",
];
const AUTODARTS_WEBSOCKET_URL = "wss://api.autodarts.io/ms/v0/subscribe"; // Replace with actual WebSocket URL
const CERT_CHECK = false; // Set to true if you want to enable certificate checking
const username = process.env.USERNAMES;
const password = process.env.PASSWORDS;
const clientId = "wusaaa-caller-for-autodarts";
const clientSecret = "4hg5d4fddW7rqgoY8gZ42aMpi2vjLkzf"; // Optional, if needed
const debug = process.env.DEBUG == "True";

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

// Load commands
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);
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
            console.error(
                `Error: ${file} does not have a data and execute property`
            );
        }
    }
}

// Event: Client Ready
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    // Start listening to the websocket
    client.keycloakClient.subscribe(
        async (message) => {
            if (message.data.event == "create") {
                handleNewMatch(message);
            }
        },
        (ws) => {
            const paramsSubscribeMatchesEvents = {
                channel: "autodarts.matches",
                type: "subscribe",
                topic: `matches`,
            };
            ws.send(JSON.stringify(paramsSubscribeMatchesEvents));
            console.log("Subscribed to matches");
        }
    );
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
            const [submitterDiscordId, autodarts_match_id] = extra;
            if (action === "confirm") {
                console.log("Confirming match");
                const db = new sqlite3.Database("./data.db", (err) => {
                    if (err) {
                        console.error(
                            "Database connection error:",
                            err.message
                        );
                        return interaction.reply({
                            content: "Failed to connect to the database.",
                            ephemeral: true,
                        });
                    }
                });

                const tournamentId = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT tournament_id FROM Matches WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err, row) => {
                            if (err)
                                return reject(
                                    "Failed to retrieve tournament_id."
                                );
                            resolve(row ? row.tournament_id : null);
                        }
                    );
                });

                console.log("Tournament ID:", tournamentId);
                const submitterChallongeId = await new Promise(
                    (resolve, reject) => {
                        db.get(
                            `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                            [submitterDiscordId, tournamentId],
                            (err, row) => {
                                if (err)
                                    return reject(
                                        "Failed to retrieve submitter's challonge_id."
                                    );
                                resolve(row ? row.challonge_id : null);
                            }
                        );
                    }
                );

                console.log("Submitter Challonge ID:", submitterChallongeId);
                const player = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT * FROM Matches WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err, row) => {
                            if (err)
                                return reject(
                                    "Failed to retrieve player1_id and player2_id."
                                );
                            resolve(row);
                        }
                    );
                });

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
                    //other player has rejected
                    await interaction.reply({
                        content:
                            "Other player has rejected the match! If this was unexpected, please contact an H3RBSKIx or JacoBSmitH.",
                        ephemeral: true,
                    });
                    return;
                }

                if (submitterChallongeId == player.player1_id) {
                    db.run(
                        `UPDATE Matches SET player1_confirmed = 1 WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err) => {
                            if (err) {
                                console.error(
                                    "Failed to update player1_confirmed:",
                                    err.message
                                );
                                return interaction.reply({
                                    content:
                                        "Failed to confirm match for player 1.",
                                    ephemeral: true,
                                });
                            }
                            interaction.reply({
                                content: "Match confirmation recorded!",
                                ephemeral: true,
                            });
                        }
                    );
                } else {
                    await db.run(
                        `UPDATE Matches SET player2_confirmed = 1 WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err) => {
                            if (err) {
                                console.error(
                                    "Failed to update player2_confirmed:",
                                    err.message
                                );
                                return interaction.reply({
                                    content:
                                        "Failed to confirm match for player 2.",
                                    ephemeral: true,
                                });
                            }
                            interaction.reply({
                                content: "Match confirmation recorded!",
                                ephemeral: true,
                            });
                        }
                    );
                }

                const match = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT * FROM Matches WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err, row) => {
                            if (err)
                                return reject(
                                    "Failed to retrieve match details."
                                );
                            resolve(row);
                        }
                    );
                });
                console.log("------------------");
                console.log("SUBMITTER", submitterChallongeId);
                console.log("PLAYER1", player.player1_id);
                console.log("PLAYER2", player.player2_id);
                console.log("MATCH", match);
                console.log("------------------");

                if (
                    match.player1_confirmed == 1 &&
                    match.player2_confirmed == 1
                ) {
                    const channel = client.channels.cache.get(
                        "1295486855378108515"
                    );

                    let db_match = await new Promise((resolve, reject) => {
                        db.get(
                            `SELECT * FROM Matches 
                WHERE tournament_id = ? 
                AND ((player1_id = ? AND player2_id = ?) 
                OR (player1_id = ? AND player2_id = ?))`,
                            [
                                player.tournament_id,
                                player.player1_id,
                                player.player2_id,
                                player.player2_id,
                                player.player1_id,
                            ],
                            (err, row) => {
                                if (err)
                                    return reject(
                                        "Failed to retrieve match details."
                                    );
                                resolve(row);
                            }
                        );
                    });

                    const api_url = `https://api.challonge.com/v1/tournaments/${db_match.tournament_id}/matches/${db_match.match_id}.json`;
                    const params = {
                        api_key: process.env.API_KEY,
                    };

                    const winnerIndex =
                        db_match.player1_score > db_match.player2_score ? 0 : 1;

                    if (db_match.player1_score == db_match.player2_score) {
                        winnerIndex = null;
                    }

                    let winnderChallongeId = null;
                    if (winnerIndex != null) {
                        winnerChallongeId =
                            winnerIndex == 0
                                ? db_match.player1_id
                                : db_match.player2_id;
                    }

                    let scores_csv = `${db_match.player1_score}-${db_match.player2_score}`;
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

                    // add to challonge

                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle("Match Confirmed")
                            .setDescription(
                                `Match between ${match.player1_name} and ${match.player2_name} has been confirmed`
                            )
                            .setColor(0x00ff00);
                        await channel.send({
                            content:
                                "Both players have confirmed. Announcing in the channel.",
                            ephemeral: true,
                        });
                        channel.send({ embeds: [embed] });
                    } else {
                        console.log("Channel not found");
                        interaction.reply({
                            content:
                                "Match confirmation recorded, but announcement channel not found.",
                            ephemeral: true,
                        });
                    }
                }
            } else if (action === "reject") {
                const db = new sqlite3.Database("./data.db", (err) => {
                    if (err) {
                        console.error(
                            "Database connection error:",
                            err.message
                        );
                        return;
                    }
                });

                const tournamentId = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT tournament_id FROM Matches WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err, row) => {
                            if (err)
                                return reject(
                                    "Failed to retrieve tournament_id."
                                );
                            resolve(row ? row.tournament_id : null);
                        }
                    );
                });

                const submitterChallongeId = await new Promise(
                    (resolve, reject) => {
                        db.get(
                            `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
                            [submitterDiscordId, tournamentId],
                            (err, row) => {
                                if (err)
                                    return reject(
                                        "Failed to retrieve submitter's challonge_id."
                                    );
                                resolve(row ? row.challonge_id : null);
                            }
                        );
                    }
                );

                const player = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT player1_id, player2_id, player1_confirmed, player2_confirmed FROM Matches WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err, row) => {
                            if (err)
                                return reject(
                                    "Failed to retrieve player1_id and player2_id."
                                );
                            resolve(row);
                        }
                    );
                });

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

                if (submitterChallongeId == player.player1_id) {
                    db.run(
                        `UPDATE Matches SET player1_confirmed = -1 WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err) => {
                            if (err) {
                                console.error(
                                    "Failed to update player1_confirmed:",
                                    err.message
                                );
                                return interaction.reply({
                                    content:
                                        "Failed to reject match for player 1.",
                                    ephemeral: true,
                                });
                            }
                            interaction.reply({
                                content: "Match rejection recorded!",
                                ephemeral: true,
                            });
                        }
                    );
                } else {
                    await db.run(
                        `UPDATE Matches SET player2_confirmed = -1 WHERE autodarts_match_id = ?`,
                        [autodarts_match_id],
                        (err) => {
                            if (err) {
                                console.error(
                                    "Failed to update player2_confirmed:",
                                    err.message
                                );
                                return interaction.reply({
                                    content:
                                        "Failed to reject match for player 2.",
                                    ephemeral: true,
                                });
                            }
                            interaction.reply({
                                content: "Match rejection recorded!",
                                ephemeral: true,
                            });
                        }
                    );
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
    if (!ALLOWED_USER_IDS.includes(interaction.user.id)) {
        await interaction.reply({
            content: "You do not have permission to use this command.",
            ephemeral: true,
        });
        return;
    }
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(
            `No command matching ${interaction.commandName} was found.`
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
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
    }
});

// Handle new match messages
const handleNewMatch = async (message) => {
    //TODO - Check matches for all matchups
    // In future will have list of matches from database with userids to check
    //for now just use mine
    const userId = "bb229295-742d-429f-bbbf-fe4a179ef537";
    //get both playerIds from the message
    let player1_id = "";
    let player2_id = "";

    try {
        player1_id = message.data.body.players[0].user.id;
        player2_id = message.data.body.players[1].user.id;
    } catch (error) {
        return;
    }
    console.log(player1_id, player2_id);

    const db = new sqlite3.Database("./data.db", (err) => {
        if (err) {
            console.error("Database connection error:", err.message);
            return;
        }
    });

    const player1_user_id = await new Promise((resolve, reject) => {
        db.get(
            `SELECT user_id FROM Users WHERE autodarts_id = ?`,
            [player1_id],
            (err, row) => {
                if (err) return reject("Failed to retrieve player1's user_id.");
                resolve(row ? row.user_id : null);
            }
        );
    });

    const player2_user_id = await new Promise((resolve, reject) => {
        db.get(
            `SELECT user_id FROM Users WHERE autodarts_id = ?`,
            [player2_id],
            (err, row) => {
                if (err) return reject("Failed to retrieve player2's user_id.");
                resolve(row ? row.user_id : null);
            }
        );
    });

    if (!player1_user_id || !player2_user_id) {
        console.log(`Rejection: ${player1_user_id} ${player2_user_id}`);
        return;
    }

    //get tournament from participants table
    let tournamentId = await new Promise((resolve, reject) => {
        db.get(
            `SELECT tournament_id FROM Participants WHERE user_id = ?`,
            [player1_user_id],
            (err, row) => {
                if (err) return reject("Failed to retrieve tournament_id.");
                resolve(row ? row.tournament_id : null);
            }
        );
    });

    //use participants table to get challonge_ids using user_ids and tournament_id
    const player1_challonge_id = await new Promise((resolve, reject) => {
        db.get(
            `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
            [player1_user_id, tournamentId],
            (err, row) => {
                if (err)
                    return reject("Failed to retrieve player1's challonge_id.");
                resolve(row ? row.challonge_id : null);
            }
        );
    });
    const player2_challonge_id = await new Promise((resolve, reject) => {
        db.get(
            `SELECT challonge_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
            [player2_user_id, tournamentId],
            (err, row) => {
                if (err)
                    return reject("Failed to retrieve player2's challonge_id.");
                resolve(row ? row.challonge_id : null);
            }
        );
    });

    //get the match from the matches table
    const match = await new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM Matches 
            WHERE tournament_id = ? 
            AND ((player1_id = ? AND player2_id = ?) 
            OR (player1_id = ? AND player2_id = ?))`,
            [
                tournamentId,
                player1_challonge_id,
                player2_challonge_id,
                player2_challonge_id,
                player1_challonge_id,
            ],
            (err, row) => {
                if (err) return reject("Failed to retrieve match details.");
                resolve(row);
            }
        );
    });
    if (!match) {
        return console.log("Match not found");
    }

    //TODO get this tournament id from the database

    const channel = client.channels.cache.get("1295486855378108515");
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle("New Match")
            .setDescription(`You have a new match`)
            .setColor(0x00ff00);
        channel.send({ embeds: [embed] });
    } else {
        console.log("Channel not found");
    }
    subscribeToMatch(message.data.body.id, tournamentId);
};

// Subscribe to a match
const subscribeToMatch = async (matchId, tournamentId) => {
    const paramsSubscribeMatchesEvents = {
        channel: "autodarts.matches",
        type: "subscribe",
        topic: `${matchId}.state`,
    };
    client.keycloakClient.subscribe(
        async (message) => {
            matchHandler.match_update(message, tournamentId);
        },
        (ws) => {
            ws.send(JSON.stringify(paramsSubscribeMatchesEvents));
            //console.log(matchId);
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

// Login to Discord
client.login(TOKEN);
