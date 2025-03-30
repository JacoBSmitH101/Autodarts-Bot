const { SlashCommandBuilder, EmbedBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rename-threads")
        .setDescription("Renames all threads in the specified channel.")
        .addStringOption((option) =>
            option
                .setName("channel-id")
                .setDescription(
                    "ID of the channel whose threads you want to rename"
                )
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const channelId = interaction.options.getString("channel-id");

        try {
            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel) {
                return interaction.editReply("Channel not found.");
            }

            // Fetch active threads in the channel.
            // Note: This assumes the channel supports threads.
            const threadsCollection = await channel.threads.fetchActive();
            if (!threadsCollection.threads.size) {
                return interaction.editReply(
                    "No active threads found in this channel."
                );
            }

            // Iterate over each thread and rename it.
            threadsCollection.threads.forEach(async (thread) => {
                // Insert your renaming logic here.
                // Example placeholder: Rename thread to "New Thread Name"
                const name = await thread.name;
                // await thread.setName("New Thread Name");
                // console.log(`Renaming thread with ID: ${thread.id}`);
                //current name format has Round X: at the start, we want to have Week X: instead
                //week one is matches 1-4, week 2 is 5-8, etc
                const week = Math.ceil(name.split(" ")[1] / 4);
                const newName = `Week ${week}: ${name
                    .split(":")
                    .slice(1)
                    .join(":")}`;
                await thread.setName(newName);
            });

            await interaction.editReply("Thread renaming initiated.");
        } catch (error) {
            console.error(error);
            await interaction.editReply(
                "An error occurred while renaming threads."
            );
        }
    },
};
