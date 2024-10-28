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
} = require("./util");

const sqlite3 = require("sqlite3").verbose();

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

                if (interaction.user.id === opponentId) {
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

client.login(TOKEN);
