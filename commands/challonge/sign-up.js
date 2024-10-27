const { SlashCommandBuilder } = require('discord.js');
const { fetchTournamentsFromDatabase } = require('../../util.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sign-up')
        .setDescription('Sign up for a tournament')
        .addStringOption(option =>
            option.setName('tournament')
                .setDescription('Tournament')
                .setRequired(true)
                .setAutocomplete(true) // Enable autocomplete for dynamic choices
        )
        .addStringOption(option =>
            option.setName("autodart-username")
                .setDescription("Autodart username")
                .setRequired(true)
        )
        
        .addNumberOption(option =>
            option.setName("average")
                .setDescription("100 Leg Average")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("challonge-username")
                .setDescription("Challonge Username (Optional)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const tournamentName = interaction.options.getString('tournament');
        await interaction.reply(`You have successfully signed up for the tournament: ${tournamentName}`);
    },

    async autocomplete(interaction) {
        // Check if the interaction is for the "tournament" option
        if (interaction.options.getFocused(true).name === 'tournament') {
            const focusedValue = interaction.options.getFocused();
            
            // Fetch tournament names from the database
            const tournaments = await fetchTournamentsFromDatabase(interaction.guildId);

            // Filter tournaments based on the user's input and limit results to 25 (Discord's max)
            const filteredTournaments = tournaments
                .filter(tournament => tournament.name.toLowerCase().includes(focusedValue.toLowerCase()))
                .slice(0, 25);

            // Respond with formatted choices
            await interaction.respond(
                filteredTournaments.map(tournament => ({ name: tournament.name, value: tournament.name }))
            );
        }
    },
};
