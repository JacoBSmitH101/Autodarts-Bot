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
            console.log(`Found ${threadsCollection.threads.size} threads.`);

            // Iterate over each thread sequentially.
            for (const thread of threadsCollection.threads.values()) {
                // Get the current thread name.
                const name = thread.name; // No need for await here.

                // Expecting format "Round X: ...". If not, skip this thread.
                const parts = name.split(" ");
                if (parts.length < 2 || isNaN(parseInt(parts[1], 10))) {
                    console.log(
                        `Skipping thread ${thread.id}, unexpected name format: ${name}`
                    );
                    continue;
                }

                // Calculate week: week one is rounds 1-4, week two is rounds 5-8, etc.
                const roundNumber = parseInt(parts[1], 10);
                const week = Math.ceil(roundNumber / 4);

                // Construct the new name.
                const newName = `Week ${week}: ${name
                    .split(":")
                    .slice(1)
                    .join(":")
                    .trim()}`;

                // Rename the thread.
                await thread.setName(newName);
                console.log(
                    `Renamed thread with ID: ${thread.id} to "${newName}"`
                );

                // Sleep for 1 second to avoid rate limiting.
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            await interaction.editReply("Thread renaming initiated.");
        } catch (error) {
            console.error(error);
            await interaction.editReply(
                "An error occurred while renaming threads."
            );
        }
    },
};
