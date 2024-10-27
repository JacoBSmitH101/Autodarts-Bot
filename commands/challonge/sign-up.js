const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const { fetchTournamentsFromDatabase } = require("../../util.js"); // Assuming the function is correctly implemented

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sign-up")
    .setDescription("Sign up for a tournament")
    .addStringOption((option) =>
      option
        .setName("tournament")
        .setDescription("Tournament")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("autodart-username")
        .setDescription("Autodart username")
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName("average")
        .setDescription("100 Leg Average")
        .setRequired(true)
    ),

  async execute(interaction) {
    const tournamentName = interaction.options.getString("tournament");
    const autodartUsername = interaction.options.getString("autodart-username");
    const challongeUsername =
      interaction.options.getString("challonge-username") ||
      interaction.user.username; // Default to Discord username if none provided
    const average = interaction.options.getNumber("average");
    const discordId = interaction.user.id;

    // Connect to SQLite database
    const db = new sqlite3.Database("./data.db", (err) => {
      if (err) {
        console.error("Database connection error:", err.message);
        return interaction.reply("Failed to connect to the database.");
      }
    });

    // Step 1: Check if user exists in Users table, else create them
    await db.get(
      `SELECT * FROM Users WHERE user_id = ?`,
      [discordId],
      (err, row) => {
        if (err) {
          console.error("Database query error:", err.message);
          return interaction.reply("Error retrieving user data.");
        }

        if (!row) {
          // User does not exist; insert into Users table
          const insertUserSql = `
                INSERT INTO Users (user_id, discord_tag, autodarts_name, challonge_id, created_at, updated_at, avg)
                VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
            `;
          db.run(
            insertUserSql,
            [discordId, interaction.user.tag, autodartUsername, average],
            (err) => {
              if (err) {
                console.error("Error inserting user:", err.message);
                return interaction.reply("Failed to create user.");
              }
            }
          );
        } else {
          // User exists; update the autodarts_name
          const updateUserSql = `
                UPDATE Users 
                SET autodarts_name = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `;
          db.run(updateUserSql, [autodartUsername, discordId], (err) => {
            if (err) {
              console.error("Error updating user autodarts_name:", err.message);
              return interaction.reply("Failed to update user information.");
            }
          });
        }
      }
    );

    // Step 2: Fetch tournament ID from the database
    await db.get(
      `SELECT tournament_id FROM Tournaments WHERE name = ?`,
      [tournamentName],
      async (err, row) => {
        if (err || !row) {
          console.error(
            "Tournament not found or database error:",
            err ? err.message : "No data"
          );
          return interaction.reply("Tournament not found in the database.");
        }

        const tournamentId = row.tournament_id;

        // Step 3: Create a participant on Challonge
        try {
          const apiUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}/participants.json`;

          // Participant name formatted as "DiscordTag (AutodartsName)"
          const participantName = `${interaction.user.tag} (${autodartUsername})`;
          const params = { api_key: process.env.API_KEY };
          const data = { participant: { name: participantName } };

          // Create the participant on Challonge
          const response = await axios.post(apiUrl, data, { params });

          if (response.status !== 200 || !response.data.participant) {
            console.error("Unexpected response from Challonge:", response.data);
            return interaction.reply(
              "Unexpected response from Challonge. Please try again later."
            );
          }

          const challongeParticipantId = response.data.participant.id;

          // Step 4: Check if participant already exists in the Participants table
          const checkParticipantSql = `SELECT * FROM Participants WHERE user_id = ? AND tournament_id = ?`;
          db.get(checkParticipantSql, [discordId, tournamentId], (err, row) => {
            if (err) {
              console.error(
                "Error checking participant existence:",
                err.message
              );
              return interaction.reply(
                "Failed to process registration. Please contact support."
              );
            }

            if (row) {
              // User already exists in this tournament, so we update challonge_id and participant_id
              const updateParticipantSql = `
                UPDATE Participants 
                SET challonge_id = ?, participant_id = ? 
                WHERE user_id = ? AND tournament_id = ?
              `;
              db.run(
                updateParticipantSql,
                [
                  challongeParticipantId,
                  challongeParticipantId,
                  discordId,
                  tournamentId,
                ],
                (err) => {
                  if (err) {
                    console.error(
                      "Error updating participant in database:",
                      err.message
                    );
                    return interaction.reply(
                      "Failed to update participant in the database. Please contact support."
                    );
                  }

                  // Create a success embed after updating
                  const embed = new EmbedBuilder()
                    .setColor(0x00ff99) // A bright green color for success
                    .setTitle("Tournament Sign-Up Updated!")
                    .setDescription(
                      `Your registration details have been updated for the tournament **${tournamentName}**!`
                    )
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                      {
                        name: "Participant",
                        value: `${interaction.user.tag} (${autodartUsername})`,
                        inline: true,
                      },
                      {
                        name: "Tournament",
                        value: `${tournamentName}`,
                        inline: true,
                      },
                      {
                        name: "100-Leg Average",
                        value: `${average}`,
                        inline: true,
                      }
                    )
                    .setFooter({ text: "Good luck!" })
                    .setTimestamp();

                  interaction.reply({ embeds: [embed] });
                }
              );
            } else {
              // New participant, insert into Participants table
              const insertParticipantSql = `
                INSERT INTO Participants (participant_id, user_id, tournament_id, challonge_id, status, joined_at)
                VALUES (?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP)
              `;
              db.run(
                insertParticipantSql,
                [
                  challongeParticipantId,
                  discordId,
                  tournamentId,
                  challongeParticipantId,
                ],
                (err) => {
                  if (err) {
                    console.error(
                      "Error inserting participant into database:",
                      err.message
                    );
                    return interaction.reply(
                      "Failed to save participant in the database. Please contact support."
                    );
                  }

                  // Create a success embed after insertion
                  const embed = new EmbedBuilder()
                    .setColor(0x00ff99) // A bright green color for success
                    .setTitle("Tournament Sign-Up Successful!")
                    .setDescription(
                      `You've successfully signed up for the tournament **${tournamentName}**!`
                    )
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                      {
                        name: "Participant",
                        value: `${interaction.user.tag} (${autodartUsername})`,
                        inline: true,
                      },
                      {
                        name: "Tournament",
                        value: `${tournamentName}`,
                        inline: true,
                      },
                      {
                        name: "100-Leg Average",
                        value: `${average}`,
                        inline: true,
                      }
                    )
                    .setFooter({ text: "Good luck!" })
                    .setTimestamp();

                  interaction.reply({ embeds: [embed] });
                }
              );
            }
          });

          db.close((err) => {
            if (err) {
              console.error("Error closing the database:", err.message);
            }
          });
        } catch (error) {
          if (error.response) {
            // API returned a response but with an error status
            console.error("API error:", error.response.data);
            const errorMessage = error.response.data.errors
              ? error.response.data.errors.join(", ")
              : "Unknown error";
            interaction.reply(
              `Failed to add participant to Challonge: ${errorMessage}`
            );
          } else if (error.request) {
            // No response received
            console.error("No response from Challonge API:", error.request);
            interaction.reply(
              "No response from Challonge. Please check your internet connection and try again."
            );
          } else {
            // Something else caused the error
            console.error(
              "Error adding participant on Challonge:",
              error.message
            );
            interaction.reply(
              "An unexpected error occurred. Please try again later."
            );
          }
          db.close((err) => {
            if (err) {
              console.error("Error closing the database:", err.message);
            }
          });
        }
      }
    );

    // Close the database connection after operations are complete
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