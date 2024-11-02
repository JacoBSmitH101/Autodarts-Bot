const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");
const {
    getTournamentIdByName,
    fetchTournamentsFromDatabase,
    getNameFromChallongeId,
} = require("../../util");
const sqlite3 = require("sqlite3").verbose();
module.exports = {
    data: new SlashCommandBuilder()
        .setName("show-standings")
        .setDescription("Shows the standings of the specified tournament")
        .addStringOption((option) =>
            option
                .setName("tournament")
                .setDescription("The name of the tournament")
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        console.log("Show Standings");

        const tournamentName = interaction.options.getString("tournament");
        const tournamentId = await getTournamentIdByName(tournamentName);

        let standings = {
            tournamentId,
            tournamentName,
            groups: {},
        };

        const db = new sqlite3.Database("./data.db", (err) => {
            if (err) {
                console.error("Database connection error:", err.message);
                return interaction.reply("Failed to connect to the database.");
            }
        });

        const matches = await new Promise((resolve, reject) => {
            db.all(
                "SELECT * FROM matches WHERE tournament_id = ?",
                [tournamentId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });

        for (const match of matches) {
            const groupId = match.group_id;
            if (!groupId) continue;

            if (!standings.groups[groupId]) {
                standings.groups[groupId] = { standings: {} };
            }

            const playerIds = [match.player1_id, match.player2_id];
            for (const playerId of playerIds) {
                if (!standings.groups[groupId].standings[playerId]) {
                    standings.groups[groupId].standings[playerId] = {
                        rank: 0,
                        name: (await getNameFromChallongeId(playerId, false))
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

            const [player1, player2] = playerIds;
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
                standings.groups[groupId].standings[player1].points += 3;
                standings.groups[groupId].standings[player1].played++;
                standings.groups[groupId].standings[player2].played++;
            } else if (match.winner_id === player2) {
                standings.groups[groupId].standings[player2].wins++;
                standings.groups[groupId].standings[player1].losses++;
                standings.groups[groupId].standings[player2].points += 3;
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
        for (const groupId in standings.groups) {
            const group = standings.groups[groupId];
            const sortedStandings = Object.values(group.standings).sort(
                (a, b) => b.points - a.points
            );

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`Standings for Division ${++i}`)
                .setDescription(`Tournament: **${tournamentName}**`)
                .setTimestamp();

            let tableContent = `\`\`\`Rank Name            Points Played Wins Losses Draws\n`;
            tableContent += `---------------------------------------------------\n`;

            sortedStandings.forEach((player, index) => {
                tableContent += `${(index + 1)
                    .toString()
                    .padEnd(4)} ${player.name.padEnd(15)} ${player.points
                    .toString()
                    .padEnd(6)} ${player.played
                    .toString()
                    .padEnd(7)} ${player.wins
                    .toString()
                    .padEnd(5)} ${player.losses
                    .toString()
                    .padEnd(7)} ${player.draws.toString().padEnd(5)}\n`;
            });

            tableContent += "```";

            embed.addFields({
                name: `https://challonge.com/7n7p66vo`,
                value: tableContent,
            });

            await interaction.followUp({ embeds: [embed], ephemeral: true });
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
