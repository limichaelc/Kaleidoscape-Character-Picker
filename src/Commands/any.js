const { SlashCommandBuilder } = require("@discordjs/builders");
const { allAdventurers } = require('adventurers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("any")
    .setDescription("Picks any random character from the full adventurer pool"),
  execute: async (interaction, client) => {
    var item = allAdventurers[Math.floor(Math.random()*allAdventurers.length)];
    return interaction.reply(item);
  },
};
