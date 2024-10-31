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
} = require("discord.js");
const TOKEN = process.env.TOKEN;

const ALLOWED_USER_IDS = ["414395899570290690", "335970728811954187"];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

const {
    handleConfirmRemove,
    handleCancelRemove,
    rejectMatch,
    confirmMatch,
} = require("./util");

const sqlite3 = require("sqlite3").verbose();

const AutodartsKeycloakClient = require("./adauth");
const AUTODARTS_WEBSOCKET_URL = "wss://api.autodarts.io/ms/v0/subscribe"; // Replace with actual WebSocket URL
const CERT_CHECK = false; // Set to true if you want to enable certificate checking
const username = process.env.USERNAMES;
const password = process.env.PASSWORDS;
const clientId = "wusaaa-caller-for-autodarts";
const clientSecret = "4hg5d4fddW7rqgoY8gZ42aMpi2vjLkzf"; // Optional, if needed
const debug = true; // Enable debug mode to see logs
const keycloakClient = new AutodartsKeycloakClient({
    username,
    password,
    clientId,
    clientSecret,
    debug,
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
            console.error(
                `Error: ${file} does not have a data and execute property`
            );
        }
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command.autocomplete) return;
        await command.autocomplete(interaction);
        return;
    }
    if (interaction.isModalSubmit()) {
        //modal example
        await interaction.reply(
            interaction.fields.fields.get("hobbiesInput").value
        );
        return;
    }
    if (interaction.isButton()) {
        // Parse button ID into components
        let [action, commandName, ...extra] = interaction.customId.split("_");
        //temp
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
                //first check if interaction.user.id is opponent
                //if it is, then update the match status to confirmed

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

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});
const axios = require("axios");
client.login(TOKEN);

const playersInTournament = ["yakoob19"]; //TEMP

const subscribeToMatch = async (matchId) => {
    const paramsSubscribeMatchesEvents = {
        channel: "autodarts.matches",
        type: "subscribe",
        topic: `${matchId}.state`,
    };
    keycloakClient.subscribe(
        async (message) => {
            console.log("Received message:", message.data.turns);
            const channel = client.channels.cache.get("1295486855378108515");

            if (channel) {
                channel.send(
                    `Message: ${message.topic}, EVENTS: ${message.data.event}`
                );
            } else {
                console.log("Channel not found");
            }
        },
        (ws) => {
            ws.send(JSON.stringify(paramsSubscribeMatchesEvents));
            console.log(matchId);
        }
    );
};

keycloakClient.subscribe(
    async (message) => {
        console.log("Received message:", message);
        const channel = client.channels.cache.get("1295486855378108515");

        const matchId = message.data.id;

        if (message.data.event == "create") {
            //fetch match details
            // const apiURL =
            //     "https://api.autodarts.io/as/v0/matches/" + matchId + "/stats";
            // const headers = {
            //     Authorization: `Bearer ${keycloakClient.accessToken}`,
            // };
            // const response = await axios.get(apiURL, { headers });
            console.log("Players: ", message.data.body.players);
            //this has a userId and an id which is used within the matchd
            //message.data.body.players is array and names are in [x].name
            //check if the player is in the tournament
            const players = message.data.body.players;

            //just check if the player is in the tournament for now
            for (let i = 0; i < players.length; i++) {
                if (playersInTournament.includes(players[i].name)) {
                    console.log("Player is in the tournament");
                    channel.send(
                        `Match created with players: ${players[0].name}`
                    );
                    //subscribe to the match
                    subscribeToMatch(matchId);
                    break;
                }
            }
            if (channel) {
            } else {
                console.log("Channel not found");
            }
        }
    },
    (ws) => {
        // Example send after connection opens
        const paramsSubscribeMatchesEvents = {
            channel: "autodarts.matches",
            type: "subscribe",
            topic: `matches`,
        };
        ws.send(JSON.stringify(paramsSubscribeMatchesEvents));
    }
);

//get user stats from profile link, last bit of url is user id
//example: https://play.autodarts.io/users/bb229295-742d-429f-bbbf-fe4a179ef537

//then get api call for stats
const testApiStats = async () => {
    const url =
        "https://play.autodarts.io/users/bb229295-742d-429f-bbbf-fe4a179ef537";
    const userId = url.split("/").pop();
    //example api https://api.autodarts.io/as/v0/users/bb229295-742d-429f-bbbf-fe4a179ef537/stats/x01?limit=100
    const apiURL = `https://api.autodarts.io/as/v0/users/${userId}/stats/x01?limit=100`;
    const headers = {
        Authorization: `Bearer ${keycloakClient.accessToken}`,
    };
    const response = await axios.get(apiURL, { headers });
    console.log("Authenticated response:", response.data);
};
setTimeout(testApiStats, 2000);
