const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('submit-match')
		.setDescription('Used to submit a match to Challonge pending confirmation')
		.addStringOption(option =>
			option.setName('category')
				.setDescription('The match category')
				.setRequired(true)
				.addChoices(
					{ name: 'League', value: 'league' },
					{ name: 'Tournament', value: 'tournament' },
				))
		.addUserOption(option =>
			option.setName('opponent')
				.setDescription('Opponent name')
				.setRequired(true))
		.addNumberOption(option =>
			option.setName('your_score')
				.setDescription('Legs won by you')
				.setRequired(true))
		.addNumberOption(option =>
			option.setName('opponent_score')
				.setDescription('Legs won by opponent')
				.setRequired(true)),

	async execute(interaction) {
		const category = interaction.options.getString('category');
		const opponent = interaction.options.getUser('opponent');
		const submitter = interaction.user;
		const yourScore = interaction.options.getNumber('your_score');
		const opponentScore = interaction.options.getNumber('opponent_score');

		// Create the embed message
		const embed = new EmbedBuilder()
			.setColor(0x00FF99)
			.setTitle('Match Submission Pending Confirmation')
			.setDescription(`Match Category: **${category.charAt(0).toUpperCase() + category.slice(1)}**`)
			.addFields(
				{ name: 'Submitted By', value: `<@${submitter.id}>`, inline: true },
				{ name: 'Score', value: `${yourScore} - ${opponentScore}`, inline: true },
				{ name: 'Opponent', value: `<@${opponent.id}>`, inline: true }
			)
			.setTimestamp()
			.setFooter({ text: `Waiting for ${opponent.tag} approval` });

		// Create buttons for Confirm and Reject
		const confirmButton = new ButtonBuilder()
			.setCustomId('confirm')
			.setLabel('Confirm')
			.setStyle(ButtonStyle.Success);

		const rejectButton = new ButtonBuilder()
			.setCustomId('reject')
			.setLabel('Reject')
			.setStyle(ButtonStyle.Danger);

		// Action row to hold the buttons
		const row = new ActionRowBuilder()
			.addComponents(confirmButton, rejectButton);

		// Send the embed with buttons
		await interaction.reply({ embeds: [embed], components: [row] });
	}
};
