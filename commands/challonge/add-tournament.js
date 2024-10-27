const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-tournament')
        .setDescription('Adds a tournament in the local database using a Challonge ID.')
        .addStringOption(option =>
            option.setName('challonge_id')
                .setDescription('The ID of the Challonge tournament')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        const challongeId = interaction.options.getString('challonge_id');

        // Connect to SQLite database
        const db = new sqlite3.Database('./data.db', (err) => {
            if (err) {
                console.error('Database connection error:', err.message);
                return interaction.reply('Failed to connect to the database.');
            }
        });

        // Fetch tournament data from Challonge API
        const apiUrl = `https://api.challonge.com/v1/tournaments/${challongeId}.json`;
        const params = { api_key: process.env.API_KEY };

        try {
            const response = await axios.get(apiUrl, { params });
            const tournament = response.data.tournament;

            // SQL to insert tournament into the Tournaments table
            const sql = `
                INSERT INTO Tournaments (tournament_id, challonge_id, name, status, start_date, end_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            const tournamentData = [
                tournament.id,
                tournament.id,  // Challonge ID
                tournament.name,
                tournament.state,
                tournament.start_at ? tournament.start_at.split('T')[0] : null,  // Only date portion
                tournament.completed_at ? tournament.completed_at.split('T')[0] : null  // Only date portion
            ];

            db.run(sql, tournamentData, function(err) {
                if (err) {
                    console.error('Database insertion error:', err.message);
                    return interaction.reply(`Database insertion error: ${err.message}`);
                }
                console.log(`Tournament ${tournament.name} added with ID ${tournament.id}`);
                interaction.reply(`Tournament **${tournament.name}** has been successfully created in the database!`);
            });

        } catch (error) {
            console.error('Error fetching tournament data:', error.response ? error.response.data : error.message);
            interaction.reply('Failed to fetch tournament data from Challonge. Please check the Challonge ID.');
        } finally {
            // Close the database connection
            db.close((err) => {
                if (err) {
                    console.error('Error closing the database:', err.message);
                }
                console.log('Closed the database connection.');
            });
        }
    }
};
