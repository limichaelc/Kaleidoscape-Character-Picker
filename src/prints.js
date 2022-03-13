const {SlashCommandBuilder} = require("@discordjs/builders");
const {sql, logCommand} = require('./db');
const {capitalize, pluralize, allWeaponOptions} = require('./utils');
const {ALL_ELEMENTS, COLORS} = require('./consts');

const MAX_LENGTH = 1024;
const MAX_FIELD_LENGTH_SUM = 5500; // 6k embed limit, -500 for buffer
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
  [ABILITY_TYPE.STRENGTH]: ['strength', 'str', 's'],
  [ABILITY_TYPE.SKILL_DAMAGE]: ['skill damage', 'skilldamage', 'skill_damage', 'skdam', 'sd'],
  [ABILITY_TYPE.CRITICAL_RATE]: [
    'critical rate',
    'criticalrate',
    'critical_rate',
    'crit_rate',
    'critrate',
    'crate',
    'cr',
  ],
  [ABILITY_TYPE.FORCE_STRIKE]: ['forcestrike', 'force_strike', 'fs', 'force', 'f'],
  [ABILITY_TYPE.HP]: ['hp', 'h'],
  [ABILITY_TYPE.DRAGON_DAMAGE]: ['dragon damage', 'dragondamage', 'dragon_damage', 'ddamage', 'ddam', 'dd'],
  [ABILITY_TYPE.DRAGON_HASTE]: ['dragon haste', 'dragonhaste', 'dragon_haste', 'dhaste', 'dh'],
  [ABILITY_TYPE.SKILL_HASTE]: [
    'skill haste',
    'skillhaste',
    'skill_haste',
    'shaste',
    'skhaste',
    'sh',
  ],
  [ABILITY_TYPE.SKILL_PREP]: ['skill prep', 'skillprep', 'skill_prep', 'prep', 'skprep', 'sp', 'p'],
  [ABILITY_TYPE.DEFENSE]: ['defense', 'def', 'd'],
  [ABILITY_TYPE.CRITICAL_DAMAGE]: [
    'critical damage',
    'criticaldamage',
    'critical_damage',
    'crit_dam',
    'critdam',
    'cdam',
    'cd',
  ],
  [ABILITY_TYPE.RECOVERY_POTENCY]: [
    'recovery potency',
    'recoverypotency',
    'recovery_potency',
    'recovery',
    'potency',
    'rec',
    'recpot',
    'r',
  ],
  [ABILITY_TYPE.DRAGON_TIME]: ['dragon time', 'dragontime', 'dragon_time', 'time', 'dtime', 'dt'],
  [ABILITY_TYPE.STEADY_HITTER]: ['steady hitter', 'steadyhitter', 'steady_hitter', 'steady', 'sth'],
  [ABILITY_TYPE.EASY_HITTER]: ['easy hitter', 'easyhitter', 'easy_hitter', 'easy', 'eh'],
  [ABILITY_TYPE.LUCKY_HITTER]: ['lucky hitter', 'luckyhitter', 'lucky_hitter', 'lucky', 'luck', 'lh'],
  [ABILITY_TYPE.HASTY_HITTER]: ['hasty hitter', 'hastyhitter', 'hasty_hitter', 'hasty', 'hh'],
};

function isHitterAbility(type) {
  return [
      ABILITY_TYPE.STEADY_HITTER,
      ABILITY_TYPE.EASY_HITTER,
      ABILITY_TYPE.LUCKY_HITTER,
      ABILITY_TYPE.HASTY_HITTER,
    ].includes(type);
}

function effectiveTypes(hitterAbility) {
  switch (hitterAbility) {
    case ABILITY_TYPE.STEADY_HITTER:
      return [ABILITY_TYPE.SKILL_DAMAGE, ABILITY_TYPE.CRITICAL_DAMAGE];
    case ABILITY_TYPE.EASY_HITTER:
      return [ABILITY_TYPE.STRENGTH, ABILITY_TYPE.FORCE_STRIKE];
    case ABILITY_TYPE.LUCKY_HITTER:
      return [ABILITY_TYPE.CRITICAL_RATE, ABILITY_TYPE.DRAGON_DAMAGE];
    case ABILITY_TYPE.HASTY_HITTER:
      return [ABILITY_TYPE.SKILL_HASTE, ABILITY_TYPE.SKILL_DAMAGE];
  }
}

function getValueForTradeoff(hitterAbility, ability) {
  switch (hitterAbility) {
    case ABILITY_TYPE.STEADY_HITTER:
      switch (ability) {
        case ABILITY_TYPE.SKILL_DAMAGE:
          return 40;
        case ABILITY_TYPE.CRITICAL_DAMAGE:
          return -25;
      }
    case ABILITY_TYPE.EASY_HITTER:
      switch (ability) {
        case ABILITY_TYPE.STRENGTH:
          return 20;
        case ABILITY_TYPE.FORCE_STRIKE:
          return -50;
      }
    case ABILITY_TYPE.LUCKY_HITTER:
      switch (ability) {
        case ABILITY_TYPE.CRITICAL_RATE:
          return 15;
        case ABILITY_TYPE.DRAGON_DAMAGE:
          return -18;
      }
    case ABILITY_TYPE.HASTY_HITTER:
      switch (ability) {
        case ABILITY_TYPE.SKILL_HASTE:
          return 15;
        case ABILITY_TYPE.SKILL_DAMAGE:
          return -40;
      }
  }
  return 0;
};

function effectiveValue(print, ability) {
  var value = 0;
  const type1 = print.ability1_type;
  const type2 = print.ability2_type;
  if (type1 === ability) {
    value = print.ability1_value;
  }
  if (type2 === ability) {
    value = print.ability2_value;
  } else if (isHitterAbility(type2)) {
    value += getValueForTradeoff(type2, ability)
  }
  return value;
}

function parseAbility(str, index) {
  var [typeStr, valueStr] = str.toLowerCase().split(' ');
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

function formatAbility(element, weapon, type, value, isCompatible = true) {
  const prefix = [element, weapon].filter(Boolean).length === 0
    ? ''
    : `(${[element, weapon].filter(Boolean).join(' & ')})`;
  const base = `${prefix} ${type} `;
  const ret = isHitterAbility(type)
    ? base + 'I'
    : base + `+${value}%`;
  return isCompatible ? ret : `*~~${ret}~~*`;
}

function isAbilityCompatible(abilityElement, abilityWeapon, adventurerElement, adventurerWeapon) {
  if (adventurerElement == null || adventurerWeapon == null) {
    return true;
  }
  if (abilityElement !== adventurerElement) {
    return false;
  } else if (abilityWeapon == null) {
    return true;
  } else if (abilityWeapon !== adventurerWeapon) {
    return false;
  }
}

function formatPrint(print, sortBy, element, weapon, adventurer) {
  var ability2Str = '';
  if (print.ability2_type != null) {
    const base = formatAbility(
      print.ability2_element,
      print.ability2_weapon,
      print.ability2_type,
      print.ability2_value,
      isAbilityCompatible(
        print.ability2_element,
        print.ability2_weapon,
        element,
        weapon,
      ),
    );
    ability2Str = ' / ' + base;
  }
  const ability1Str = formatAbility(
    print.ability1_element,
    print.ability1_weapon,
    print.ability1_type,
    print.ability1_value,
    isAbilityCompatible(
      print.ability1_element,
      print.ability1_weapon,
      element,
      weapon,
    ),
  );
  if (sortBy === SORTING_OPTIONS.ADVENTURER) {
    return `ID ${print.id}: ${ability1Str}${ability2Str}`;
  }
  return `${ability1Str}${ability2Str} (ID ${print.id}, ${adventurer})`;
}

async function genPrintsFieldForElementWeapon(interaction, elementWeapon) {
  const userID = interaction.user.id;
  var {element, weapon} = elementWeapon;
  element = capitalize(element);
  weapon = capitalize(weapon);
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
        ability2_weapon = ${weapon}
        OR ability2_weapon IS NULL
      )
    )
  `;
  return (prints.length === 0)
    ? null
    : fieldifyPrints(prints, SORTING_OPTIONS.ABILITY, element, weapon);
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
      const [ability1, ability2] = print.split(',').map((ability, index) => parseAbility(ability.replaceAll(' ', ''), index));
      if (ability1.error != null || ability2.error != null) {
        return [ability1?.error, ability2?.error].filter(Boolean).join('; ') + ` ("*${print.trim()}*")`;
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

const SORTING_OPTIONS = {
  ABILITY: 'ability',
  ADVENTURER: 'adventurer',
};

function fieldifyPrints(prints, sortBy = SORTING_OPTIONS.ADVENTURER, element = null, weapon = null) {
  const map = {};
  if (sortBy === SORTING_OPTIONS.ADVENTURER) {
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
        value: prints.map(print => formatPrint(print, sortBy, element, weapon, adventurer)).join('\n'),
      };
    });
  }
  prints.forEach(print => {
    const type1 = print.ability1_type;
    const type2 = print.ability2_type;
    if (type1 !== null) {
      if (map[type1] == null) {
        map[type1] = [];
      }
      map[type1].push({
        print,
        effectiveValue: effectiveValue(print, type1),
      });
      if (type2 !== null) {
        var types = [type2];
        if (isHitterAbility(type2)) {
          types = effectiveTypes(type2)
        }
        types.forEach(type => {
          if (map[type] == null) {
            map[type] = [];
          }
          map[type].push({
            print,
            effectiveValue: effectiveValue(print, type),
          });
        });
      }
    }
  });
  const fields = [];
  Object.keys(map).forEach(type => {
    const prints = map[type].sort((a, b) => a.effectiveValue - b.effectiveValue);
    var value = '';
    const printStrs = prints.map(print => formatPrint(print, sortBy, element, weapon, print.adventurer));
    var counter = -1;
    while (printStrs.length > 0) {
      const next = printStrs.shift();
      while ((value.length + next.length + 1) < MAX_LENGTH) {
        value += next + '\n';
      }
      counter++;
      const pageStr = counter > 0
        ? ` (${counter})`
        : '';
      fields.push({
        name: type + pageStr,
        value: value.trim(),
      });
    }
  });
  return fields;
}

function chunkifyFields(fields) {
  if (fields == null || fields.length === 0) {
    return null;
  }
  const chunks = [];
  while (fields.length > 0) {
    const currentChunk = [];
    const length = 0;
    const next = fields.shift();
    while (length + next.value.length < MAX_FIELD_LENGTH_SUM) {
      currentChunk.push(next);
    }
    chunks.push(currentChunk);
  }
  return chunks;
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
                .setDescription('The search query, single name, fuzzy match')
                .setRequired(true))
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
        .addIntegerOption(option =>
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
        await interaction.editReply({embeds: [successEmbed]});
        if (errorEmbed != null) {
          await interaction.followUp({embeds: [errorEmbed]});
        }
      } else if (errorEmbed != null) {
        await interaction.editReply({embeds: [errorEmbed]});
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
      await logCommand(interaction, 'prints delete', ids);
      const removed = await sql`
        WITH rows AS (
          DELETE FROM prints
          WHERE userid = ${interaction.user.id} AND id = ANY(${sql.array(ids)})
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
        var baseTitle = '';
        var printsField;
        var element = '';
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
            element = nameElementWeapon.element;
            printsField = await genPrintsFieldForElementWeapon(interaction, nameElementWeapon);
            baseTitle = `Prints suitable for ${nameElementWeapon.name} (${nameElementWeapon.element} ${nameElementWeapon.weapon})`;
            break;
          }
          case PRINTS_SUBCOMMANDS.ELEMENT:
            element = interaction.options.getString('element');
            const weapon = interaction.options.getString('weapon');
            await logCommand(interaction, 'prints for element', element + (weapon != null ? ` ${weapon}` : ''));
            printsField = await genPrintsFieldForElementWeapon(interaction, {element, weapon});
            baseTitle = `Prints suitable for ${capitalize(element)} ${capitalize(pluralize(weapon)) ?? ''}`;
            break;
        }
        const chunkified = chunkifyFields(printsField);
        const editEmbed = {
          "type": "rich",
          "title": baseTitle,
          "fields": chunkified != null ? chunkified.pop() : null,
          "description": chunkified != null ? 'No prints found' : null,
          "color": COLORS[element.toUpperCase()],
        }
        await interaction.editReply({embeds: [editEmbed]}).catch(onRejected => console.error(onRejected));
        var counter = 2;
        while (chunkified.length > 0) {
          const embed = {
            "type": "rich",
            "title": baseTitle + ` (${counter})`,
            "fields": chunkified.pop(),
            "color": COLORS[element.toUpperCase()],
          }
          counter++;
          await interaction.followUp({embeds: [embed]}).catch(onRejected => console.error(onRejected));
        }
      }
    }
  }
}

module.exports = {
  printsCommand,
  ABILITY_NAMES,
}