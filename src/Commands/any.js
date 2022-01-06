const { SlashCommandBuilder } = require("@discordjs/builders");
const { allAdventurers } = require('../adventurers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("any")
    .setDescription("Picks a random character"),
  execute: async (interaction, client) => {
    const element = interaction.data.options.find(option => option.name === 'element');
    console.log(element);
    var item = allAdventurers[Math.floor(Math.random()*allAdventurers.length)];
    return interaction.reply(item);
  },
};
