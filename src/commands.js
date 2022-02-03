const {Collection, MessageActionRow, MessageButton, MessageEmbed} = require('discord.js'); // Define Client, Intents, and Collection.
const {SlashCommandBuilder} = require("@discordjs/builders");
const {ACTION_TYPE, ALL_ELEMENTS, ALL_WEAPONS, MELEE_WEAPONS, RANGED_WEAPONS, COLORS} = require('./consts');
const {sql, getQuery, search} = require('./db');

const commands = new Collection(); // Where the bot (slash) commands will be stored.
const commandArray = []; // Array to store commands for sending to the REST API.

function sendMessage(interaction, concatResult) {
  if (concatResult == undefined) {
    return interaction.reply(`Could not find an adventurer with those restrictions... Try allowing completed adventurers or removing some from your blocklist`);
  }
  const item = concatResult.concat;
  console.log(concatResult, item);
  const adventurerName = item.split(',')[0];
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.COMPLETE)
        .setLabel('Mark complete')
        .setEmoji('✅')
        .setStyle('SECONDARY'),
    )
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.INCOMPLETE)
        .setLabel('Mark incomplete')
        .setEmoji('☑️')
        .setStyle('SECONDARY'),
    )
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.BLOCK)
        .setLabel('Block')
        .setEmoji('🚫')
        .setStyle('SECONDARY'),
    )
    .addComponents(
      new MessageButton()
        .setCustomId(ACTION_TYPE.UNBLOCK)
        .setLabel('Unblock')
        .setEmoji('🆗')
        .setStyle('SECONDARY'),
    )
    .addComponents(
      new MessageButton()
        .setLabel('Wiki')
        .setStyle('LINK')
        .setURL(`https://dragalialost.wiki/index.php?title=Special:Search&search=${encodeURIComponent(adventurerName)}`),
    );
  return interaction.reply({ content: item, components: [row] });
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
      return sendMessage(interaction, concatResult);
    }
  };
}

const searchCommand = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for particular characters by name (exact match), as a comma separated list')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('The search query, names (exact match), as a comma separated list')
        .setRequired(true)),
  execute: async (interaction, _) => {
    const query = await search(interaction);
    // const [result] = await query;
    // return sendMessage(interaction, concatResult);
  },
};

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
      console.log(weapon);
      const query = getQuery(interaction, { element, weapons: weapon != '' ? [weapon] : ALL_WEAPONS });
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
      .setDescription(description),
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

      interaction.reply({
        content: `You've ${name} ${formatCounts(totalNumerator, totalAdventurers)} adventurers`,
      });
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
            name: `${capitalize(weapon)}: ${formatCounts(numeratorCount, totalCount)}`,
            value: value.string_agg,
            inline: true,
          }
        });
        const numeratorCount = numeratorCounts.filter(elementFilter).reduce(countReducer, 0);
        const totalCount = totalCounts.filter(elementFilter).reduce(countReducer, 0);
        const embed = new MessageEmbed()
          .setColor(COLORS[element.toUpperCase()])
          .setTitle(`${capitalize(element)}: ${formatCounts(numeratorCount, totalCount)}`)
          .setAuthor(interaction.user.username)
          .addFields(fields.filter(Boolean))
        interaction.followUp({ embeds: [embed] });
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

function formatCounts(completedCount, totalCount) {
  return `${completedCount}/${totalCount} (${formatPercentage(completedCount, totalCount)})`;
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
].map(command => {
  commands.set(command.data.name, command);
  commandArray.push(command.data.toJSON());
});

module.exports = {
  commands,
  commandArray,
}