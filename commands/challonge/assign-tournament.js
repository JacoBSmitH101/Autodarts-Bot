const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('assign-tournament')
		.setDescription('Used to assign a challonge tournament to this server')
        .addStringOption(option =>
            option.setName('tournament_id')
                .setDescription('The ID of the tournament')
                .setRequired(true)),

	async execute(interaction) {
        const res = await add_tournament(interaction.guildId, interaction.options.getString('tournament_id'));
        if (res) {
            await interaction.reply("Tournament assigned to server");
        } else {
            await interaction.reply("Error assigning tournament to server");
        }
	}
};

async function add_tournament(serverId, tournamentId)  {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./data.db');

    console.log(`Adding tournament ${tournamentId} to server ${serverId}`);

    db.run(`CREATE TABLE IF NOT EXISTS tournaments (
        server_id TEXT,
        tournament_id TEXT,
        name TEXT,
        state TEXT,
        assigned_at INTEGER,
        PRIMARY KEY (server_id, tournament_id)
    )`);
    
    const timestamp = Date.now();
    let name = '';
    let state = '';
    try {
        // Define the API URL and parameters
        const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}.json`;
        const params = {
            api_key: process.env.API_KEY,  // Replace with your actual API key
            state: 'in_progress',          // Retrieve in-progress tournaments
        };

        const response = await axios.get(apiUrl, { params });

		// Check if there are tournaments to list
		const tournament = response.data;

        name = tournament.tournament.name;
        state = tournament.tournament.state;

        console.log(`Tournament ${tournamentId} found: ${name}`);
        console.log(`Tournament state: ${state}`);


    } catch (error) {
        console.error(error);
        return false;
    }

    db.run(
        `INSERT OR REPLACE INTO tournaments (server_id, tournament_id, name, state, assigned_at) 
        VALUES (?, ?, ?, ?, ?)`,
        [serverId, tournamentId, name, state, timestamp],
        function (err) {
            if (err) {
                console.error("Error adding tournament to DB:", err.message);
                return false;
            } else {
                console.log(`Tournament ${tournamentId} assigned to server ${serverId}`);
            }
        }
    );

    db.close();
    return true;
}