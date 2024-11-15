//command for users to see what tournaments they have signed up for

const {
    getTournamentStatusForUser,
    getTournamentNameById,
} = require("../../testdatamanager");
const { fetchTournamentsFromDatabase } = require("../../util");
const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription(
            "Shows all tournaments you have signed up for (optional extra info)"
        )
        .addStringOption((option) =>
            option
                .setName("league")
                .setDescription("League")
                .setRequired(false)
                .setAutocomplete(true)
        ),
    async autocomplete(interaction) {
        if (interaction.options.getFocused(true).name === "league") {
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
        //get all signups
        const userId = interaction.user.id;
        const tournaments = await getTournamentStatusForUser(userId);
        //this is dictionary {id: status} so we need to create a new object {name: status}
        let tournamentStatus = {};
        //loop through keys and get the name of the tournament
        for (const key in tournaments) {
            const name = await getTournamentNameById(key);
            tournamentStatus[name] = tournaments[key];
        }
        //create embed with a green circle for signed up and a red circle for not signed up
        const embed = new EmbedBuilder()
            .setTitle("Competition Status")
            .setColor(0x00ff00)
            .setTimestamp();

        // Create an array to hold the field objects
        const fields = [];

        // Iterate over tournamentStatus to dynamically create fields
        for (const key in tournamentStatus) {
            fields.push({
                name: `${tournamentStatus[key] == true ? "✅" : "❌"} ${key}`,
                value: "\u200B", // Invisible character to satisfy embed requirements
                inline: false, // Set to true if you want fields side-by-side
            });
        }

        // Add all fields to the embed at once
        embed.addFields(fields);

        await interaction.reply({ embeds: [embed] });
    },
};
