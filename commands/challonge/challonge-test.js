const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require("dotenv").config();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list-tournaments')
		.setDescription('Lists all Challonge tournaments'),
	async execute(interaction) {
		try {
			// Define the API URL and parameters
			const apiUrl = 'https://api.challonge.com/v1/tournaments.json';
			const params = {
				api_key: process.env.API_KEY,  // Replace with your actual API key
				state: 'in_progress',                      // Retrieve all states (pending, in_progress, etc.)
			};

			// Make the GET request to Challonge
			const response = await axios.get(apiUrl, { params });

			// Check if there are tournaments to list
			const tournaments = response.data;
			if (tournaments.length === 0) {
				await interaction.reply('No tournaments found.');
				return;
			}

			// Create an embed to display tournament details
			const embed = new EmbedBuilder()
				.setTitle('Challonge Tournaments')
				.setDescription('Here are the latest tournaments:')
				.setColor(0x00FF99);

			// Add each tournament as a field in the embed
			tournaments.forEach(tournament => {
				embed.addFields({
					name: tournament.tournament.name,
					value: `State: ${tournament.tournament.state}\nType: ${tournament.tournament.tournament_type}\nURL: [Link](${tournament.tournament.full_challonge_url})`
				});
			});

			// Send the embed in response
			await interaction.reply({ embeds: [embed] });

		} catch (error) {
			console.error(error);
			await interaction.reply('There was an error retrieving tournaments. Please try again later.');
		}
	}
};
