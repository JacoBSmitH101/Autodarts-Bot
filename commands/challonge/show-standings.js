const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");
const {
    fetchTournamentsFromDatabase,
    getNameFromChallongeId,
    getLeagueStandings,
} = require("../../util");
const {
    getTournamentIdByName,
    getChallongeTournamentURL,
    getTournamentStatus,
} = require("../../testdatamanager");
const sqlite3 = require("sqlite3").verbose();
const { table } = require("table");
const { getAllMatchesFromTournamentId } = require("../../testdatamanager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("standings")
        .setDescription("Shows the standings of the specified tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The name of the tournament")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
            option

                .setName("division")
                .setDescription("The division number")
                .setRequired(false)
        )

        .addBooleanOption((option) =>
            option
                .setName("mobile")
                .setDescription(
                    "If true, shows a reduced table for mobile viewing"
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const tournamentName = interaction.options.getString("tournament");
        const mobileView = interaction.options.getBoolean("mobile") || false;
        const tournamentId = await getTournamentIdByName(tournamentName);
        const status = await getTournamentStatus(tournamentId);

        if (status == "pending") {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Error")
                .setDescription(
                    "The tournament has not started yet. Please wait for the tournament to start before viewing the standings."
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        let standings = {
            tournamentId,
            tournamentName,
            groups: {},
        };

        const tournamentUrl = await getChallongeTournamentURL(tournamentId);

        const matches = await getAllMatchesFromTournamentId(tournamentId);

        for (const match of matches) {
            const groupId = match.group_id;
            if (!groupId) continue;

            if (!standings.groups[groupId]) {
                standings.groups[groupId] = { standings: {} };
            }

            const playerIds = [match.player1_id, match.player2_id];
            for (const playerId of playerIds) {
                if (!standings.groups[groupId].standings[playerId]) {
                    if (mobileView) {
                        standings.groups[groupId].standings[playerId] = {
                            name: (
                                await getNameFromChallongeId(playerId, false)
                            )
                                .substring(0, 7)
                                .padEnd(7, " "),
                            points: 0,
                            played: 0,
                        };
                    } else {
                        standings.groups[groupId].standings[playerId] = {
                            rank: 0,
                            name: (
                                await getNameFromChallongeId(playerId, false)
                            )
                                .substring(0, 15)
                                .padEnd(15, " "),
                            wins: 0,
                            losses: 0,
                            draws: 0,
                            points: 0,
                            played: 0,
                        };
                    }
                }
            }

            const [player1, player2] = playerIds;
            //add one point for each leg won for each player no matter the result
            standings.groups[groupId].standings[player1].points +=
                match.player1_score;
            standings.groups[groupId].standings[player2].points +=
                match.player2_score;

            if (match.winner_id === "draw") {
                standings.groups[groupId].standings[player1].draws++;
                standings.groups[groupId].standings[player2].draws++;
                standings.groups[groupId].standings[player1].points++;
                standings.groups[groupId].standings[player2].points++;
                standings.groups[groupId].standings[player1].played++;
                standings.groups[groupId].standings[player2].played++;
            } else if (match.winner_id === player1) {
                standings.groups[groupId].standings[player1].wins++;
                standings.groups[groupId].standings[player2].losses++;
                standings.groups[groupId].standings[player1].points += 2;
                standings.groups[groupId].standings[player1].played++;
                standings.groups[groupId].standings[player2].played++;
            } else if (match.winner_id === player2) {
                standings.groups[groupId].standings[player2].wins++;
                standings.groups[groupId].standings[player1].losses++;
                standings.groups[groupId].standings[player2].points += 2;
                standings.groups[groupId].standings[player2].played++;
                standings.groups[groupId].standings[player1].played++;
            }
        }

        standings.groups = Object.fromEntries(
            Object.entries(standings.groups).sort((a, b) => a[0] - b[0])
        );

        await interaction.reply({
            content: "Generating standings...",
            ephemeral: true,
        });

        let i = 0;

        // Get the division number, if specified
        const division = interaction.options.getInteger("division");

        for (const groupId in standings.groups) {
            i++; // Increment the division index for display
            const group = standings.groups[groupId];
            const sortedStandings = Object.values(group.standings).sort(
                (a, b) => b.points - a.points
            );

            // If a specific division is requested, skip other groups
            if (division && division !== i) {
                continue;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`Standings for Division ${i}`)
                .setDescription(`Tournament: **${tournamentName}**`)
                .setTimestamp();

            // Prepare table data conditionally based on `mobileView`
            const tableData = mobileView
                ? [
                      ["Pos", "Name", "Pld", "Pts"],
                      ...sortedStandings.map((player, index) => [
                          index + 1,
                          player.name,
                          player.played,
                          player.points,
                      ]),
                  ]
                : [
                      ["Pos", "Name", "Pld", "Pts", "Win", "Los", "Drw"],
                      ...sortedStandings.map((player, index) => [
                          index + 1,
                          player.name,
                          player.played,
                          player.points,
                          player.wins,
                          player.losses,
                          player.draws,
                      ]),
                  ];

            // Generate table string using `table` package
            const tableContent = table(tableData);

            embed.addFields({
                name: `${tournamentUrl}`,
                value: `\`\`\`${tableContent}\`\`\``,
            });

            await interaction.followUp({ embeds: [embed], ephemeral: true });

            // Stop after processing the requested division
            if (division) {
                break;
            }
        }

        // Delete the original interaction reply
        await interaction.deleteReply();
    },
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const tournaments = await fetchTournamentsFromDatabase(
            interaction.guildId
        );

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
    },
};
