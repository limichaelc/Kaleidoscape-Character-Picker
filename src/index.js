const {allAdventurers, dragonDrive, uniqueDragon, threeStars, fourStars, limited} = require('./adventurers');
const {SlashCommandBuilder} = require("@discordjs/builders");
const {REST} = require("@discordjs/rest"); // Define REST.
const {Routes} = require("discord-api-types/v9"); // Define Routes.
const {
  setupTables,
  markCompleted,
  addToBlocklist,
} = require('./db');
const {ACTION_TYPE} = require('./consts');
const {Client, Intents, MessageButton, MessageActionRow} = require("discord.js"); // Define Client, Intents, and Collection.
const {commands, commandArray} = require('./commands');

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
}); // Connect to our discord bot.
const token = process.env.DISCORD_TOKEN; // Token from Railway Env Variable.
console.log("logging in");
client.login(token).then().catch(reason => {
    console.log("Login failed: " + reason);
    console.log("Token used: " + token);
});

async function handleButtonInteraction(interaction) {
  console.log(interaction);
  const buttonType = interaction.customId;
  const [embed] = interaction.embeds;
  console.log(embed);
  const adventurer = embed.message.content;

  if (!allAdventurers.includes(adventurer)) {
    return interaction.reply(`Could not find adventurer ${adventurer}`);
  }
  switch (buttonType) {
    case ACTION_TYPE.BLOCK:
      addToBlocklist(interaction, adventurer);
      break;
    case ACTION_TYPE.COMPLETE:
      markCompleted(interaction, adventurer);
      break;
    default:
      return;
  }
}

// Execute code when the "ready" client event is triggered.
client.once("ready", async () => {
  console.log(process.env.SETUP_TABLES, Boolean(process.env.SETUP_TABLES));
  // if (Boolean(process.env.SETUP_TABLES)) {
  //   await setupTables();
  // }

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
  console.log('hello!', interaction);
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  }
  if (!interaction.isCommand()) return;
  const command = commands.get(interaction.commandName);
  console.log(command);
  console.log(interaction);

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
