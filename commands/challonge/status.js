//command for users to see what tournaments they have signed up for

const {
    getTournamentStatusForUser,
    getTournamentNameById,
} = require("../../testdatamanager");

const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Shows all tournaments you have signed up for"),
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
            .setTitle("Tournament Status")
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
