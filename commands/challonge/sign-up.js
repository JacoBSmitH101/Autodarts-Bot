const { SlashCommandBuilder } = require('discord.js');
const { fetchTournamentsFromDatabase } = require('../../util.js').fetchTournamentsFromDatabase;
//TODO needs to be better
module.exports = {
    data: new SlashCommandBuilder()
        .setName('sign-up')
        .setDescription('Sign up for a tournament')
        .addStringOption(option =>
            option.setName('tournament')
                .setDescription('Tournament')
                .setRequired(true)
                .addChoices(
                    {name: "Season 2", value: "season2"},
                    {name: "Tournament (TBC)", value: "tournament_tbc"},
                ))
        .addStringOption(option =>
            option.setName("autodart-username")
                .setDescription("Autodart username")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("challonge-username")
                .setDescription("Challonge Username (Optional)")
                .setRequired(false)),
            
    async execute(interaction) {
        // Handle tournament sign-up logic here
        const tournamentName = interaction.options.getString('tournament');
        await interaction.reply(`You have successfully signed up for the tournament: ${tournamentName}`);
    },
};



