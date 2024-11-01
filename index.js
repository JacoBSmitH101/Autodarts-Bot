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
const ALLOWED_USER_IDS = ["414395899570290690", "335970728811954187"];
const AUTODARTS_WEBSOCKET_URL = "wss://api.autodarts.io/ms/v0/subscribe"; // Replace with actual WebSocket URL
const CERT_CHECK = false; // Set to true if you want to enable certificate checking
const username = process.env.USERNAMES;
const password = process.env.PASSWORDS;
const clientId = "wusaaa-caller-for-autodarts";
const clientSecret = "4hg5d4fddW7rqgoY8gZ42aMpi2vjLkzf"; // Optional, if needed
const debug = true; // Enable debug mode to see logs

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
        if (!ALLOWED_USER_IDS.includes(interaction.user.id)) {
            await interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true,
            });
            return;
        }
        await command.execute(interaction);
    } catch (error) {
        //console.error(error);
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
