// //command to view ALL upcoming matches
// //have options to limit to a certain number of matches
// //as well as an autocomplete for the tournament name
// //and an autocomplete for the group (optional) which will be calculated
// //based on group_id in the matches table, lowest number is Division 1, etc.
// //if no group is specified, show all upcoming matches
// module.exports = {
//     data: new SlashCommandBuilder()
//         .setName("upcoming-matches")
//         .setDescription("Lists all upcoming matches")
//         .addStringOption((option) =>
//             option
//                 .setName("tournament")
//                 .setDescription("The name of the tournament")
//                 .setRequired(true)
//                 .setAutocomplete(true)
//         )
//         .addStringOption((option) =>
//             option
//                 .setName("group")
//                 .setDescription("The group of the tournament")
//                 .setRequired(false)
//                 .setAutocomplete(true)
//         )
//         .addIntegerOption((option) =>
//             option
//                 .setName("amount")
//                 .setDescription("The number of matches to display")
//                 .setRequired(false)
//         ),
//     async autocomplete(interaction) {
//         if (interaction.options.getFocused(true).name === "tournament") {
//             const focusedValue = interaction.options.getFocused();

//             // Fetch tournament names from the database
//             const tournaments = await fetchTournamentsFromDatabase();

//             // Filter tournaments based on user input and limit results to 25
//             const filteredTournaments = tournaments
//                 .filter((tournament) =>
//                     tournament.name
//                         .toLowerCase()
//                         .includes(focusedValue.toLowerCase())
//                 )
//                 .slice(0, 25);

//             await interaction.respond(
//                 filteredTournaments.map((tournament) => ({
//                     name: tournament.name,
//                     value: tournament.name,
//                 }))
//             );
//         }

//         if (interaction.options.getFocused(true).name === "group") {
//             const focusedValue = interaction.options.getFocused();

//             // Fetch tournament names from the database
//             const groups = await fetchGroupsFromDatabase();

//             // Filter groups based on user input and limit results to 25
//             const filteredGroups = groups
//                 .filter((group) =>
//                     group.name
//                         .toLowerCase()
//                         .includes(focusedValue.toLowerCase())
//                 )
//                 .slice(0, 25);

//             await interaction.respond(
//                 filteredGroups.map((group) => ({
//                     name: group.name,
//                     value: group.name,
//                 }))
//             );
//         }
//     },
//     async execute(interaction) {
//         const matchAmount = interaction.options.getInteger("amount") || 5;

//         const tournamentName = interaction.options.getString("tournament");
//         const group = interaction.options.getString("group");

//         interaction.reply("testing");
//     },
// };
