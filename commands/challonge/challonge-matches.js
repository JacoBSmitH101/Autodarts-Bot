const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require("dotenv").config();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list-matches')
		.setDescription('Lists all matches for a specified tournament')
		.addStringOption(option => 
			option.setName('tournament_id')
				.setDescription('The ID or URL of the tournament')
				.setRequired(true)),
	async execute(interaction) {
		try {
			// Retrieve the tournament ID from the command options
			const tournamentId = interaction.options.getString('tournament_id');

			// Define the API URLs
			const matchesUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/matches.json`;
			const participantsUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants.json`;

			// Define API parameters
			const params = {
				api_key: process.env.API_KEY, // Replace with your actual API key
			};

			// Fetch participants to map player IDs to names
			const participantsResponse = await axios.get(participantsUrl, { params });
			const participants = participantsResponse.data;

			// Create a map of participant IDs to names
			const participantMap = {};
			participants.forEach(participant => {
				participantMap[participant.participant.id] = participant.participant.name;
			});

			// Fetch matches
			const matchesResponse = await axios.get(matchesUrl, { params });
			const matches = matchesResponse.data;

			// Check if there are matches to list
			if (matches.length === 0) {
				await interaction.reply('No matches found for this tournament.');
				return;
			}

			// Create an embed to display match details
			const embed = new EmbedBuilder()
				.setTitle(`Matches for Tournament ID: ${tournamentId}`)
				.setDescription('Here are the matches for the specified tournament:')
				.setColor(0x00FF99);

			// Add each match as a field in the embed
			matches.forEach(match => {
				const player1Name = participantMap[match.match.player1_id] || 'Unknown';
				const player2Name = participantMap[match.match.player2_id] || 'Unknown';
				const winnerName = participantMap[match.match.winner_id] || 'TBD';

				embed.addFields({
					name: `Match ID: ${match.match.id}`,
					value: `State: ${match.match.state}\nPlayer 1: ${player1Name}\nPlayer 2: ${player2Name}\nWinner: ${winnerName}`
				});
			});

			// Send the embed in response
			await interaction.reply({ embeds: [embed] });

		} catch (error) {
			console.error(error);
			await interaction.reply('There was an error retrieving matches. Please check the tournament ID and try again.');
		}
	}
};
