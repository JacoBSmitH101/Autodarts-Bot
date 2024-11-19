const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const { fetchTournamentsFromDatabase } = require("../../util.js"); // Assuming the function is correctly implemented
const {
    upsertUser,
    upsertParticipant,
    getTournamentIdByName,
    getParticipantDataFromTournamentUserId,
    getTournamentStatus,
} = require("../../testdatamanager.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sign-up")
        .setDescription("Sign up for a tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("Tournament")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption((option) =>
            option
                .setName("autodart-profile-url")
                .setDescription("Autodart URL")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("challonge-username")
                .setDescription("(Optional) Challonge username")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("test_user_id")
                .setDescription("Test User ID")
                .setRequired(false)
        ),

    async execute(interaction) {
        const tournamentName = interaction.options.getString("tournament");
        const profileUrl = interaction.options.getString(
            "autodart-profile-url"
        );

        let autodartUsername = "Test User" + Math.floor(Math.random() * 10000);
        let average = 25;
        //get challonge name if provided
        const challongeName =
            interaction.options.getString("challonge-username");

        //check if url is valid eg: https://play.autodarts.io/users/bb229295-742d-429f-bbbf-fe4a179ef537
        if (!profileUrl.startsWith("https://play.autodarts.io/users/")) {
            autodartUsername = await getAutodartsUsernameFromID(
                profileUrl,
                interaction.client.keycloakClient
            );
            if (!autodartUsername) {
                return interaction.reply(
                    "Invalid Autodarts profile URL or ID. Please provide a valid URL."
                );
            }
        } else {
            autodartUsername = await getAutodartsUsernameFromURL(
                profileUrl,
                interaction.client.keycloakClient
            );
        }
        average = await getLast100Average(
            profileUrl,
            interaction.client.keycloakClient
        );

        const test_user_id = interaction.options.getString("test_user_id");
        const discordId = test_user_id || interaction.user.id;

        try {
            const tournamentId = await getTournamentIdByName(tournamentName);
            const status = await getTournamentStatus(tournamentId);

            if (status !== "pending") {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000) // Red color for an error
                    .setTitle("Sign-Up Error")
                    .setDescription(
                        "Sign-ups for this tournament are currently closed."
                    )
                    .setFooter({ text: "Please try again later!" })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            //first check if already signed up
            const user = await getParticipantDataFromTournamentUserId(
                tournamentId,
                discordId
            );

            if (user) {
                const embed = new EmbedBuilder()
                    .setColor(0xffcc00) // Yellow color for a warning
                    .setTitle("Already Signed Up")
                    .setDescription(
                        "You're already signed up for this tournament!"
                    )
                    .setFooter({ text: "Thank you for your enthusiasm!" })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            //discordid, usertag, autodartusername, average, profileurl

            const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants.json`;
            const participantName = `${interaction.user.tag} (${autodartUsername})`;
            const params = { api_key: process.env.API_KEY };
            const data = {
                participant: {
                    name: participantName,
                    challonge_username: challongeName,
                },
            };

            const response = await axios.post(apiUrl, data, { params });

            if (response.status !== 200 || !response.data.participant) {
                console.error(
                    "Unexpected response from Challonge:",
                    response.data
                );
                return interaction.reply(
                    "Unexpected response from Challonge. Please try again later."
                );
            }

            const challongeParticipantId = response.data.participant.id;
            await upsertUser(
                discordId,
                interaction.user.tag,
                autodartUsername,
                challongeParticipantId,
                average,
                profileUrl
            );
            await upsertParticipant(
                discordId,
                tournamentId,
                challongeParticipantId
            );

            const embed = new EmbedBuilder()
                .setColor(0x00ff99)
                .setTitle("League Sign-Up Successful!")
                .setDescription(
                    `You've successfully signed up for the league **${tournamentName}**!`
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: "Participant",
                        value: `${interaction.user.tag} (${autodartUsername})`,
                        inline: true,
                    },
                    {
                        name: "Tournament",
                        value: `${tournamentName}`,
                        inline: true,
                    },
                    {
                        name: "100-Leg Average",
                        value: `${average}`,
                        inline: true,
                    }
                )
                .setFooter({ text: "Good luck!" })
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error signing up for tournament:", error);
            interaction.reply(
                "An error occurred while signing up for the tournament. This is likely due to you already being signed up. Please contact an admin if you believe this is an error."
            );
        }
    },

    async autocomplete(interaction) {
        if (interaction.options.getFocused(true).name === "tournament") {
            const focusedValue = interaction.options.getFocused();

            // Fetch tournament names from the database
            const tournaments = await fetchTournamentsFromDatabase();

            // Filter tournaments based on user input and limit results to 25
            const filteredTournaments = tournaments
                .filter((tournament) =>
                    tournament.name
                        .toLowerCase()
                        .includes(focusedValue.toLowerCase())
                )
                .slice(0, 25);

            await interaction.respond(
                filteredTournaments.map((tournament) => ({
                    name: tournament.name,
                    value: tournament.name,
                }))
            );
        }
    },
};

const getAutodartsUsernameFromURL = async (profileUrl, keycloakClient) => {
    //extract userid from last part of the url
    const userId = profileUrl.split("/").pop();
    const apiURL = `https://api.autodarts.io/us/v0/users/${userId}`;
    const headers = { Authorization: `Bearer ${keycloakClient.accessToken}` };
    const response = await axios.get(apiURL, { headers });
    return response.data.name;
};
const getAutodartsUsernameFromID = async (userId, keycloakClient) => {
    const apiURL = `https://api.autodarts.io/us/v0/users/${userId}`;
    const headers = { Authorization: `Bearer ${keycloakClient.accessToken}` };
    const response = await axios.get(apiURL, { headers });
    if (!response.data.name) {
        return false;
    }
    return response.data.name;
};

const getLast100Average = async (profileUrl, keycloakClient) => {
    const userId = profileUrl.split("/").pop();
    const apiURL = `https://api.autodarts.io/as/v0/users/${userId}/stats/x01?limit=100`;
    const headers = { Authorization: `Bearer ${keycloakClient.accessToken}` };
    const response = await axios.get(apiURL, { headers });
    let last100Avg = response.data.average.average;

    //round to 2 decimal places
    return Math.round(last100Avg * 100) / 100;
};
