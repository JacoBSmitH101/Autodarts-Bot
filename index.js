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
    //TODO get this tournament id from the database
    const tournamentId = 15327336;

    try {
        if (message.data.body.players[0].user.id === userId) {
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
            subscribeToMatch(message.data.body.id, 15327336);
        }
    } catch (error) {
        console.error("An error occurred:");
        //console.log("Original message data:", message.data);
    }
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
