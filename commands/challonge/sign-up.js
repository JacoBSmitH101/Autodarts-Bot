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
        // Commented out the old Autodart profile URL requirement
        // .addStringOption((option) =>
        //     option
        //         .setName("autodart-profile-url")
        //         .setDescription("Autodart URL")
        //         .setRequired(true)
        // )
        // New options for autodarts name and average
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

    async execute(interaction) {
        //TODO REVIEW BEFORE NEXT SEASON
        console.log(
            `[${new Date().toISOString()}] Sign-up command initiated by ${
                interaction.user.tag
            } (${interaction.user.id})`
        );
        //if date before 02/03/2025 then reject
        const currentDate = new Date();
        const startDate = new Date("2025-03-02");
        //if user is admin, allow sign-up
        if (
            currentDate < startDate &&
            !interaction.member.permissions.has("ADMINISTRATOR")
        ) {
            console.log(
                `[${new Date().toISOString()}] Sign-up rejected - date before 02/03/2025`
            );
            const embed = new EmbedBuilder()

                .setColor(0xff0000) // Red color for an error
                .setTitle("Sign-Ups not open yet!!!")
                .setDescription("Sign-ups for this tournament are closed.")
                .setFooter({ text: "Please try again next season" })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const tournamentName = interaction.options.getString("tournament");
        console.log(
            `[${new Date().toISOString()}] Tournament requested: ${tournamentName}`
        );

        const tournamentId = await getTournamentIdByName(tournamentName);
        const status = await getTournamentStatus(tournamentId);
        console.log(
            `[${new Date().toISOString()}] Tournament status: ${status}`
        );

        if (status !== "pending") {
            console.log(
                `[${new Date().toISOString()}] Sign-up rejected - tournament not pending`
            );
            const embed = new EmbedBuilder()
                .setColor(0xff0000) // Red color for an error
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
        console.log(
            `[${new Date().toISOString()}] Provided average: ${average}`
        );

        // get challonge name if provided
        const challongeName =
            interaction.options.getString("challonge-username");

        if (challongeName) {
            console.log(
                `[${new Date().toISOString()}] Challonge username provided: ${challongeName}`
            );
        }

        // Commented out code for validating and retrieving data from profile URL:
        // const regex = new RegExp(
        //     "^(https://play.autodarts.io/users/|([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}))$"
        // );
        // if (!regex.test(profileUrl)) {
        //     console.log(
        //         `[${new Date().toISOString()}] Invalid profile URL format: ${profileUrl}`
        //     );
        //     return interaction.reply(
        //         "Invalid Autodarts profile URL or ID. Please provide a valid URL."
        //     );
        // }

        // //check if url is valid eg: https://play.autodarts.io/users/bb229295-742d-429f-bbbf-fe4a179ef537
        // if (!profileUrl.startsWith("https://play.autodarts.io/users/")) {
        //     try {
        //         console.log(
        //             `[${new Date().toISOString()}] Fetching username from ID: ${profileUrl}`
        //         );
        //         autodartUsername = await getAutodartsUsernameFromID(
        //             profileUrl,
        //             interaction.client.keycloakClient
        //         );
        //         if (!autodartUsername) {
        //             console.log(
        //                 `[${new Date().toISOString()}] Failed to get username for ID: ${profileUrl}`
        //             );
        //             return interaction.reply(
        //                 "Invalid Autodarts profile URL or ID. Please provide a valid URL."
        //             );
        //         }
        //     } catch (error) {
        //         console.error(
        //             `[${new Date().toISOString()}] Error getting autodarts username:`,
        //             error
        //         );
        //         return interaction.reply(
        //             "An error occurred while fetching the Autodarts username. Please try again later."
        //         );
        //     }
        // } else {
        //     console.log(
        //         `[${new Date().toISOString()}] Fetching username from URL: ${profileUrl}`
        //     );
        //     autodartUsername = await getAutodartsUsernameFromURL(
        //         profileUrl,
        //         interaction.client.keycloakClient
        //     );
        // }
        // console.log(
        //     `[${new Date().toISOString()}] Retrieved autodarts username: ${autodartUsername}`
        // );

        // average = await getLast100Average(
        //     profileUrl,
        //     interaction.client.keycloakClient
        // );
        // console.log(
        //     `[${new Date().toISOString()}] Retrieved 100-leg average: ${average}`
        // );

        const testId = interaction.options.getString("test_user_id");
        const discordId = testId || interaction.user.id;

        try {
            //first check if already signed up
            const user = await getParticipantDataFromTournamentUserId(
                tournamentId,
                discordId
            );

            if (user) {
                console.log(
                    `[${new Date().toISOString()}] User ${discordId} already signed up for tournament ${tournamentId}`
                );
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

            console.log(
                `[${new Date().toISOString()}] Registering participant with Challonge: ${participantName}`
            );
            const response = await axios.post(apiUrl, data, { params });

            if (response.status !== 200 || !response.data.participant) {
                console.error(
                    `[${new Date().toISOString()}] Unexpected response from Challonge:`,
                    response.data
                );
                return interaction.reply(
                    "Unexpected response from Challonge. Please try again later."
                );
            }

            const challongeParticipantId = response.data.participant.id;
            console.log(
                `[${new Date().toISOString()}] Challonge registration successful. Participant ID: ${challongeParticipantId}`
            );

            // For the upsert, we no longer have a real profileUrl, so we can store "N/A" or something similar
            // or we can store an empty string if needed.
            await upsertUser(
                discordId,
                interaction.user.tag,
                autodartUsername,
                challongeParticipantId,
                average,
                "" // or store an empty string if you prefer
            );
            await upsertParticipant(
                discordId,
                tournamentId,
                challongeParticipantId
            );
            console.log(
                `[${new Date().toISOString()}] Database records updated successfully`
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

            console.log(
                `[${new Date().toISOString()}] Sign-up process completed successfully for ${
                    interaction.user.tag
                }`
            );
            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(
                `[${new Date().toISOString()}] Error signing up for tournament:`,
                error
            );
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
            //filter out tournaments that are not pending
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
