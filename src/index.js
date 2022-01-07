const { allAdventurers } = require('./adventurers');
const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest"); // Define REST.
const { Routes } = require("discord-api-types/v9"); // Define Routes.
const fs = require("fs"); // Define fs (file system).
const { Client, Intents, Collection } = require("discord.js"); // Define Client, Intents, and Collection.
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
}); // Connect to our discord bot.
const commands = new Collection(); // Where the bot (slash) commands will be stored.
const commandarray = []; // Array to store commands for sending to the REST API.
const token = process.env.DISCORD_TOKEN; // Token from Railway Env Variable.

function capitalize(input) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

// Execute code when the "ready" client event is triggered.
client.once("ready", () => {
  const elements = ['flame', 'water', 'wind', 'light', 'shadow'];
  const weapons = ['sword', 'blade', 'dagger', 'axe', 'lance', 'wand', 'bow', 'staff', 'manacaster'];

  weapons.map(weapon => {
    const command = {
      data: new SlashCommandBuilder()
        .setName(weapon)
        .setDescription("Picks a random character with the given weapon type")
        .addStringOption(option =>
          option.setName('element')
            .setDescription('Specify the character element')
            .setRequired(false)
            .addChoices(elements.map(element => [element, element]))),
      execute: async (interaction, client) => {
        const element = interaction.options.getString('element') ?? '';
        const query = capitalize(element) + ", " + capitalize(weapon);
        const filtered = allAdventurers.filter(adventurer => adventurer.includes(query));
        var item = filtered[Math.floor(Math.random()*filtered.length)];
        return interaction.reply(item);
      },
    };
    commands.set(command.data.name, command); // Set the command name and file for handler to use.
    commandarray.push(command.data.toJSON()); // Push the command data to an array (for sending to the API).
  });

  elements.map(element => {
    const command = {
      data: new SlashCommandBuilder()
        .setName(element)
        .setDescription("Picks a random character with the given element")
        .addStringOption(option =>
          option.setName('weapon')
            .setDescription('Specify the character weapon type')
            .setRequired(false)
            .addChoices(weapons.map(weapon => [weapon, weapon]))),
      execute: async (interaction, client) => {
        const weapon = interaction.options.getString('weapon') ?? '';
        const query = capitalize(element) + ", " + capitalize(weapon);
        const filtered = allAdventurers.filter(adventurer => adventurer.includes(query));
        var item = filtered[Math.floor(Math.random()*filtered.length)];
        return interaction.reply(item);
      },
    };
    commands.set(command.data.name, command); // Set the command name and file for handler to use.
    commandarray.push(command.data.toJSON()); // Push the command data to an array (for sending to the API).
  });

  const anyCommand = {
    data: new SlashCommandBuilder()
      .setName("any")
      .setDescription("Picks a random character"),
    execute: async (interaction, client) => {
      const item = allAdventurers[Math.floor(Math.random()*allAdventurers.length)];
      console.log(item);
      return interaction.reply(item);
    },
  };
  commands.set(anyCommand.data.name, anyCommand);
  commandarray.push(anyCommand.data.toJSON());

  const rest = new REST({ version: "9" }).setToken(token); // Define "rest" for use in registering commands
  // Register slash commands.
  ;(async () => {
    try {
      console.log("Started refreshing application (/) commands.");

      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandarray,
      });

      console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
      console.error(error);
    }
  })();
  console.log(`Logged in as ${client.user.tag}!`);
});

// Command handler.
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  const command = commands.get(interaction.commandName);
  console.log(command);

  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    return interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

client.login(token); // Login to the bot client via the defined "token" string.
