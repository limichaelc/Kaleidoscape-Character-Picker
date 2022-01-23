const { allAdventurers, dragonDrive, uniqueDragon, threeStars, fourStars, limited } = require('./adventurers');
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

function pickRandom(interaction, input) {
  const item = input[Math.floor(Math.random()*input.length)];
  console.log(item);
  return interaction.reply(item);
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
        return pickRandom(interaction, filtered);
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
        return pickRandom(interaction, filtered);
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
      return pickRandom(interaction, allAdventurers);
    },
  };

  const uniqueDragonCommand = {
    data: new SlashCommandBuilder()
      .setName("dform")
      .setDescription("Picks a random character with a unique shapeshift"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, uniqueDragon);
    },
  };

  const dragonDriveCommand = {
    data: new SlashCommandBuilder()
      .setName("ddrive")
      .setDescription("Picks a random character that uses dragon drive"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, dragonDrive);
    },
  };

  const meleeChecker = value => ['Sword', 'Blade', 'Dagger', 'Axe', 'Lance']
    .some(element => value.includes(element));
  const melee = allAdventurers.filter(meleeChecker);
  const meleeCommand = {
    data: new SlashCommandBuilder()
      .setName("melee")
      .setDescription("Picks a random melee character (axe, blade, dagger, lance, sword)"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, melee);
    },
  };

  const rangedChecker = value => ['Wand', 'Bow', 'Staff', 'Manacaster']
    .some(element => value.includes(element));
  const ranged = allAdventurers.filter(rangedChecker);
  const rangedCommand = {
    data: new SlashCommandBuilder()
      .setName("ranged")
      .setDescription("Picks a random ranged character (wand, bow, staff, manacaster)"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, ranged);
    },
  };

  const threeStarCommand = {
    data: new SlashCommandBuilder()
      .setName("3star")
      .setDescription("Picks a random character with 3* rarity"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, threeStars);
    },
  };

  const fourStarCommand = {
    data: new SlashCommandBuilder()
      .setName("4star")
      .setDescription("Picks a random character with 4* rarity"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, fourStars);
    },
  };

  const threeOrFourStars = threeStars.concat(fourStars);
  const fiveStars = allAdventurers.filter(x => !threeOrFourStars.includes(x));
  const fiveStarCommand = {
    data: new SlashCommandBuilder()
      .setName("5star")
      .setDescription("Picks a random character with 5* rarity"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, fiveStars);
    },
  };

  const threeOrFourStarCommand = {
    data: new SlashCommandBuilder()
      .setName("3or4star")
      .setDescription("Picks a random character with either 3* or 4* rarity"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, threeOrFourStars);
    },
  };

  const permaCommand = {
    data: new SlashCommandBuilder()
      .setName("perma")
      .setDescription("Picks a random character from the permanent pool"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, allAdventurers.filter(x => !limited.includes(x)));
    }
  };

  const limitedCommand = {
    data: new SlashCommandBuilder()
      .setName("limited")
      .setDescription("Picks a random character from the limited (Gala, seasonal, and non-compendium welfare) pool"),
    execute: async (interaction, client) => {
      return pickRandom(interaction, limited);
    }
  };

  [
    anyCommand,
    uniqueDragonCommand,
    dragonDriveCommand,
    meleeCommand,
    rangedCommand,
    threeStarCommand,
    fourStarCommand,
    fiveStarCommand,
    threeOrFourStarCommand,
    permaCommand,
    limitedCommand,
  ].map(command => {
    console.log(command);
    commands.set(command.data.name, command);
    commandarray.push(command.data.toJSON());
  });

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
