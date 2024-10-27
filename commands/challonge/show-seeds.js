const { SlashCommandBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const {
  fetchTournamentsFromDatabase,
  getTournamentIdByName,
} = require("../../util");
// Function to retrieve sorted participants by average
const getSortedParticipants = async (tournamentId) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database("./data.db");
    db.all(
      `
      SELECT Users.autodarts_name, Users.avg 
      FROM Participants 
      JOIN Users ON Participants.user_id = Users.user_id 
      WHERE Participants.tournament_id = ? 
      ORDER BY avg DESC
    `,
      [tournamentId],
      (err, rows) => {
        db.close();
        if (err) {
          reject("Failed to retrieve participants.");
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Utility function to split a long message into chunks for Discord
const splitMessage = (message, maxLength = 2000) => {
  const chunks = [];
  while (message.length > maxLength) {
    let chunk = message.slice(0, maxLength);
    const lastNewlineIndex = chunk.lastIndexOf("\n");
    if (lastNewlineIndex > 0) {
      chunk = message.slice(0, lastNewlineIndex);
      message = message.slice(lastNewlineIndex + 1);
    } else {
      message = message.slice(maxLength);
    }
    chunks.push(chunk);
  }
  chunks.push(message);
  return chunks;
};

// Command to list seeds with names and averages
module.exports = {
  data: new SlashCommandBuilder()
    .setName("list-seeds")
    .setDescription(
      "Lists participants in descending order by average, split into divisions."
    )
    .addStringOption((option) =>
      option
        .setName("tournament")
        .setDescription("Name of the tournament")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("divisions")
        .setDescription("Number of divisions")
        .setRequired(true)
    ),

  async execute(interaction) {
    const tournamentName = interaction.options.getString("tournament");
    const numDivisions = interaction.options.getInteger("divisions");

    // Defer the reply to avoid timeout
    await interaction.deferReply();

    try {
      // Get tournament ID and participants
      const tournamentId = await getTournamentIdByName(tournamentName);
      const participants = await getSortedParticipants(tournamentId);

      if (participants.length === 0) {
        return interaction.editReply(
          "No participants found for this tournament."
        );
      }

      // Calculate number of participants per division
      const participantsPerDivision = Math.ceil(
        participants.length / numDivisions
      );

      // Format the results to display
      let result = `**Participants in ${numDivisions} Divisions (Sorted by Average):**\n`;
      participants.forEach((participant, index) => {
        // Determine the current division number
        const divisionNumber = Math.floor(index / participantsPerDivision) + 1;

        // Add division header if starting a new division
        if (index % participantsPerDivision === 0) {
          result += `\n**Division ${divisionNumber}:**\n`;
        }

        // Add participant info
        result += `**${index + 1}.** ${participant.autodarts_name} (Avg: ${
          participant.avg
        })\n`;
      });

      // Send the message in chunks if it exceeds Discord's character limit
      const messageChunks = splitMessage(result);
      for (const chunk of messageChunks) {
        await interaction.followUp(chunk);
      }
    } catch (error) {
      console.error("Error in list-seeds command:", error);
      await interaction.editReply("An error occurred while retrieving seeds.");
    }
  },
  async autocomplete(interaction) {
    // Check if the interaction is for the "tournament" option
    if (interaction.options.getFocused(true).name === "tournament") {
      const focusedValue = interaction.options.getFocused();

      // Fetch tournament names from the database
      const tournaments = await fetchTournamentsFromDatabase(
        interaction.guildId
      );

      // Filter tournaments based on the user's input and limit results to 25 (Discord's max)
      const filteredTournaments = tournaments
        .filter((tournament) =>
          tournament.name.toLowerCase().includes(focusedValue.toLowerCase())
        )
        .slice(0, 25);

      // Respond with formatted choices
      await interaction.respond(
        filteredTournaments.map((tournament) => ({
          name: tournament.name,
          value: tournament.name,
        }))
      );
    }
  },
};
