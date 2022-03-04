// 'use strict';

const {Collection, MessageActionRow, MessageButton, MessageEmbed} = require('discord.js'); // Define Client, Intents, and Collection.
const {SlashCommandBuilder} = require("@discordjs/builders");
const {ACTION_TYPE, ALL_ELEMENTS, ALL_WEAPONS, MELEE_WEAPONS, RANGED_WEAPONS, COLORS, MANAGE_COMMAND_GROUPS, MANAGE_SUBCOMMANDS} = require('./consts');
const {
  sql,
  getQuery,
  search,
  batchAddCompleted,
  batchAddBlocked,
  batchRemoveCompleted,
  batchRemoveBlocked,
  clearCompleted,
  clearBlocked,
  leaderboard,
  logCommand,
} = require('./db');
const {helpCommand} = require('./help');

const commands = new Collection(); // Where the bot (slash) commands will be stored.
const commandArray = []; // Array to store commands for sending to the REST API.

function sendMessage(interaction, concatResult, isFollowUp = false) {
  if (concatResult == undefined) {
    return interaction.reply(
      `Could not find an adventurer with those restrictions... Try allowing completed adventurers or removing some from your blocklist`,
      ).catch(onRejected => console.error(onRejected));
  }
  const item = concatResult.concat;
  const [id, rarity, adventurerName, element, weapon] = item.split(', ');
  const wikiURL = `https://dragalialost.wiki/index.php?title=Special:Search&search=${encodeURIComponent(adventurerName)}`;
  const embed = {
    "type": "rich",
    "title": adventurerName,
    "description": [element, weapon].join(', '),
    "color": COLORS[element.toUpperCase()],
    "thumbnail": {
      "url": `https://dragalialost.wiki/thumb.php?f=${id}_r0${rarity}.png&width=140`,
      "height": 0,
      "width": 0,
    },
    "url": wikiURL,
  }
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.COMPLETE)
        .setLabel('Mark complete')
        .setStyle('SECONDARY'),
    )
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.INCOMPLETE)
        .setLabel('Mark incomplete')
        .setStyle('SECONDARY'),
    )
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.BLOCK)
        .setLabel('Block')
        .setStyle('SECONDARY'),
    )
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.UNBLOCK)
        .setLabel('Unblock')
        .setStyle('SECONDARY'),
    );
  const message = { embeds: [embed], components: [row] };
  return isFollowUp
    ? interaction.followUp(message).catch(onRejected => console.error(onRejected))
    : interaction.reply(message).catch(onRejected => console.error(onRejected));
}

function commandBuilderBase() {
  return new SlashCommandBuilder()
    .addBooleanOption(option =>
      option.setName('allow_completed')
        .setDescription('Allow characters you\'ve already marked completed')
        .setRequired(false)
    );
}

function simpleCommand(name, description, vars) {
  return {
    data: commandBuilderBase()
      .setName(name)
      .setDescription(description),
    execute: async (interaction, _) => {
      const query = getQuery(interaction, vars);
      const [concatResult] = await query;
      await logCommand(interaction, name);
      return sendMessage(interaction, concatResult);
    }
  };
}

const dailyCommand = {
  data: commandBuilderBase()
    .setName('daily')
    .setDescription('Picks 3 random characters for daily skips',),
  execute: async (interaction, _) => {
    const query = getQuery(interaction, { limit: 3 });
    await logCommand(interaction, 'daily');
    const results = await query;
    if (results.length == 0) {
      return interaction.reply('Could not pick any adventurers').catch(onRejected => console.error(onRejected));
    }
    sendMessage(interaction, results[0]);
    results.slice(1).map(result => sendMessage(interaction, result, true));
  }
};

const searchCommand = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for particular characters by name (case insensitive), as a comma separated list')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('The search query, names (fuzzy match, case insensitive), as a comma separated list')
        .setRequired(true)),
  execute: async (interaction, _) => {
    const results = await search(interaction);
    interaction.reply(`Searching for *"${interaction.options.getString('query')}"*...`).catch(onRejected => console.error(onRejected));
    if (results.length == 0) {
      return interaction.followUp('Could not find any adventurers with those names');
    }
    results.map(result => sendMessage(interaction, result, true));
  },
};

const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Shows leaderboard by clears for all users of the bot'),
  execute: async (interaction, _) => {
    interaction.deferReply();
    var previousPrefix = null;
    var previousCount = null;
    const entries = await leaderboard(interaction);
    const fields = entries.map((entry, index) => {
      var prefix = `(${index + 1})`;
      switch (index) {
        case 0:
          prefix = '🥇';
          break;
        case 1:
          prefix = '🥈';
          break;
        case 2:
          prefix = '🥉';
          break;
        default:
          break;
      }
      console.log(entry.count, previousCount);
      if (entry.count === previousCount) {
        prefix = previousPrefix;
      } else {
        previousPrefix = prefix;
      }

      previousCount = entry.count

      var base = `${prefix}: ${entry.username} (${entry.count.toString()})`;
      if (entry.isSelf) {
        base = '**' + base + '**';
      }
      return base;
    });
    const embed = new MessageEmbed()
      .setTitle('Leaderboard')
      .setDescription(fields.join('\n'));
    interaction.editReply({ embeds: [embed] }).catch(onRejected => console.error(onRejected));
  },
};

const addQueryOption = option =>
  option.setName('query')
    .setDescription('The search query, names (exact match, case insensitive), as a comma separated list')
    .setRequired(true);

const manageCommand = {
  data: new SlashCommandBuilder()
    .setName('manage')
    .setDescription('Managed your personal adventurer database, including your completed and block lists')
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName(MANAGE_COMMAND_GROUPS.COMPLETED)
        .setDescription('Managed your completed list')
        .addSubcommand(subcommand =>
          subcommand
            .setName(MANAGE_SUBCOMMANDS.ADD)
            .setDescription('Add adventurers to your completed list')
            .addStringOption(addQueryOption)
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName(MANAGE_SUBCOMMANDS.REMOVE)
            .setDescription('Remove adventurers from your completed list')
            .addStringOption(addQueryOption)
        )
        // .addSubcommand(subcommand =>
        //   subcommand
        //     .setName(MANAGE_SUBCOMMANDS.CLEAR)
        //     .setDescription('Clear your completed list')
        // )
    )
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName(MANAGE_COMMAND_GROUPS.BLOCKED)
        .setDescription('Managed your blocklist')
        .addSubcommand(subcommand =>
          subcommand
            .setName(MANAGE_SUBCOMMANDS.ADD)
            .setDescription('Add adventurers to your blocklist')
            .addStringOption(addQueryOption)
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName(MANAGE_SUBCOMMANDS.REMOVE)
            .setDescription('Remove adventurers from your blocklist')
            .addStringOption(addQueryOption)
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName(MANAGE_SUBCOMMANDS.CLEAR)
            .setDescription('Clear your blocklist')
        )
    ),
  execute: async (interaction, _) => {
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    switch (group) {
      case MANAGE_COMMAND_GROUPS.COMPLETED:
        switch (subcommand) {
          case MANAGE_SUBCOMMANDS.ADD:
            return await batchAddCompleted(interaction);
          case MANAGE_SUBCOMMANDS.REMOVE:
            return await batchRemoveCompleted(interaction);
          // case MANAGE_SUBCOMMANDS.CLEAR:
          //   return await clearCompleted(interaction);
        }
      case MANAGE_COMMAND_GROUPS.BLOCKED:
        switch (subcommand) {
          case MANAGE_SUBCOMMANDS.ADD:
            return await batchAddBlocked(interaction);
          case MANAGE_SUBCOMMANDS.REMOVE:
            return await batchRemoveBlocked(interaction);
          case MANAGE_SUBCOMMANDS.CLEAR:
            return await clearBlocked(interaction);
        }
    }
  }
}

ALL_WEAPONS.map(weapon => {
  const command = {
    data: commandBuilderBase()
      .setName(weapon)
      .setDescription("Picks a random character with the given weapon type")
      .addStringOption(option =>
        option.setName('element')
          .setDescription('Specify the character element')
          .setRequired(false)
          .addChoices(ALL_ELEMENTS.map(element => [element, element]))),
    execute: async (interaction, _) => {
      const element = interaction.options.getString('element') ?? '';
      const query = getQuery(interaction, { element, weapons: [weapon] });
      await logCommand(interaction, 'weapon', element);
      const [concatResult] = await query;
      return sendMessage(interaction, concatResult);
    },
  };
  commands.set(command.data.name, command); // Set the command name and file for handler to use.
  commandArray.push(command.data.toJSON()); // Push the command data to an array (for sending to the API).
});

ALL_ELEMENTS.map(element => {
  const command = {
    data: commandBuilderBase()
      .setName(element)
      .setDescription("Picks a random character with the given element")
      .addStringOption(option =>
        option.setName('weapon')
          .setDescription('Specify the character weapon type')
          .setRequired(false)
          .addChoices(ALL_WEAPONS.map(weapon => [weapon, weapon]))),
    execute: async (interaction, _) => {
      const weapon = interaction.options.getString('weapon') ?? '';
      const query = getQuery(interaction, { element, weapons: weapon != '' ? [weapon] : ALL_WEAPONS });
      await logCommand(interaction, 'element', weapon);
      const [concatResult] = await query;
      return sendMessage(interaction, concatResult);
    },
  };
  commands.set(command.data.name, command); // Set the command name and file for handler to use.
  commandArray.push(command.data.toJSON()); // Push the command data to an array (for sending to the API).
});

const completedCommand = statsCommand(
  'completed',
  'Lists out the adventurers you\'ve marked as completed',
);

const blockedCommand = statsCommand(
  'blocked',
  'Lists out the adventurers you\'ve blocked',
);

function statsCommand(name, description) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addStringOption(option =>
        option.setName('visibility')
          .setDescription('Whether to display the results to everyone or just yourself')
          .addChoices([
            ['everyone', 'everyone'],
            ['me', 'me'],
          ])
      ),
    execute: async (interaction, _) => {
      const totalCounts = await sql`
        SELECT COUNT(*), element, weapon
        FROM adventurers
        GROUP BY element, weapon
      `;
      const numeratorCounts = await (
        name == 'blocked'
          ? sql`
              SELECT COUNT(*), element, weapon
              FROM blocked
              WHERE userid = ${interaction.user.id} GROUP BY element, weapon
            `
          : sql`
              SELECT COUNT(*), element, weapon
              FROM completed
              WHERE userid = ${interaction.user.id} GROUP BY element, weapon
            `
          );
      const numeratorNames = await (
        name == 'blocked'
          ? sql`
            SELECT element, weapon, string_agg(name, ', ')
            FROM blocked
            WHERE userid = ${interaction.user.id} GROUP BY element, weapon
          `
          : sql`
            SELECT element, weapon, string_agg(name, ', ')
            FROM completed
            WHERE userid = ${interaction.user.id} GROUP BY element, weapon
          `
        );
      const countReducer = (previousValue, currentValue) => previousValue + currentValue.count;
      const totalAdventurers = totalCounts.reduce(countReducer, 0);
      const totalNumerator = numeratorCounts.reduce(countReducer, 0);
      const isCompleted = name == 'completed';
      const visibility = interaction.options.getString('visibility');
      const ephemeral = visibility !== 'everyone';
      await logCommand(interaction, name, visibility);

      interaction.reply({
        content: `You've ${name} ${formatCounts(totalNumerator, totalAdventurers)} adventurers`,
        ephemeral,
      }).catch(onRejected => console.error(onRejected));
      if (totalNumerator == 0) {
        return;
      }

      ALL_ELEMENTS.map(element => {
        const elementFilter = entry => entry.element.toLowerCase() == element.toLowerCase();
        const fields = ALL_WEAPONS.map(weapon => {
          const elementWeaponFinder = entry =>
            entry.element.toLowerCase() == element.toLowerCase() &&
            entry.weapon.toLowerCase() == weapon.toLowerCase();
          const value = numeratorNames.find(elementWeaponFinder);
          if (value == null) {
            return null;
          }
          const numeratorCount = numeratorCounts.find(elementWeaponFinder)?.count ?? 0;
          const totalCount = totalCounts.find(elementWeaponFinder)?.count ?? 0;
          return {
            name: `${capitalize(weapon)}: ${formatCounts(numeratorCount, totalCount, isCompleted)}`,
            value: value.string_agg,
            inline: true,
          }
        });
        const numeratorCount = numeratorCounts.filter(elementFilter).reduce(countReducer, 0);
        if (numeratorCount == 0) {
          return null;
        }
        const totalCount = totalCounts.filter(elementFilter).reduce(countReducer, 0);
        const embed = new MessageEmbed()
          .setColor(COLORS[element.toUpperCase()])
          .setTitle(`${capitalize(element)}: ${formatCounts(numeratorCount, totalCount, isCompleted)}`)
          .setAuthor(interaction.member?.nickname ?? interaction.user.username)
          .addFields(fields.filter(Boolean))
        interaction.followUp({
          embeds: [embed],
          ephemeral,
        }).catch(onRejected => console.error(onRejected));
      });
    }
  };
}

function capitalize(input) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function formatPercentage(numerator, denominator) {
  return `${(numerator / denominator * 100).toFixed(2)}%`;
}

function formatCounts(completedCount, totalCount, isCompleted = false) {
  return `${completedCount}/${totalCount} (${formatPercentage(completedCount, totalCount)})` + (parseInt(completedCount) == parseInt(totalCount) && isCompleted ? ' 🎖' : '');
}

[
  simpleCommand(
    'any',
    'Picks a random character',
    {},
  ),
  simpleCommand(
    'dform',
    'Picks a random character with a unique shapeshift',
    { hasUniqueDragon: true },
  ),
  simpleCommand(
    'ddrive',
    'Picks a random character that uses dragon drive',
    { isDragonDrive: true },
  ),
  simpleCommand(
    'melee',
    'Picks a random melee character (axe, blade, dagger, lance, sword)',
    { weapons: MELEE_WEAPONS },
  ),
  simpleCommand(
    'ranged',
    'Picks a random ranged character (wand, bow, staff, manacaster)',
    { weapons: RANGED_WEAPONS },
  ),
  simpleCommand(
    '3star',
    'Picks a random character with 3* rarity',
    { rarities: [3] },
  ),
  simpleCommand(
    '4star',
    'Picks a random character with 4* rarity',
    { rarities: [4] },
  ),
  simpleCommand(
    '5star',
    'Picks a random character with 5* rarity',
    { rarities: [5] },
  ),
  simpleCommand(
    '3or4star',
    'Picks a random character with either 3* or 4* rarity',
    { rarities: [3, 4] },
  ),
  simpleCommand(
    'perma',
    'Picks a random character from the permanent pool',
    { isLimited: [false] },
  ),
  simpleCommand(
    'limited',
    'Picks a random character from the limited (Gala, seasonal, and non-compendium welfare) pool',
    { isLimited: [true] },
  ),
  completedCommand,
  blockedCommand,
  searchCommand,
  manageCommand,
  dailyCommand,
  leaderboardCommand,
  helpCommand,
].map(command => {
  commands.set(command.data.name, command);
  commandArray.push(command.data.toJSON());
});

module.exports = {
  commands,
  commandArray,
}