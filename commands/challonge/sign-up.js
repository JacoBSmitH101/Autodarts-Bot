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
} = require("../../datamanager.js");

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
                .setName("autodarts-name")
                .setDescription("Your Autodarts Name")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("last-100-average")
                .setDescription("Your average for the last 100 legs")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("challonge-username")
                .setDescription("(Optional) Challonge username")
                .setRequired(false)
        ),
    // .addStringOption((option) =>
    //     option
    //         .setName("test-user-id")
    //         .setDescription("(Optional) Discord ID for testing")
    //         .setRequired(false)
    // ),

    async execute(interaction) {
        const currentDate = new Date();
        const startDate = new Date("2025-06-01");

        if (
            currentDate < startDate &&
            !interaction.member.permissions.has("ADMINISTRATOR")
        ) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Sign-Ups not open yet!!!")
                .setDescription("Sign-ups for this tournament are closed.")
                .setFooter({ text: "Please try again next season" })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const tournamentName = interaction.options.getString("tournament");
        const tournamentId = await getTournamentIdByName(tournamentName);
        const status = await getTournamentStatus(tournamentId);

        if (status !== "pending") {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Sign-Ups Closed!")
                .setDescription("Sign-ups for this tournament are closed.")
                .setFooter({ text: "Please try again next season" })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Commented out old profileUrl logic
        // const profileUrl = interaction.options.getString("autodart-profile-url");
        // console.log(
        //     `[${new Date().toISOString()}] Autodarts profile URL: ${profileUrl}`
        // );

        // Now we fetch from the new inputs
        const autodartName = interaction.options.getString("autodarts-name");
        console.log(
            `[${new Date().toISOString()}] Autodarts name: ${autodartName}`
        );

        let autodartUsername = autodartName;

        let average = interaction.options.getString("last-100-average");
        //check if average has been used with a . or , and replace with .
        average = average.replace(",", ".");
        //make average a float with 2 decimal places
        average = Math.round(average * 100) / 100;
        const challongeName =
            interaction.options.getString("challonge-username");
        const testId = interaction.options.getString("test-user-id");
        const discordId = testId || interaction.user.id;

        try {
            const user = await getParticipantDataFromTournamentUserId(
                tournamentId,
                discordId
            );

            if (user) {
                const embed = new EmbedBuilder()
                    .setColor(0xffcc00)
                    .setTitle("Already Signed Up")
                    .setDescription(
                        "You're already signed up for this tournament!"
                    )
                    .setFooter({ text: "Thank you for your enthusiasm!" })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

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
                ""
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
                        value: participantName,
                        inline: true,
                    },
                    { name: "Tournament", value: tournamentName, inline: true },
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
            interaction.reply(
                "An error occurred while signing up for the tournament. Please contact an admin if you believe this is an error."
            );
        }
    },

    async autocomplete(interaction) {
        if (interaction.options.getFocused(true).name === "tournament") {
            const focusedValue = interaction.options.getFocused();

            const tournaments = await fetchTournamentsFromDatabase();
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

// Commented out the old helper functions for retrieving from the URL/ID and last 100 average

/*
const getAutodartsUsernameFromURL = async (profileUrl, keycloakClient) => {
    console.log(
        `[${new Date().toISOString()}] Fetching Autodarts username from URL: ${profileUrl}`
    );
    //extract userid from last part of the url
    const userId = profileUrl.split("/").pop();
    const apiURL = `https://api.autodarts.io/us/v0/users/${userId}`;
    const headers = { Authorization: `Bearer ${keycloakClient.accessToken}` };
    const response = await axios.get(apiURL, { headers });
    console.log(
        `[${new Date().toISOString()}] Retrieved username: ${response.data.name}`
    );
    return response.data.name;
};

const getAutodartsUsernameFromID = async (userId, keycloakClient) => {
    console.log(
        `[${new Date().toISOString()}] Fetching Autodarts username from ID: ${userId}`
    );
    const apiURL = `https://api.autodarts.io/us/v0/users/${userId}`;
    const headers = { Authorization: `Bearer ${keycloakClient.accessToken}` };
    const response = await axios.get(apiURL, { headers });
    if (!response.data.name) {
        console.log(
            `[${new Date().toISOString()}] No username found for ID: ${userId}`
        );
        return false;
    }
    console.log(
        `[${new Date().toISOString()}] Retrieved username: ${response.data.name}`
    );
    return response.data.name;
};

const getLast100Average = async (profileUrl, keycloakClient) => {
    console.log(
        `[${new Date().toISOString()}] Fetching last 100 game average for profile: ${profileUrl}`
    );
    const userId = profileUrl.split("/").pop();
    const apiURL = `https://api.autodarts.io/as/v0/users/${userId}/stats/x01?limit=100`;
    const headers = { Authorization: `Bearer ${keycloakClient.accessToken}` };
    const response = await axios.get(apiURL, { headers });
    let last100Avg = response.data.average.average;

    //round to 2 decimal places
    const roundedAvg = Math.round(last100Avg * 100) / 100;
    console.log(
        `[${new Date().toISOString()}] Retrieved average: ${roundedAvg}`
    );
    return roundedAvg;
};
*/
