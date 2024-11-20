const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const axios = require("axios");
const { insertNewTournament } = require("../../datamanager");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add-tournament")
        .setDescription(
            "Adds a tournament in the local database using a Challonge ID."
        )
        .addStringOption((option) =>
            option
                .setName("challonge_id")
                .setDescription("The ID of the Challonge tournament")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const challongeId = interaction.options.getString("challonge_id");

        // Connect to SQLite database
        const db = new sqlite3.Database("./data.db", (err) => {
            if (err) {
                console.error("Database connection error:", err.message);
                return interaction.reply("Failed to connect to the database.");
            }
        });

        // Fetch tournament data from Challonge API
        const apiUrl = `https://api.challonge.com/v1/tournaments/${challongeId}.json`;
        const params = { api_key: process.env.API_KEY };

        try {
            const response = await axios.get(apiUrl, { params });
            const tournament = response.data.tournament;

            // SQL to insert tournament into the Tournaments table
            insertNewTournament(tournament);

            await interaction.reply(
                `Tournament "${tournament.name}" added to the database.`
            );
        } catch (error) {
            console.error(
                "Error fetching tournament data:",
                error.response ? error.response.data : error.message
            );
            interaction.reply(
                "Failed to fetch tournament data from Challonge. Please check the Challonge ID."
            );
        } finally {
            // Close the database connection
            db.close((err) => {
                if (err) {
                    console.error("Error closing the database:", err.message);
                }
            });
        }
    },
};
