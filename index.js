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
    ActivityType,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const { link_posted } = require("./new-match-handler");
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
    updateLiveInteraction,
    saveStandingsSnapshot,
    getMatchFromMatchId,
    getParticipantDivisionNumberFromUserId,
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
const cron = require("node-cron");
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
    ],
});
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

    try {
        // Subscribe to "autodarts.matches" events
        await client.keycloakClient.subscribe(
            "autodarts.matches", // Channel
            "matches", // Topic
            async (message) => {
                if (message.data.event === "create") {
                    handleNewMatch(message);
                }
            },
            (ws) => {
                console.log("Subscribed to matches");
            }
        );
    } catch (error) {
        console.error("Failed to subscribe to matches:", error);
    }

    //look through all rows in live_matches table and subscribe to each match if status is not waiting for players
    const matches = await getAllLiveMatches();
    for (const match of matches) {
        if (match.status !== "waiting for players") {
            // subscribeToMatchUpdates(
            //     match.autodarts_match_id,
            //     match.tournament_id
            // );
        }
    }
    client.user.setPresence({
        activities: [
            {
                name: "you play darts",
                type: ActivityType.Watching,
                url: "https://play.autodarts.io",
            },
        ],
    });
});

// Schedule an event once a week to save the current standings into the DB
const snapshotStandings = async () => {
    //get all active tournaments
    const activeTournamentId = await getActiveTournamentId();
    const standings = await calculateStandings(
        activeTournamentId,
        false,
        null,
        true
    );

    await saveStandingsSnapshot(activeTournamentId, standings);
};
// In your main bot file (e.g., index.js or bot.js)
client.on("threadUpdate", async (oldThread, newThread) => {
    console.log("Thread updated");
    try {
        // Check if the thread went from unarchived to archived
        if (!oldThread.archived && newThread.archived) {
            console.log(
                `Thread ${newThread.name} just got archived. Unarchiving...`
            );

            //extract match id from thread name
            //use const foundMatchId = thread.name.match(/\[ID:(\d+)\]/)?.[1]; to get the match id
            const matchId = newThread.name.match(/\[ID:(\d+)\]/)?.[1];
            const match = await getMatchFromMatchId(matchId);
            if (!match) {
                console.error("Match not found");
                return;
            }
            //check match state == complete
            if (match.state == "complete") {
                //dont unarchive
                return;
            }
            //only unarchive if match is not complete

            // Unarchive the thread
            await newThread.setArchived(false);
            //for testing, send a message to the thread
            const channel = await newThread.fetch();

            const embed = new EmbedBuilder()
                .setTitle("Match Reminder")
                .setDescription(
                    `This is a reminder that you have a match scheduled. Please confirm the match in the thread.`
                )
                .setColor(0x00ff00);
            //await channel.send({ embeds: [embed] });
            console.log(`Thread ${newThread.name} has been unarchived.`);
        }
    } catch (error) {
        console.error(`Error unarchiving thread: ${error}`);
    }
});
cron.schedule("0 2 * * *", async () => {
    await snapshotStandings();
    console.log("Daily snapshot taken at 2 AM!");
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const autodartsLinkRegex =
        /https:\/\/play\.autodarts\.io\/history\/matches\/[a-f0-9\-]{36}/i;

    if (autodartsLinkRegex.test(message.content)) {
        const match = message.content.match(autodartsLinkRegex)[0];

        // You can now parse the match ID or do something useful with it
        const matchId = match.split("/").pop();

        const data = await link_posted(matchId, client.keycloakClient, client);

        // For testing, send a message to the channel
        const embed = new EmbedBuilder()
            .setTitle("New Match Link Posted")
            .setDescription(
                `Match between ${data.player1_name} and ${data.player2_name} with ID [ID:${data.matchId}]`
            )
            .addFields(
                {
                    name: "Player 1 Score",
                    value: data.player1_score.toString(),
                },
                { name: "Player 2 Score", value: data.player2_score.toString() }
            )
            .setColor(0x00ff00)
            .setURL(match);

        // Send the embed to the channel
        const channel = message.channel;
        await channel.send({ embeds: [embed] });
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
        throw error;
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
    //subscribeToMatchUpdates(message.data.body.id, tournamentId);
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
