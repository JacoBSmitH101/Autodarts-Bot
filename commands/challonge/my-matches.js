const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const {
  fetchTournamentsFromDatabase,
  getTournamentIdByName,
} = require("../../util");

// Helper function to retrieve autodarts name from database
const getAutodartsName = async (discordId) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database("./data.db");
    db.get(
      `SELECT autodarts_name FROM Users WHERE user_id = ?`,
      [discordId],
      (err, row) => {
        db.close();
        if (err) {
          console.error("Error retrieving Autodarts name:", err.message);
          reject("Failed to retrieve Autodarts name.");
        } else {
          resolve(row ? row.autodarts_name : null);
        }
      }
    );
  });
};

// Helper function to fetch participant details and matches from Challonge
const getParticipantMatches = async (tournamentId, challongeUsername) => {
  const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants.json`;
  const params = { api_key: process.env.API_KEY };

  try {
    const response = await axios.get(apiUrl, { params });
    const participants = response.data;

    // Find the participant's ID
    const participant = participants.find(
      (p) => p.participant.name === challongeUsername
    );
    if (!participant) return null;

    // Fetch participant with matches included
    const participantId = participant.participant.id;
    const matchesUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants/${participantId}.json`;
    const matchResponse = await axios.get(matchesUrl, {
      params: { api_key: process.env.API_KEY, include_matches: 1 },
    });

    return matchResponse.data.participant.matches;
  } catch (error) {
    console.error("Error fetching participant and matches:", error.message);
    throw new Error("Failed to fetch participant matches.");
  }
};

// Command to list user's matches
module.exports = {
  data: new SlashCommandBuilder()
    .setName("my-matches")
    .setDescription("Lists your matches in the tournament.")
    .addStringOption((option) =>
      option
        .setName("tournament")
        .setDescription("Name of the tournament")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    if (interaction.options.getFocused(true).name === "tournament") {
      const focusedValue = interaction.options.getFocused();
      const tournaments = await fetchTournamentsFromDatabase(
        interaction.guildId
      );

      const filteredTournaments = tournaments
        .filter((tournament) =>
          tournament.name.toLowerCase().includes(focusedValue.toLowerCase())
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
    const discordTag = interaction.user.tag;
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
      // Retrieve user's Autodarts name and format Challonge username
      const autodartsName = await getAutodartsName(userId);
      if (!autodartsName) {
        return interaction.editReply(
          "Your Autodarts name could not be found. Please ensure you are registered."
        );
      }
      const challongeUsername = `${discordTag} (${autodartsName})`;

      // Retrieve the tournament ID
      const tournamentId = await getTournamentIdByName(tournamentName);
      if (!tournamentId) {
        return interaction.editReply("Tournament not found.");
      }

      // Fetch user's matches from Challonge
      const userMatches = await getParticipantMatches(
        tournamentId,
        challongeUsername
      );
      if (!userMatches || userMatches.length === 0) {
        return interaction.editReply("You have no matches in this tournament.");
      }

      // Format match details
      let result = `**Your Matches in ${tournamentName}:**\n`;
      userMatches.forEach((matchData, index) => {
        const match = matchData.match;
        const isPlayer1 = match.player1_id === userId;
        const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
        const userScore = isPlayer1
          ? match.scores_csv.split("-")[0]
          : match.scores_csv.split("-")[1];
        const opponentScore = isPlayer1
          ? match.scores_csv.split("-")[1]
          : match.scores_csv.split("-")[0];

        result += `\n**Match ${index + 1}:**\n`;
        result += `- **Opponent ID:** ${opponentId}\n`;
        result += `- **Score:** ${userScore} - ${opponentScore}\n`;
        result += `- **Status:** ${match.state}\n`;
      });

      await interaction.editReply(result);
    } catch (error) {
      console.error("Error in my-matches command:", error.message);
      await interaction.editReply(
        "An error occurred while retrieving your matches."
      );
    }
  },
};
