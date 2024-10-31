const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");
const {
    fetchTournamentsFromDatabase,
    getTournamentIdByName,
} = require("../../util");
const sqlite3 = require("sqlite3").verbose();

const { getSortedParticipants } = require("./show-seeds");
const { autocomplete } = require("./sign-up");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("start-tournament")
        .setDescription("Begin a league/tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The name of the tournament.")
                .setRequired(true)
                .setAutocomplete(true)
        ),
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

    async execute(interaction) {
        const tournamentName = interaction.options.getString("tournament");
        const tournamentId = await getTournamentIdByName(tournamentName);

        if (!tournamentId) {
            return interaction.reply(
                `Tournament "${tournamentName}" not found.`
            );
        }

        const participants = await getSortedParticipants(
            tournamentId.tournament_id
        );

        const embeds = [];
        const chunks = splitMessage(
            participants.map((p) => `${p.autodarts_name} - ${p.avg}`).join("\n")
        );

        for (const chunk of chunks) {
            const embed = new MessageEmbed()
                .setTitle(`Seeds for ${tournamentName}`)
                .setDescription(chunk);
            embeds.push(embed);
        }

        await interaction.reply({ embeds });
    },
};
