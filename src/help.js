// 'use strict';

const {Collection, MessageActionRow, MessageButton, MessageEmbed} = require('discord.js'); // Define Client, Intents, and Collection.
const {SlashCommandBuilder} = require("@discordjs/builders");
const {logCommand} = require('./db');

const COMMAND_CATEGORIES = {
  GENERAL: 'General',
  ADVENTURER_GENERATION: 'Adventurer Generation',
  LIST_MANAGEMENT: 'List Management',
}

const supportedCommands = [
  {
    names: ['any'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer from the entire pool, excluding ones you\'ve blocked and completed.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: 'any <allow_completed>',
    example: 'any`, `/any true',
  },
  {
    names: ['daily'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks 3 random adventurers (for 3 daily skips) from the entire pool, excluding ones you've blocked and completed.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: 'daily <allow_completed>',
    example: 'daily`, `/daily true',
  },
  {
    names: ['search'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command searches for adventurer based on the query string provided.\n
      It will consider comma-separated terms as distinct queries.\n
      It works on partial and exact name matches, as well as a few common aliases, such as "Gleo" or "Kelly".\n
      If there are more than one result, all will be returned.
    `,
    usage: 'search <query>',
    example: 'search sinoa`, `/search yachi, gala cleo, kimono elisanne',
  },
  {
    names: ['leaderboard'],
    category: COMMAND_CATEGORIES.GENERAL,
    description: `
      This command shows the leaderboard in terms of unique characters completed by all users of the bot.\n
      For people in the server the command is used, it will show their nickname, otherwise, their Discord username.
    `,
    usage: 'leaderboard',
    example: 'leaderboard',
  },
  {
    names: ['manage'],
    category: COMMAND_CATEGORIES.LIST_MANAGEMENT,
    description: `
      This command allows you to do bulk edits to your completed and blocked lists.\n
      There are 6 subcommands that allow you to either \`add\`, \`remove\`, or \`clear\` from your \`completed\` or \`blocked\` lists.\n
      \`add\` and \`remove\` take in a query string that supports a comma-separated list of adventurers.\n
      If an exact name match is found, the corresponding adventurer will be added/removed from the respective list.
    `,
    usage: 'manage <list> <add|remove> <query>`, `manage <list> clear',
    example: 'manage completed add xainfried, aurien, the prince`, `/manage blocked clear',
  },
  {
    names: ['completed', 'blocked'],
    category: COMMAND_CATEGORIES.GENERAL,
    description: `
      This command displays all the adventurers on your completed/blocked lists.\n
      By default, the bot's response will be in messages only visible to you, but you can pass in a \`visibility\` option to make it show up for everyone as well.
    `,
    usage: '<completed|blocked> <visibility>',
    example: 'completed everyone`, `/blocked me',
  },
  {
    names: ['perma', 'limited'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer with the specified availability.\n
      "Limited" consists of anyone that is not always available to obtain, including Gala, seasonal, and non-compendium welfare units.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: '<perma|limited> <allow_completed>',
    example: 'perma`, `/limited true',
  },
  {
    names: ['dform'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer that has a unique shapeshift, such as Gala Leonidas or Valyx, excluding ones you've blocked and completed.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: 'dform <allow_completed>',
    example: 'dform`, `/dform true',
  },
  {
    names: ['ddrive'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer that uses dragondrive or a similar mechanic, such as Bellina or Gala Notte, excluding ones you've blocked and completed.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: 'ddrive <allow_completed>',
    example: 'ddrive`, `/dform true',
  },
  {
    names: ['melee'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer that uses a melee weapon (sword, blade, dagger, axe, or lance), excluding ones you've blocked and completed.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: 'melee <allow_completed>',
    example: 'melee`, `/dform true',
  },
  {
    names: ['ranged'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer that uses a ranged weapon (wand, bow, staff, manacaster), excluding ones you've blocked and completed.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: 'ranged <allow_completed>',
    example: 'ranged`, `/ranged true',
  },
  {
    names: ['3star', '4star', '5star', '3or4star'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer with the specified rarity, excluding ones you've blocked and completed.\n
      You can pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: '<3star|4star|5star|3or4star> <allow_completed>',
    example: '3star`, `/4star true',
  },
  {
    names: ['sword', 'blade', 'dagger', 'axe', 'lance', 'wand', 'bow', 'staff', 'manacaster'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer that uses the specified weapon, excluding ones you've blocked and completed.\n
      You can further specify the elemental attunement of the adventurer.\n
      You can also pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: '<sword|blade|dagger|axe|lance|wand|bow|staff|manacaster> <flame|water|wind|light|shadow> <allow_completed>',
    example: 'sword`, `/blade light`, `/dagger shadow true',
  },
  {
    names: ['flame', 'water', 'wind', 'light', 'shadow'],
    category: COMMAND_CATEGORIES.ADVENTURER_GENERATION,
    description: `
      This command picks a random adventurer of the specified elemental attunement, excluding ones you've blocked and completed.\n
      You can further specify the weapon type of the adventurer.\n
      You can also pass in the \`allow_completed\` option to allow completed adventurers to be chosen.
    `,
    usage: '<flame|water|wind|light|shadow> <sword|blade|dagger|axe|lance|wand|bow|staff|manacaster> <allow_completed>',
    example: 'flame`, `/light blade`, `/shadow dagger true',
  },
]

const commandNameReducer = (previousValue, currentValue) => previousValue.concat(currentValue.names);
const allCommandNames = supportedCommands.reduce(commandNameReducer, []);
const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Gives you a list of all commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('The command you want to learn more about')
    ),
  execute: async (interaction, _) => {
    const specificCommand = interaction.options.getString('command');
    await logCommand(interaction, 'help', specificCommand);
    if (specificCommand == null || !allCommandNames.includes(specificCommand)) {
      const fields = Object.keys(COMMAND_CATEGORIES).map(key => {
        const name = COMMAND_CATEGORIES[key];
        const filtered = supportedCommands.filter(commandGroup => commandGroup.category == name);
        const value = filtered.reduce(commandNameReducer, []).map(command => '`' + command + '`').join(', ');
        return {name, value};
      });
      const embed = new MessageEmbed()
        .setTitle('Oh y\'all wanted an assist, eh?')
        .setDescription('I support the following commands. Type `/<command>`.\nYou can also do `/help <command>` to learn more about a specific command.\n\nI usually use `/daily` to get a list of 3 adventurers for my daily skips, marking them completed with the buttons that show up for each result when I finish, and then `/leaderboard` and `/completed` to see how I stack up against others.\n\nYou can also use any of the adventurer generation commands to get a random adventurer from a more specific pool, or use the `/manage` command to do batch editing of your completed and block lists.')
        .setFields(fields);
      return interaction.reply({ embeds: [embed] });
    }

    const commandFamily = supportedCommands.find(command => command.names.includes(specificCommand));
    const fields = [
      {name: 'Usage', value: `\`/${commandFamily.usage}\``},
      {name: 'Example', value: `\`/${commandFamily.example}\``},
    ];
    if (commandFamily.names.length > 1) {
      fields.unshift({name: 'Similar Commands', value: commandFamily.names.filter(name => name != specificCommand).map(command => '`' + command + '`').join(', ')});
    }
    fields.unshift({ name: '\u200B', value: '\u200B' });
    const embed = new MessageEmbed()
      .setAuthor(commandFamily.category + ' Commands')
      .setTitle(`How does \`/${specificCommand}\` work?`)
      .setDescription(commandFamily.description)
      .setFields(fields);
    return interaction.reply({ embeds: [embed] });
  }
};

module.exports = {
  helpCommand,
}