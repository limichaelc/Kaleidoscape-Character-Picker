const {SlashCommandBuilder} = require("@discordjs/builders");
const {sql, logCommand} = require('./db');
const {pluralize, allWeaponOptions} = require('./utils');
const {ALL_ELEMENTS, COLORS} = require('./consts')

const ABILITY_TYPE = {
  STRENGTH: 'Strength',
  SKILL_DAMAGE: 'Skill Damage',
  CRITICAL_RATE: 'Critical Rate',
  FORCE_STRIKE: 'Force Strike',
  HP: 'HP',
  DRAGON_DAMAGE: 'Dragon Damage',
  DRAGON_HASTE: 'Dragon Haste',
  SKILL_HASTE: 'Skill Haste',
  SKILL_PREP: 'Skill Prep',
  DEFENSE: 'Defense',
  CRITICAL_DAMAGE: 'Critical Damage',
  RECOVERY_POTENCY: 'Recovery Potency',
  DRAGON_TIME: 'Dragon Time',
  STEADY_HITTER: 'Steady Hitter',
  EASY_HITTER: 'Easy Hitter',
  LUCKY_HITTER: 'Lucky Hitter',
  HASTY_HITTER: 'Hasty Hitter',
};

const RESTRICTIONS = {
  NONE: 'NONE',
  ELEMENT: 'ELEMENT',
  ELEMENT_WEAPON: 'ELEMENT_WEAPON',
};

const VALUE_THRESHOLDS = {
  [ABILITY_TYPE.STRENGTH]: {
    [RESTRICTIONS.NONE]: [3, 4, 5, 6, 7, 8, 10],
    [RESTRICTIONS.ELEMENT]: [15, 18],
    [RESTRICTIONS.ELEMENT_WEAPON]: [20],
  },
  [ABILITY_TYPE.SKILL_DAMAGE]: {
    [RESTRICTIONS.NONE]: [6, 7, 8, 9, 10, 15, 20],
    [RESTRICTIONS.ELEMENT]: [30, 35],
    [RESTRICTIONS.ELEMENT_WEAPON]: [40],
  },
  [ABILITY_TYPE.CRITICAL_RATE]: {
    [RESTRICTIONS.NONE]: [2, 3, 4, 5, 6, 7, 8],
    [RESTRICTIONS.ELEMENT]: [10, 13],
    [RESTRICTIONS.ELEMENT_WEAPON]: [15],
  },
  [ABILITY_TYPE.FORCE_STRIKE]: {
    [RESTRICTIONS.NONE]: [15, 17, 18, 19, 20, 25, 30],
    [RESTRICTIONS.ELEMENT]: [40, 45],
    [RESTRICTIONS.ELEMENT_WEAPON]: [50],
  },
  [ABILITY_TYPE.HP]: {
    [RESTRICTIONS.NONE]: [2, 3, 4, 5, 6, 7, 8],
    [RESTRICTIONS.ELEMENT]: [10, 13],
    [RESTRICTIONS.ELEMENT_WEAPON]: [15],
  },
  [ABILITY_TYPE.DRAGON_DAMAGE]: {
    [RESTRICTIONS.NONE]: [4, 5, 6, 7, 8, 9, 10],
    [RESTRICTIONS.ELEMENT]: [13, 15],
    [RESTRICTIONS.ELEMENT_WEAPON]: [18],
  },
  [ABILITY_TYPE.DRAGON_HASTE]: {
    [RESTRICTIONS.NONE]: [2, 3, 4, 5, 6, 7, 8],
    [RESTRICTIONS.ELEMENT]: [10, 13],
    [RESTRICTIONS.ELEMENT_WEAPON]: [15],
  },
  [ABILITY_TYPE.SKILL_HASTE]: {
    [RESTRICTIONS.NONE]: [2, 3, 4, 5],
    [RESTRICTIONS.ELEMENT]: [6, 7],
    [RESTRICTIONS.ELEMENT_WEAPON]: [8],
  },
  [ABILITY_TYPE.SKILL_PREP]: {
    [RESTRICTIONS.NONE]: [15, 17, 18, 19, 20, 25, 30],
    [RESTRICTIONS.ELEMENT]: [40, 45],
    [RESTRICTIONS.ELEMENT_WEAPON]: [50],
  },
  [ABILITY_TYPE.DEFENSE]: {
    [RESTRICTIONS.NONE]: [3, 4, 5, 6],
    [RESTRICTIONS.ELEMENT]: [7, 8],
    [RESTRICTIONS.ELEMENT_WEAPON]: [10],
  },
  [ABILITY_TYPE.CRITICAL_DAMAGE]: {
    [RESTRICTIONS.NONE]: [6, 7, 8, 9],
    [RESTRICTIONS.ELEMENT]: [10, 13],
    [RESTRICTIONS.ELEMENT_WEAPON]: [15],
  },
  [ABILITY_TYPE.RECOVERY_POTENCY]: {
    [RESTRICTIONS.NONE]: [3, 4, 5, 6, 7, 8, 10],
    [RESTRICTIONS.ELEMENT]: [15, 18],
    [RESTRICTIONS.ELEMENT_WEAPON]: [20],
  },
  [ABILITY_TYPE.DRAGON_TIME]: {
    [RESTRICTIONS.NONE]: [3, 4, 5, 6, 7, 8, 10],
    [RESTRICTIONS.ELEMENT]: [15, 18],
    [RESTRICTIONS.ELEMENT_WEAPON]: [20],
  },
};

const TRADEOFF_VALUES = {
  [ABILITY_TYPE.STEADY_HITTER]: {
    [ABILITY_TYPE.SKILL_DAMAGE]: 40,
    [ABILITY_TYPE.CRITICAL_DAMAGE]: -25,
  },
  [ABILITY_TYPE.EASY_HITTER]: {
    [ABILITY_TYPE.STRENGTH]: 20,
    [ABILITY_TYPE.FORCE_STRIKE]: -50,
  },
  [ABILITY_TYPE.LUCKY_HITTER]: {
    [ABILITY_TYPE.CRITICAL_RATE]: 15,
    [ABILITY_TYPE.DRAGON_DAMAGE]: -18,
  },
  [ABILITY_TYPE.HASTY_HITTER]: {
    [ABILITY_TYPE.SKILL_HASTE]: 15,
    [ABILITY_TYPE.SKILL_DAMAGE]: -40,
  },
};

const SLOT_1_ABILITY_TYPES = [
  ABILITY_TYPE.STRENGTH,
  ABILITY_TYPE.SKILL_DAMAGE,
  ABILITY_TYPE.CRITICAL_RATE,
  ABILITY_TYPE.FORCE_STRIKE,
  ABILITY_TYPE.HP,
  ABILITY_TYPE.DRAGON_DAMAGE,
  ABILITY_TYPE.DRAGON_HASTE,
];

const SLOT_2_ABILITY_TYPES = [
  ABILITY_TYPE.SKILL_HASTE,
  ABILITY_TYPE.SKILL_PREP,
  ABILITY_TYPE.DEFENSE,
  ABILITY_TYPE.CRITICAL_DAMAGE,
  ABILITY_TYPE.RECOVERY_POTENCY,
  ABILITY_TYPE.DRAGON_TIME,
  ABILITY_TYPE.STEADY_HITTER,
  ABILITY_TYPE.EASY_HITTER,
  ABILITY_TYPE.LUCKY_HITTER,
  ABILITY_TYPE.HASTY_HITTER,
];

const ABILITY_NAMES = {
  [ABILITY_TYPE.STRENGTH]: ['strength', 'str'],
  [ABILITY_TYPE.SKILL_DAMAGE]: ['skilldamage', 'skill_damage', 'skdam'],
  [ABILITY_TYPE.CRITICAL_RATE]: [
    'criticalrate',
    'critical_rate',
    'crit_rate',
    'critrate',
    'crate',
  ],
  [ABILITY_TYPE.FORCE_STRIKE]: ['forcestrike', 'force_strike', 'fs', 'force'],
  [ABILITY_TYPE.HP]: ['hp'],
  [ABILITY_TYPE.DRAGON_DAMAGE]: ['dragondamage', 'dragon_damage', 'ddamage'],
  [ABILITY_TYPE.DRAGON_HASTE]: ['dragonhaste', 'dragon_haste', 'dhaste'],
  [ABILITY_TYPE.SKILL_HASTE]: [
    'skillhaste',
    'skill_haste',
    'shaste',
    'skhaste',
  ],
  [ABILITY_TYPE.SKILL_PREP]: ['skillprep', 'skill_prep', 'prep', 'skprep'],
  [ABILITY_TYPE.DEFENSE]: ['defense', 'def'],
  [ABILITY_TYPE.CRITICAL_DAMAGE]: [
    'criticaldamage',
    'critical_damage',
    'crit_dam',
    'critdam',
    'cdam',
  ],
  [ABILITY_TYPE.RECOVERY_POTENCY]: [
    'recoverypotency',
    'recovery_potency',
    'recovery',
    'potency',
    'rec',
    'recpot',
  ],
  [ABILITY_TYPE.DRAGON_TIME]: ['dragontime', 'dragon_time', 'time', 'dtime'],
  [ABILITY_TYPE.STEADY_HITTER]: ['steadyhitter', 'steady_hitter', 'steady'],
  [ABILITY_TYPE.EASY_HITTER]: ['easyhitter', 'easy_hitter', 'easy'],
  [ABILITY_TYPE.LUCKY_HITTER]: ['luckyhitter', 'lucky_hitter', 'lucky'],
  [ABILITY_TYPE.HASTY_HITTER]: ['hastyhitter', 'hasty_hitter', 'hasty'],
};

function isHitterAbility(type) {
  return [
      ABILITY_TYPE.STEADY_HITTER,
      ABILITY_TYPE.EASY_HITTER,
      ABILITY_TYPE.LUCKY_HITTER,
      ABILITY_TYPE.HASTY_HITTER,
    ].includes(type);
}

function parseAbility(str, index) {
  var [typeStr, valueStr] = str.toLowerCase().trim().split(' ');
  if (valueStr == null && !isHitterAbility(typeStr)) {
    valueStr = typeStr.replace(/[^0-9]/gi, '');
    typeStr = typeStr.replace(/[^a-z]/gi, '');
  }
  const type = find(ABILITY_NAMES, typeStr);

  if (type == null) {
    return {error: `Could not find matching ability for ${str}`};
  }

  if (index === 0 && !SLOT_1_ABILITY_TYPES.includes(type)) {
    return {error: `${type} is not a slot 1 ability`};
  }

  if (index === 1 && !SLOT_2_ABILITY_TYPES.includes(type)) {
    return {error: `${type} is not a slot 2 ability`};
  }

  if (isHitterAbility(type)) {
    return {
      type,
      value: null,
      restriction: RESTRICTIONS.ELEMENT_WEAPON,
    };
  }

  const value = parseInt(valueStr);
  if (value == NaN) {
    return {error: `Invalid value of ${valueStr} for ability for ${type}`};
  }

  const restriction = find(VALUE_THRESHOLDS[type], value);
  if (restriction == null) {
    return {error: `Invalid value of ${valueStr} for ability for ${type}`};
  }

  return { type, value, restriction };
}

function find(haystack, needle) {
  return Object.keys(haystack).find((key) => {
    if (haystack[key].includes(needle)) {
      return key;
    }
  });
}

function formatAbility(element, weapon, type, value) {
  const prefix = [element, weapon].filter(Boolean).length === 0
    ? ''
    : `(${[element, weapon].filter(Boolean).join(' & ')})`;
  const base = `${prefix} ${type} `;
  return isHitterAbility(type)
    ? base + 'I'
    : base + `+${value}%`;
}

function formatPrint(print) {
  const ability2Str = print.ability2_type != null
      ? (' / ' + formatAbility(print.ability2_element, print.ability2_weapon, print.ability2_type, print.ability2_value))
      : ''
  return `ID ${print.id}: ${formatAbility(print.ability1_element, print.ability1_weapon, print.ability1_type, print.ability1_value)}${ability2Str}`;
}

async function genPrintsFieldForElementWeapon(interaction, elementWeapon) {
  const userID = interaction.user.id;
  const {element, weapon} = elementWeapon;
  const prints = await sql`
    SELECT * from prints
    WHERE userid = ${userID}
    AND (
      ability1_element = ${element}
      AND (
        ability1_weapon = ${weapon}
        OR ability1_weapon IS NULL
      )
      OR ability2_element = ${element}
      AND (
        OR ability2_weapon = ${weapon}
        OR ability2_weapon IS NULL
      )
    )
  `;
  return (prints.length === 0)
    ? null
    : fieldifyPrints(prints);
}

// function comparePrints(print1, print2) {
//   // same first ability
//   if (print1.ability1.type === print2.ability1.type) {
//     const ability1Comparison = print1.ability1.value - print2.ability1.value;
//     // same second ability
//     if (print1.ability2.type === print2.ability2.type) {
//       const ability2Comparison = print1.ability2.value - print2.ability2.value;
//       if (ability1Comparison > 0 && ability2Comparison > 0) {
//         return -1;
//       }
//       if (ability1Comparison === 0) {
//         return ability2Comparison;
//       }
//       if (ability2Comparison === 0) {
//         return ability1Comparison;
//       }
//     }
//   }
//   if (print1.weapon !== print2.weapon)
// }

async function genNameElementWeapon(adventurer) {
  const results = await sql`
    SELECT name, element, weapon FROM adventurers
    WHERE CONCAT(',', aliases, ',') LIKE CONCAT('%,', ${adventurer}::text, ',%') OR LOWER(name) = ${adventurer}
  `;
  if (results.length == 0) {
    return {error: `Could not find adventurer for query "${adventurer}"`};
  }
  if (results.length > 1) {
    return {error: `Found more than one adventurer for query "${adventurer}": ${results.map(result => result.name).join(', ')}`};
  }
  return results[0];
}

async function genAddPrints(userID, adventurer, printStrs) {
  const elementWeapon = await genNameElementWeapon(adventurer);
  if (elementWeapon.error != null) {
    return {errors: [elementWeapon.error], successes: []};
  }
  const {name, element, weapon} = elementWeapon;
  const prints = printStrs
    .split(';')
    .map((print) => {
      const [ability1, ability2] = print.split(',').map((ability, index) => parseAbility(ability, index));
      if (ability1.error != null || ability2.error != null) {
        return [ability1?.error, ability2?.error].filter(Boolean).join('; ') + ` ("*${print}*")`;
      }
      return {
        userid: userID,
        adventurer: name,
        ability1_type: ability1.type,
        ability1_value: ability1.value,
        ability1_element: ability1.restriction !== RESTRICTIONS.NONE ? element : null,
        ability1_weapon: ability1.restriction === RESTRICTIONS.ELEMENT_WEAPON ? weapon : null,
        ability2_type: ability2.type,
        ability2_value: ability2.value,
        ability2_element: ability2.restriction !== RESTRICTIONS.NONE ? element : null,
        ability2_weapon: ability2.restriction === RESTRICTIONS.ELEMENT_WEAPON ? weapon : null,
      };
    });
  const errors = prints.filter(print => print.userid == null);
  const filtered = prints.filter(print => print.userid != null);

  const successes = (filtered.length > 0)
    ? await sql`
      WITH rows AS (
        INSERT INTO prints ${sql(
          filtered,
          'userid',
          'adventurer',
          'ability1_type',
          'ability1_value',
          'ability1_weapon',
          'ability1_element',
          'ability2_type',
          'ability2_value',
          'ability2_weapon',
          'ability2_element',
        )}
        RETURNING *
      )
      SELECT * FROM rows
    `
    : [];
  return {errors, successes};
}

function fieldifyPrints(prints) {
  const map = {};
  prints.forEach(print => {
    if (map[print.adventurer] == null) {
      map[print.adventurer] = [];
    }
    map[print.adventurer].push(print);
  });
  return Object.keys(map).map(adventurer => {
    const prints = map[adventurer];
    return {
      name: adventurer,
      value: prints.map(print => formatPrint(print)).join('\n'),
    };;
  });
}

const PRINTS_COMMAND_GROUPS = {
  FOR: 'for',
};

const PRINTS_SUBCOMMANDS = {
  ADD: 'add',
  ADVENTURER: 'adventurer',
  DELETE: 'delete',
  ELEMENT: 'element',
  PAGE: 'page',
}

const printsCommand = {
  data: new SlashCommandBuilder()
    .setName('prints')
    .setDescription('Manage your personal portait prints database')
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName(PRINTS_COMMAND_GROUPS.FOR)
        .setDescription('Find prints from your collection suitable for a given adventurer or element/weapon')
        .addSubcommand(subcommand =>
          subcommand
            .setName(PRINTS_SUBCOMMANDS.ADVENTURER)
            .setDescription('Find prints from your collection suitable for a given adventurer')
            .addStringOption(option =>
              option.setName('query')
                .setDescription('The search query, single name, fuzzy match'))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName(PRINTS_SUBCOMMANDS.ELEMENT)
            .setDescription('Find prints from your collection suitable for a given element, and optionally, weapon')
            .addStringOption(option =>
              option.setName('element')
                .setDescription('Specify the character element')
                .setRequired(true)
                .addChoices(ALL_ELEMENTS.map(element => [element, element])))
            .addStringOption(allWeaponOptions)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName(PRINTS_SUBCOMMANDS.ADD)
        .setDescription('Add prints to your collection')
        .addStringOption(option =>
          option.setName('adventurer')
            .setDescription('Search query for the adventurer whose prints you are adding, single name, fuzzy match')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('prints')
            .setDescription('Print descriptions as "hp 15, prep 40". Separate multiples with ";". See `/help prints` for more')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName(PRINTS_SUBCOMMANDS.PAGE)
        .setDescription('View your print collection')
        .addStringOption(option =>
          option.setName('page')
            .setDescription('The page of your print collection to view. Each page is 10 entries long')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName(PRINTS_SUBCOMMANDS.DELETE)
        .setDescription('Delete prints from your print collection')
        .addStringOption(option =>
          option.setName('ids')
            .setDescription('The ids of the prints you want to delete, comma separated')
            .setRequired(true)
        )
    ),
  execute: async (interaction, _) => {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === PRINTS_SUBCOMMANDS.ADD) {
      const adventurer = interaction.options.getString('adventurer');
      const printStrs = interaction.options.getString('prints');
      await logCommand(interaction, 'prints add', adventurer + ' ' + printStrs);
      const {errors, successes} = await genAddPrints(interaction.user.id, adventurer, printStrs);
      const errorEmbed = errors.length > 0
        ? {
            title: 'Ran into the following errors:',
            description: errors.join('\n'),
          }
        : null;
      const successEmbed = successes.length > 0
        ? {
            title: `Successfully added ${successes.length} print${successes.length > 1 ? 's' : ''}:`,
            fields: fieldifyPrints(successes),
          }
        : null;
      if (successEmbed != null) {
        interaction.editReply({embeds: [successEmbed]});
        if (errorEmbed != null) {
          interaction.followUp({embeds: [errorEmbed]});
        }
      } else if (errorEmbed != null) {
        interaction.editReply({embeds: [errorEmbed]});
      }
    } else if (subcommand === PRINTS_SUBCOMMANDS.PAGE) {
      var page = interaction.options.getInteger('page');
      await logCommand(interaction, 'prints page', page);
      if (page == null && subcommand == 'page') {
        page = 1;
      }
      const [count] = await sql`
        SELECT COUNT(*) from prints
        WHERE userid = ${interaction.user.id}
      `;

      const totalPages = Math.ceil(count.count / 10)
      const prints = await sql`
        SELECT * from prints
        WHERE userid = ${interaction.user.id}
        ORDER BY id
        OFFSET ${(page - 1) * 10}
        LIMIT 10
      `;

      const embed = {
        "type": "rich",
        "title": `${interaction.member?.nickname ?? interaction.user.username}'s Print Collection (Page ${page} of ${totalPages})`,
        "fields": fieldifyPrints(prints),
      };
      return interaction.editReply({embeds: [embed]}).catch(onRejected => console.error(onRejected));
    } else if (subcommand === PRINTS_SUBCOMMANDS.DELETE) {
      const ids = interaction.options.getString('ids').split(',').map(id => parseInt(id));
      console.log(ids);
      await logCommand(interaction, 'prints delete', ids);
      const removed = await sql`
        WITH rows AS (
          DELETE FROM prints
          WHERE userid = ${interaction.user.id} AND id in ${sql.array(ids)}
          RETURNING *
        )
        SELECT * FROM rows
      `;
      const embed = {
        "title": `Successfully deleted ${removed.length} print${removed.length > 1 ? 's' : ''}:`,
        "fields": fieldifyPrints(removed),
      };
      return interaction.editReply({embeds: [embed]}).catch(onRejected => console.error(onRejected));
    } else {
      const group = interaction.options.getSubcommandGroup();
      if (group === PRINTS_COMMAND_GROUPS.FOR) {
        switch (subcommand) {
          case PRINTS_SUBCOMMANDS.ADVENTURER: {
            const query = interaction.options.getString('query');
            await logCommand(interaction, 'prints for adventurer', query);
            const nameElementWeapon = await genNameElementWeapon(query);
            if (nameElementWeapon.error != null) {
              return interaction.editReply({
                content: nameElementWeapon.error,
              }).catch(onRejected => console.error(onRejected));
            }
            const printsField = await genPrintsFieldForElementWeapon(interaction, nameElementWeapon);
            const embed = {
              "type": "rich",
              "title": `Prints suitable for ${nameElementWeapon.name} (${nameElementWeapon.element} ${nameElementWeapon.weapon})`,
              "fields": printsField,
              "description": printsField == null ? 'No prints found' : null,
              "color": COLORS[nameElementWeapon.element.toUpperCase()],
            }
            return interaction.editReply({embeds: [embed]}).catch(onRejected => console.error(onRejected));;
          }
          case PRINTS_SUBCOMMANDS.ELEMENT:
            const element = interaction.options.getString('element');
            const weapon = interaction.options.getString('weapon');
            await logCommand(interaction, 'prints for element', element + (weapon != null ? ` ${weapon}` : ''));
            const printsField = await genPrintsFieldForElementWeapon(interaction, {element, weapon});
            const embed = {
              "type": "rich",
              "title": `Prints suitable for ${capitalize(element)} ${pluralize(weapon) ?? ''}`,
              "fields": printsField,
              "description": printsField == null ? 'No prints found' : null,
              "color": COLORS[element.toUpperCase()],
            }
            return interaction.editReply({embeds: [embed]}).catch(onRejected => console.error(onRejected));;
        }
      }
    }
  }
}

module.exports = {
  printsCommand,
}