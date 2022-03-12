const {SlashCommandBuilder} = require("@discordjs/builders");
const {sql} = require('./db');
const {pluralize, allWeaponOptions} = require('./utils');
const {ALL_ELEMENTS, COLORS} = require('./consts')

const ABILITY_TYPE = {
  STRENGTH: 'Strength',
  SKILL_DAMAGE: 'Skill Damange',
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

function parseAbility(str) {
  const [typeStr, valueStr] = str.trim().split(' ');
  const type = find(ABILITY_NAMES, typeStr.toLowerCase());

  if (type == null) {
    return {error: `Could not find matching ability for ${str}`};
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
    : `(${[element, weapon].join(' & ')})`;
  const base = `${prefix} ${type} `;
  return isHitterAbility(type)
    ? base + 'I'
    : base + `${value}%`;
}

function formatPrint(print) {
  const ability2Str = print.ability2_type != null
      ? (' / ' + formatAbility(print.ability2_element, print.ability2_weapon, print.ability2_type, print.ability2_value))
      : ''
  return `(ID ${print.id}) ${print.adventurer}: ${formatAbility(print.ability1_element, print.ability1_weapon, print.ability1_type, print.ability1_value)}${ability2Str}`;
}

async function genPrintsForElementWeapon(interaction, elementWeapon) {
  const userID = interaction.user.id;
  const {element, weapon} = elementWeapon;
  const prints = await sql`
    SELECT * from prints
    WHERE userid = ${userID}
    AND (
      ability1_element = ${element}
      OR ability1_element IS NULL
      OR ability2_element = ${element}
      OR ability2_element IS NULL
    )
    AND (
      ability1_weapon = ${weapon}
      OR ability1_weapon IS NULL
      OR ability2_weapon = ${weapon}
      OR ability2_weapon IS NULL
    )
  `;
  const results = prints.map(print => formatPrint(print));
  return (results.length === 0)
    ? ['No prints found']
    : results;
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
    WHERE CONCAT(',', aliases, ',') LIKE CONCAT('%,', ${adventurer}::text, ',%') OR name = ${adventurer}
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
    return elementWeapon.error;
  }
  const {name, element, weapon} = elementWeapon;
  const prints = printStrs
    .split(';')
    .map((print) => {
      const [ability1, ability2] = print.split(',').map((ability) => parseAbility(ability));
      if (ability1.error != null || ability2.error != null) {
        return {error: [ability1.error, ability2.error].join('\n')};
      }
      return {
        userid: userID,
        adventurer: name,
        abitily1_type: ability1.type,
        abitily1_value: ability1.value,
        abitily1_element: ability1.restriction !== RESTRICTIONS.NONE ? element : null,
        abitily1_weapon: ability1.restriction === RESTRICTIONS.ELEMENT_WEAPON ? weapon : null,
        abitily2_type: ability2.type,
        abitily2_value: ability2.value,
        abitily2_element: ability2.restriction !== RESTRICTIONS.NONE ? element : null,
        abitily2_weapon: ability2.restriction === RESTRICTIONS.ELEMENT_WEAPON ? weapon : null,
      };
    });
  const errors = prints.filter(print => print.error != null);
  const successes = await sql`
    WITH rows AS (
      INSERT INTO prints
      VALUES ${sql(
        prints.filter(print => print.error == null),
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
  `;
  return {errors, successes};
}

const PRINTS_COMMAND_GROUPS = {
  FOR: 'for',
};

const PRINTS_SUBCOMMANDS = {
  ADD: 'add',
  ADVENTURER: 'adventurer',
  ELEMENT: 'element',
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
    ),
  execute: async (interaction, _) => {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === PRINTS_SUBCOMMANDS.ADD) {
      const adventurer = interaction.options.getString('adventurer');
      const printStrs = interaction.options.getString('prints');
      const {errors, successes} = await genAddPrints(interaction.user.id, adventurer, printStrs);
      const errorField = errors.length > 0
        ? {
            name: 'Ran into the following errors:',
            value: errors.join('\n'),
          }
        : null;
      const successField = successes.length > 0
        ? {
            name: `Successfully added ${successes.length} prints:`,
            value: prints.map(print => formatPrint(print)).join('\n'),
          }
        : null;

      const embed = {
        "type": "rich",
        "fields": [successField, errorField],
      };
      return interaction.editReply({embeds: [embed]}).catch(onRejected => console.error(onRejected));
    } else {
      const group = interaction.options.getSubcommandGroup();
      if (group === PRINTS_COMMAND_GROUPS.FOR) {
        switch (subcommand) {
          case PRINTS_SUBCOMMANDS.ADVENTURER: {
            const query = interaction.options.getString('query');
            const nameElementWeapon = await genNameElementWeapon(query);
            if (nameElementWeapon.error != null) {
              return interaction.editReply({
                content: nameElementWeapon.error,
              }).catch(onRejected => console.error(onRejected));
            }
            const prints = await genPrintsForElementWeapon(interaction, nameElementWeapon);
            const embed = {
              "type": "rich",
              "title": `Prints suitable for ${nameElementWeapon.name} (${nameElementWeapon.element} ${nameElementWeapon.weapon})`,
              "description": prints.join('\n'),
              "color": COLORS[nameElementWeapon.element.toUpperCase()],
            }
            return interaction.editReply({embeds: [embed]}).catch(onRejected => console.error(onRejected));;
          }
          case PRINTS_SUBCOMMANDS.ELEMENT:
            const element = interaction.options.getString('element');
            const weapon = interaction.options.getString('weapon');
            const prints = await genPrintsForElementWeapon(interaction, {element, weapon});
            const embed = {
              "type": "rich",
              "title": `Prints suitable for ${element} ${pluralize(weapon)}`,
              "description": prints.join('\n'),
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