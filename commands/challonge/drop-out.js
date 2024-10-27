const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const { fetchTournamentsFromDatabase } = require("../../util");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("drop-out")
    .setDescription("Drop out from a tournament")
    .addStringOption((option) =>
      option
        .setName("tournament")
        .setDescription("Tournament name to drop out from")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const tournamentName = interaction.options.getString("tournament");
    const discordId = interaction.user.id;

    // Connect to SQLite database
    const db = new sqlite3.Database("./data.db", (err) => {
      if (err) {
        console.error("Database connection error:", err.message);
        return interaction.reply("Failed to connect to the database.");
      }
    });

    try {
      // Step 1: Retrieve tournament_id and participant details
      const tournamentRow = await new Promise((resolve, reject) => {
        db.get(
          `SELECT tournament_id FROM Tournaments WHERE name = ?`,
          [tournamentName],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!tournamentRow) {
        return interaction.reply("Tournament not found in the database.");
      }

      const tournamentId = tournamentRow.tournament_id;

      const participantRow = await new Promise((resolve, reject) => {
        db.get(
          `SELECT participant_id FROM Participants WHERE user_id = ? AND tournament_id = ?`,
          [discordId, tournamentId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!participantRow) {
        return interaction.reply("You are not registered in this tournament.");
      }

      const challongeParticipantId = participantRow.participant_id;

      // Step 2: Remove participant from Challonge
      const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants/${challongeParticipantId}.json`;
      const params = { api_key: process.env.API_KEY };

      await axios.delete(apiUrl, { params });

      // Step 3: Remove participant from the local database
      const deleteParticipantSql = `DELETE FROM Participants WHERE participant_id = ?`;
      db.run(deleteParticipantSql, [challongeParticipantId], (err) => {
        if (err) {
          console.error(
            "Error removing participant from database:",
            err.message
          );
          return interaction.reply(
            "Failed to remove you from the tournament in the database."
          );
        }

        const embed = new EmbedBuilder()
          .setColor(0xff0000) // A red color to indicate removal or dropout
          .setTitle("Tournament Drop-Out Successful")
          .setDescription(
            `You have successfully dropped out of the tournament **${tournamentName}**.`
          )
          .setThumbnail(interaction.user.displayAvatarURL())
          .addFields(
            {
              name: "Participant",
              value: `${interaction.user.tag}`,
              inline: true,
            },
            {
              name: "Tournament",
              value: `${tournamentName}`,
              inline: true,
            }
          )
          .setFooter({ text: "We hope to see you in future tournaments!" })
          .setTimestamp();

        interaction.reply({ embeds: [embed] });
      });
    } catch (error) {
      if (error.response) {
        // API returned an error
        console.error("API error:", error.response.data);
        interaction.reply(
          "Failed to drop out from the tournament on Challonge."
        );
      } else if (error.request) {
        // No response from Challonge
        console.error("No response from Challonge API:", error.request);
        interaction.reply("No response from Challonge. Please try again.");
      } else {
        // General error
        console.error("Error:", error.message);
        interaction.reply("An unexpected error occurred. Please try again.");
      }
    } finally {
      db.close((err) => {
        if (err) console.error("Error closing the database:", err.message);
      });
    }
  },

  async autocomplete(interaction) {
    if (interaction.options.getFocused(true).name === "tournament") {
      const focusedValue = interaction.options.getFocused();

      // Fetch tournament names from the database
      const tournaments = await fetchTournamentsFromDatabase();

      // Filter tournaments based on user input and limit results to 25
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
};
