//command to see stats on who has signed up for a tournament

const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");
const { PermissionFlagsBits } = require("discord.js");
const { getAllParticipants } = require("../../datamanager");
const { fetchTournamentsFromDatabase } = require("../../util");
const { getTournamentIdByName } = require("../../datamanager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sign-up-stats")
        .setDescription(
            "Shows statistics on who has signed up for a tournament"
        )
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The name of the tournament")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        //get all signups
        const tournamentName = interaction.options.getString("tournament");
        const tournamentId = await getTournamentIdByName(tournamentName);
        const participants = await getAllParticipants(tournamentId);

        //count all signups
        const totalParticipants = participants.length;

        //also calulate how many signed up today
        const today = new Date();
        const todaySignups = participants.filter((participant) => {
            const signupDate = new Date(participant.updated_at);
            return (
                signupDate.getDate() === today.getDate() &&
                signupDate.getMonth() === today.getMonth() &&
                signupDate.getFullYear() === today.getFullYear()
            );
        }).length;
        //embed message
        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Sign-up Stats")
            .addFields(
                {
                    name: "Total Participants",
                    value: totalParticipants.toString(),
                    inline: false,
                },
                {
                    name: "Participants Today",
                    value: todaySignups.toString(),
                    inline: false,
                }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async autocomplete(interaction) {
        if (interaction.options.getFocused(true).name === "tournament") {
            const focusedValue = interaction.options.getFocused();

            // Fetch tournament names from the database
            const tournaments = await fetchTournamentsFromDatabase();

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
