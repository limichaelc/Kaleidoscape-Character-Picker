// 'use strict';

const {allAdventurers, dragonDrive, uniqueDragon, threeStars, fourStars, limited} = require('./adventurers');
const {SlashCommandBuilder} = require("@discordjs/builders");
const {REST} = require("@discordjs/rest"); // Define REST.
const {Routes} = require("discord-api-types/v9"); // Define Routes.
const {
  setupTables,
  markCompleted,
  addToBlocklist,
  removeFromBlocklist,
  markIncomplete,
  findCompleters,
} = require('./db');
const {ACTION_TYPE} = require('./consts');
const {Client, Intents, MessageButton, MessageActionRow} = require("discord.js"); // Define Client, Intents, and Collection.
const {commands, commandArray} = require('./commands');

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
}); // Connect to our discord bot.
const token = process.env.DISCORD_TOKEN; // Token from Railway Env Variable.
client.login(token).then().catch(reason => {
    console.log("Login failed: " + reason);
    console.log("Token used: " + token);
});

async function handleButtonInteraction(interaction) {
  const buttonType = interaction.customId;
  const [embed] = interaction.message.embeds;
  const adventurer = [embed.title, embed.description].join(', ');

  switch (buttonType) {
    case ACTION_TYPE.BLOCK:
      return addToBlocklist(interaction, adventurer);
    case ACTION_TYPE.UNBLOCK:
      return removeFromBlocklist(interaction, adventurer);
    case ACTION_TYPE.COMPLETE:
      return markCompleted(interaction, adventurer);
    case ACTION_TYPE.INCOMPLETE:
      return markIncomplete(interaction, adventurer);
    case ACTION_TYPE.COMPLETERS:
      return findCompleters(interaction, adventurer);
    default:
      return;
  }
}

// Execute code when the "ready" client event is triggered.
client.once("ready", async () => {
  if (process.env.SETUP_TABLES == 'true') {
    await setupTables();
  }

  const rest = new REST({ version: "9" }).setToken(token); // Define "rest" for use in registering commands
  // Register slash commands.
  ;(async () => {
    try {
      console.log("Started refreshing application (/) commands.");

      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandArray,
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
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  }
  if (!interaction.isCommand()) return;
  const command = commands.get(interaction.commandName);

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

client.on('shardError', error => {
	console.error('A websocket connection encountered an error:', error);
});

process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
});

client.on('rateLimit', info => {
  console.log(`Rate limit hit ${info.timeDifference ? info.timeDifference : info.timeout ? info.timeout: 'Unknown timeout '}`)
})