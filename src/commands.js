// 'use strict';

const {Collection, MessageActionRow, MessageButton, MessageEmbed} = require('discord.js'); // Define Client, Intents, and Collection.
const {SlashCommandBuilder} = require("@discordjs/builders");
const {ACTION_TYPE, ALL_ELEMENTS, ALL_WEAPONS, MELEE_WEAPONS, RANGED_WEAPONS, COLORS, MANAGE_COMMAND_GROUPS, MANAGE_SUBCOMMANDS, STATS_COMMANDS, ORDERINGS, PAGE_SIZE} = require('./consts');
const {
  sql,
  getQuery,
  search,
  batchAddCompleted,
  batchAddBlocked,
  batchRemoveCompleted,
  batchRemoveBlocked,
  clearBlocked,
  leaderboard,
  popularity,
  history,
  logCommand,
} = require('./db');
const {helpCommand} = require('./help');

const commands = new Collection(); // Where the bot (slash) commands will be stored.
const commandArray = []; // Array to store commands for sending to the REST API.

async function sendMessage(interaction, concatResult, isFollowUp = false) {
  if (concatResult == undefined) {
    return interaction.reply(
      `Could not find an adventurer with those restrictions... Try allowing completed adventurers or removing some from your blocklist`,
      ).catch(onRejected => console.error(onRejected));
  }
  const item = concatResult.concat;
  const [id, rarity, adventurerName, element, weapon] = item.split(', ');
  const [count] = await sql`
    SELECT COUNT(*) from completed
    WHERE name = ${adventurerName}
  `;
  const footer = count.count == 0
    ? 'Not completed by anyone yet'
    : count.count === 1
      ? 'Completed by 1 person'
      : `Completed by ${count.count} people`;
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
    "fields": [{
      "name": "\u200B",
      "value": footer,
    }],
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
    )
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.COMPLETERS)
        .setLabel('See who has completed')
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
      return await sendMessage(interaction, concatResult);
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
    await sendMessage(interaction, results[0]);
    await Promise.all(results.slice(1).map(result => sendMessage(interaction, result, true)));
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
    await Promise.all(results.map(result => sendMessage(interaction, result, true)));
  },
};


const allElementOptions = option =>
  option.setName('element')
    .setDescription('Specify the character element')
    .setRequired(false)
    .addChoices(ALL_ELEMENTS.map(element => [element, element]));

const allWeaponOptions = option =>
  option.setName('weapon')
    .setDescription('Specify the character weapon type')
    .setRequired(false)
    .addChoices(ALL_WEAPONS.map(weapon => [weapon, weapon]));

const popularityCommand = {
  data: new SlashCommandBuilder()
    .setName('popularity')
    .setDescription('Shows the characters who have been marked completed by the most people')
    .addStringOption(option =>
      option.setName('ordering')
        .setDescription('Whether to see the results in ascending or descending order')
        .addChoices([
          [ORDERINGS.ASCENDING, ORDERINGS.ASCENDING],
          [ORDERINGS.DESCENDING, ORDERINGS.DESCENDING],
        ])
    )
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('The page of the popularity board to view. Each page is 10 entries long')
    )
    .addStringOption(allElementOptions)
    .addStringOption(allWeaponOptions),
  execute: async (interaction, _) => {
    const pageSize = 25;
    const ordering = interaction.options.getString('ordering') ?? ORDERINGS.DESCENDING;
    const weapon = capitalize(interaction.options.getString('weapon'));
    const element = capitalize(interaction.options.getString('element'));
    const page = interaction.options.getInteger('page') ?? 1;
    const entries = await popularity(interaction, weapon, element);
    var previousPrefix = null;
    var previousCount = null;
    var fields = entries.sort().map((entry, index) => {
      var prefix = `(${index + 1})`;
      if (entry.count === previousCount) {
        prefix = previousPrefix;
      } else {
        previousPrefix = prefix;
      }

      previousCount = entry.count

      return `${prefix}: ${entry.name} (${entry.count.toString()})`;
    });
    if (ordering ===  ORDERINGS.ASCENDING) {
      fields.reverse();
    }
    fields = fields.slice((page - 1) * pageSize, page * pageSize);
    const suffix = (element != null || weapon != null)
      ? ' for ' + [element, pluralize(weapon) ?? 'Adventurers'].join(' ')
      : ''
    const embed = new MessageEmbed()
      .setTitle('Popularity Rankings' + suffix)
      .setDescription(fields.join('\n'));
    interaction.reply({ embeds: [embed] }).catch(onRejected => console.error(onRejected));
  }
}

const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Shows leaderboard by clears for all users of the bot.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('full')
        .setDescription('Shows leaderboard by clears for all users of the bot'),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('page')
        .setDescription('Shows leaderboard by clears for all users of the bot, 10 entries at a time.')
      .addIntegerOption(option =>
        option.setName('number')
          .setDescription('The page of the leaderboard to view. Each page is 10 entries long')
        ),
    ),
  execute: async (interaction, _) => {
    interaction.deferReply();
    var previousPrefix = null;
    var previousCount = null;
    var selfEntry = null
    const entries = await leaderboard(interaction);
    var fields = entries.sort((a, b) => {
      if (a.count < b.count) {
        return 1;
      } else if (a.count > b.count) {
        return -1;
      } else {
        return a.username.localeCompare(b.username);
      }
    }).map((entry, index) => {
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

      if (entry.count === previousCount) {
        prefix = previousPrefix;
      } else {
        previousPrefix = prefix;
      }

      previousCount = entry.count

      var base = `${prefix}: ${entry.username} (${entry.count.toString()})`;
      if (entry.isSelf) {
        selfEntry = `You are rank ${prefix} with a total of ${entry.count.toString()} adventurers`;
        base = '**' + base + '**';
      }
      return base;
    });
    const subcommand = interaction.options.getSubcommand();
    var page = interaction.options.getInteger('number');
    if (page == null && subcommand == 'page') {
      page = 1;
    }
    if (page != null) {
      fields = fields.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }
    const embed = new MessageEmbed()
      .setTitle('Leaderboard')
      .setDescription([selfEntry, fields.join('\n')].join('\n\n'));
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
      .addStringOption(allElementOptions),
    execute: async (interaction, _) => {
      const element = interaction.options.getString('element') ?? '';
      const query = getQuery(interaction, { element, weapons: [weapon] });
      await logCommand(interaction, 'weapon', element);
      const [concatResult] = await query;
      return await sendMessage(interaction, concatResult);
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
      .addStringOption(allWeaponOptions),
    execute: async (interaction, _) => {
      const weapon = interaction.options.getString('weapon') ?? '';
      const query = getQuery(interaction, { element, weapons: weapon != '' ? [weapon] : ALL_WEAPONS });
      await logCommand(interaction, 'element', weapon);
      const [concatResult] = await query;
      return await sendMessage(interaction, concatResult);
    },
  };
  commands.set(command.data.name, command); // Set the command name and file for handler to use.
  commandArray.push(command.data.toJSON()); // Push the command data to an array (for sending to the API).
});

const completedCommand = statsCommand(
  STATS_COMMANDS.COMPLETED,
  'Lists out the adventurers you\'ve marked as completed',
);

const incompleteCommand = statsCommand(
  STATS_COMMANDS.INCOMPLETE,
  'Lists out the adventurers you haven\'t marked as completed',
);

const blockedCommand = statsCommand(
  STATS_COMMANDS.BLOCKED,
  'Lists out the adventurers you\'ve blocked',
);

function statsCommand(name, description) {
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption(option =>
      option.setName('visibility')
        .setDescription('Whether to display the results to everyone or just yourself')
        .addChoices([
          ['everyone', 'everyone'],
          ['me', 'me'],
        ])
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Person (from the current server) whose lists to view')
    )
    .addStringOption(option =>
      option.setName('external_user')
        .setDescription('Person (from all users of the bot) whose lists to view')
    );
  if (name !== STATS_COMMANDS.BLOCKED) {
    data.addBooleanOption(option =>
      option.setName('allow_blocked')
        .setDescription('Whether to ignore your block list in the counts')
    );
  }
  return {
    data,
    execute: async (interaction, _) => {
      const user = interaction.options.getUser('user');
      const externalUser = interaction.options.getString('external_user');
      var userID = interaction.user.id;
      var usernamePrefix = 'You have';
      var author = interaction.member?.nickname ?? interaction.user.username;
      if (user != null) {
        userID = user.id;
        usernamePrefix = user.username + ' has';
        author = user.username;
      } else if (externalUser != null) {
        const query = `%${externalUser}%`
        const candidates = await sql`
          SELECT userid, username from users
          WHERE username ILIKE ${query}
        `;
        if (candidates.length > 1) {
          return interaction.reply({
            content: `Found more than one possible user:\n · ${candidates.map(candidate => candidate.username).join('\n · ')}\nPlease try again with a more specific query`,
            ephemeral: true,
          });
        } else {
          userID = candidates[0].userid;
          usernamePrefix = candidates[0].username + ' has';
          author = candidates[0].username;
        }
      }
      const allowBlocked = interaction.options.getBoolean('allow_blocked') ?? false;
      const totalCounts = await sql`
        WITH exclude AS (
          SELECT CONCAT(name, ', ', element, ', ', weapon)
          FROM blocked
          WHERE userid = (
            CASE
              WHEN ${allowBlocked} THEN NULL
              ELSE ${userID}
            END
          )
        )
        SELECT COUNT(*), element, weapon
        FROM adventurers
        WHERE CONCAT(name, ', ', element, ', ', weapon) NOT IN (SELECT * FROM exclude)
        GROUP BY element, weapon
      `;
      var numeratorCounts, numeratorNames;
      switch (name) {
        case STATS_COMMANDS.COMPLETED:
          numeratorCounts = await (
            sql`
              SELECT COUNT(*), element, weapon
              FROM completed
              WHERE userid = ${userID} GROUP BY element, weapon
            `
          );
          numeratorNames = await (
            sql`
              SELECT element, weapon, string_agg(name, ', ')
              FROM completed
              WHERE userid = ${userID} GROUP BY element, weapon
            `
          );
          break;
        case STATS_COMMANDS.INCOMPLETE:
          numeratorCounts = await (
            sql`
              WITH exclude AS (
                SELECT CONCAT(name, ', ', element, ', ', weapon)
                FROM completed
                WHERE userid = ${interaction.user.id}
                UNION ALL
                SELECT CONCAT(name, ', ', element, ', ', weapon)
                FROM blocked
                WHERE userid = (
                  CASE
                    WHEN ${allowBlocked} THEN NULL
                    ELSE ${interaction.user.id}
                  END
                )
              )
              SELECT COUNT(*), element, weapon
              FROM adventurers
              WHERE CONCAT(name, ', ', element, ', ', weapon) NOT IN (SELECT * FROM exclude)
              GROUP BY element, weapon
            `
          );
          numeratorNames = await (
            sql`
              WITH exclude AS (
                SELECT CONCAT(name, ', ', element, ', ', weapon)
                FROM completed
                WHERE userid = ${interaction.user.id}
                UNION ALL
                SELECT CONCAT(name, ', ', element, ', ', weapon)
                FROM blocked
                WHERE userid = (
                  CASE
                    WHEN ${allowBlocked} THEN NULL
                    ELSE ${interaction.user.id}
                  END
                )
              )
              SELECT element, weapon, string_agg(name, ', ')
              FROM adventurers
              WHERE CONCAT(name, ', ', element, ', ', weapon) NOT IN (SELECT * FROM exclude)
              GROUP BY element, weapon
            `
          );
          break;
        case STATS_COMMANDS.BLOCKED:
          numeratorCounts = await (
            sql`
              SELECT COUNT(*), element, weapon
              FROM blocked
              WHERE userid = ${interaction.user.id} GROUP BY element, weapon
            `
          );
          numeratorNames = await (
            sql`
              SELECT element, weapon, string_agg(name, ', ')
              FROM blocked
              WHERE userid = ${interaction.user.id} GROUP BY element, weapon
            `
          );
          break;
      }
      const countReducer = (previousValue, currentValue) => previousValue + currentValue.count;
      const totalAdventurers = totalCounts.reduce(countReducer, 0);
      const totalNumerator = numeratorCounts.reduce(countReducer, 0);
      const isCompleted = name == 'completed';
      const visibility = interaction.options.getString('visibility');
      const ephemeral = visibility !== 'everyone';
      await logCommand(interaction, name, visibility);

      var content;
      switch (name) {
        case STATS_COMMANDS.COMPLETED:
        case STATS_COMMANDS.BLOCKED:
          content = `${usernamePrefix} ${name} ${formatCounts(totalNumerator, totalAdventurers)} adventurers`;
          break;
        case STATS_COMMANDS.INCOMPLETE:
          content = `${usernamePrefix} ${formatCounts(totalNumerator, totalAdventurers)} adventurers remaining`;
          break;
      }
      interaction.reply({
        content,
        ephemeral,
      }).catch(onRejected => console.error(onRejected));
      if (totalNumerator == 0) {
        return;
      }

      if (totalNumerator == totalAdventurers) {
        interaction.followUp({
          content: 'Wait, 100%?! You madman, you\'ve done it! 🥳 Now, go outside and get a life or something, jeez...'
        });
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
          .setAuthor(author)
          .addFields(fields.filter(Boolean))
        interaction.followUp({
          embeds: [embed],
          ephemeral,
        }).catch(onRejected => console.error(onRejected));
      });
    }
  };
}

const historyCommand = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Shows completions from the last day by all users of the bot.'),
  execute: async (interaction, _) => {
    interaction.deferReply();
    const entries = await history(interaction);
    var fields = entries.map(entry => {
      const name = entry.isSelf ? 'You' : entry.username;
      var base = `${entry.prefix}: ${name} completed ${entry.names}`;
      if (entry.isSelf) {
        base = '**' + base + '**';
      }
      return base;
    });
    const embed = new MessageEmbed()
      .setTitle(`History`)
      .setDescription(fields.join('\n'));
    interaction.editReply({ embeds: [embed] }).catch(onRejected => console.error(onRejected));
  },
};

function capitalize(input) {
  if (input == null) {
    return null;
  }
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function pluralize(input) {
  if (input == null) {
    return null;
  }
  if (input.toLowerCase() === 'staff') {
    return 'Staves'
  }
  return input + 's';
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
  incompleteCommand,
  blockedCommand,
  searchCommand,
  manageCommand,
  dailyCommand,
  leaderboardCommand,
  popularityCommand,
  historyCommand,
  helpCommand,
].map(command => {
  commands.set(command.data.name, command);
  commandArray.push(command.data.toJSON());
});

module.exports = {
  commands,
  commandArray,
}