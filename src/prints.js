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
  [ABILITY_TYPE.SKILL_DAMAGE]: ['skill damage', 'skilldamage', 'skill_damage', 'skdam', 'skdmg', 'sd'],
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
  [ABILITY_TYPE.DRAGON_DAMAGE]: ['dragon damage', 'dragondamage', 'dragon_damage', 'ddamage', 'ddam', 'ddmg', 'dd'],
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
    'cdmg',
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

function effectiveTypesForHitter(hitterAbility) {
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

function expandedTypes(ability) {
  if (ability == null) {
    return [];
  }
  switch (ability) {
    case ABILITY_TYPE.SKILL_DAMAGE:
    case ABILITY_TYPE.CRITICAL_DAMAGE:
      return [ability, ABILITY_TYPE.STEADY_HITTER];
    case ABILITY_TYPE.STRENGTH:
    case ABILITY_TYPE.FORCE_STRIKE:
      return [ability, ABILITY_TYPE.EASY_HITTER];
    case ABILITY_TYPE.CRITICAL_RATE:
    case ABILITY_TYPE.DRAGON_DAMAGE:
      return [ability, ABILITY_TYPE.LUCKY_HITTER];
    case ABILITY_TYPE.SKILL_HASTE:
    case ABILITY_TYPE.SKILL_DAMAGE:
      return [ability, ABILITY_TYPE.HASTY_HITTER];
    default:
      return [ability];
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

function effectiveValue(print, ability, element, weapon) {
  if (ability == null) {
    return 0;
  }
  var value = 0;
  const type1 = print.ability1_type;
  const element1 = print.ability1_element ?? element;
  const weapon1 = print.ability1_weapon ?? weapon;
  const type2 = print.ability2_type;
  const element2 = print.ability2_element ?? element;
  const weapon2 = print.ability2_weapon ?? weapon;

  if (type1 === ability && element1 === element && weapon1 === weapon) {
    value = print.ability1_value;
  }
  if (element2 === element && weapon2 === weapon) {
    if (type2 === ability) {
      value = print.ability2_value;
    } else if (isHitterAbility(type2)) {
      value += getValueForTradeoff(type2, ability)
    }
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

function formatAbility(element, weapon, type, value, isCompatible = true, shouldPrioritize = false, isNegativeTradeoff = false) {
  const prefix = [element, weapon].filter(Boolean).length === 0
    ? ''
    : `(${[element, weapon].filter(Boolean).join(' & ')})`;
  const base = `${prefix} ${type} `;
  const ret = isHitterAbility(type)
    ? isCompatible && shouldPrioritize
      ? isNegativeTradeoff
        ? `${prefix} ***${type} I***`
        : `${prefix} **${type} I**`
      : `${prefix} ${type} I`
    : isCompatible && shouldPrioritize
      ? `${prefix} ${type} **+${value}%**`
      : `${prefix} ${type} +${value}%`;
  return isCompatible ? ret : `*~~${ret}~~*`;
}

function isAbilityCompatible(abilityElement, abilityWeapon, adventurerElement, adventurerWeapon) {
  // Didn't specify a restriction
  if (adventurerElement == null || adventurerWeapon == null) {
    return true;
  }
  // Ability has no restriction
  if (abilityElement == null && abilityWeapon == null) {
    return true;
  }
  if (abilityElement !== adventurerElement) {
    return false;
  } else if (abilityWeapon == null) {
    return true;
  } else if (abilityWeapon !== adventurerWeapon) {
    return false;
  }
  return true;
}

function formatPrint(print, sortBy, element, weapon, adventurer, typeToPrioritize, title) {
  const type1 = print.ability1_type;
  const type2 = print.ability2_type;
  const type1Compatible = isAbilityCompatible(
    print.ability1_element,
    print.ability1_weapon,
    element,
    weapon,
  );
  const type2Compatible = isAbilityCompatible(
    print.ability2_element,
    print.ability2_weapon,
    element,
    weapon,
  );

  var ability1Str = formatAbility(
    print.ability1_element,
    print.ability1_weapon,
    type1,
    print.ability1_value,
    type1Compatible,
    type1 === typeToPrioritize,
  );
  var ability2Str = '';
  var prioritize2 = false;
  if (type2 != null) {
    const tradeoff = getValueForTradeoff(type2, typeToPrioritize);
    prioritize2 = type1 !== typeToPrioritize && (type2 === typeToPrioritize || tradeoff !== 0) && type2Compatible;
    ability2Str = formatAbility(
      print.ability2_element,
      print.ability2_weapon,
      type2,
      print.ability2_value,
      type2Compatible,
      prioritize2,
      tradeoff < 0,
    );
  }
  const abilityStrs = prioritize2
    ? [ability2Str, ability1Str]
    : [ability1Str, ability2Str];
  if (sortBy === SORTING_OPTIONS.ADVENTURER) {
    return `ID ${print.id}: ${abilityStrs.filter(Boolean).join(' / ')}`;
  }
  return `${abilityStrs.filter(Boolean).join(' / ')} (ID ${print.id}, ${adventurer ?? print.adventurer}${title != null ? `, *${title}*` : ''})`;
}

async function genPrintsFieldForElementWeapon(interaction, elementWeapon, ability, strict) {
  const userID = interaction.user.id;
  var {element, weapon} = elementWeapon;
  element = capitalize(element);
  weapon = capitalize(weapon);
  const abilityFilter = expandedTypes(ability);
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
    AND (
      ability1_type = ANY(ARRAY[${abilityFilter}]::text[])
      OR ability2_type = ANY(ARRAY[${abilityFilter}]::text[])
      OR ${abilityFilter.length === 0}
    )
  `;

  return (prints.length === 0)
    ? null
    : fieldifyPrints(prints, SORTING_OPTIONS.ABILITY, element, weapon, ability, strict);
}

function getRestriction(element, weapon) {
  return element === null
    ? RESTRICTIONS.NONE
    : weapon === null
      ? RESTRICTIONS.ELEMENT
      : RESTRICTIONS.ELEMENT_WEAPON;
}

function comparePrints(a, b) {
  const aType1 = a.ability1_type;
  const aType2 = a.ability2_type;
  const bType1 = b.ability1_type;
  const bType2 = b.ability2_type;
  const aType1Restriction = getRestriction(a.ability1_element, a.ability1_weapon);
  const aType2Restriction = getRestriction(a.ability2_element, a.ability2_weapon);
  const bType1Restriction = getRestriction(b.ability1_element, b.ability1_weapon);
  const bType2Restriction = getRestriction(b.ability2_element, b.ability2_weapon);
  if (aType1 !== bType1 || aType2 !== bType2 || aType1Restriction !== bType1Restriction || aType2Restriction !== bType2Restriction) {
    return null;
  }

  const aValue1 = a.ability1_value;
  const aValue2 = a.ability2_value;
  const bValue1 = b.ability1_value;
  const bValue2 = b.ability2_value;
  if (aValue1 > bValue1 && aValue2 >= bValue2 || aValue1 >= bValue1 && aValue2 > bValue2) {
    return 1;
  } else if (aValue1 < bValue1 && aValue2 <= bValue2 || aValue1 <= bValue1 && aValue2 < bValue2) {
    return -1;
  } else if (aValue1 === bValue1 && aValue2 === bValue2 || aValue1 === bValue1 && aValue2 === bValue2) {
    return 0;
  } else {
    return null;
  }
}

async function genAdventurerData(adventurer) {
  const results = await sql`
    SELECT name, element, weapon, title FROM adventurers
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
  const adventurerData = await genAdventurerData(adventurer);
  if (adventurerData.error != null) {
    return {errors: [adventurerData.error], successes: []};
  }
  const {name, element, weapon} = adventurerData;
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

function fieldifyPrints(prints, sortBy = SORTING_OPTIONS.ADVENTURER, element = null, weapon = null, ability = null, strict = false) {
  var map = {};
  if (sortBy === SORTING_OPTIONS.ADVENTURER) {
    prints.map(print => {
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

  prints.map(print => {
    const type1 = print.ability1_type;
    const type2 = print.ability2_type;
    const compatible2 = isAbilityCompatible(print.ability2_element, print.ability2_weapon, element, weapon);
    if (strict) {
      const compatible1 = isAbilityCompatible(print.ability1_element, print.ability1_weapon, element, weapon);
      if (!(compatible1 && compatible2)) {
        return;
      }
    }
    if (type1 !== null) {
      const value1 = effectiveValue(print, type1, element, weapon);
      const value2 = isHitterAbility(type2) ? 0 : effectiveValue(print, type2, element, weapon);
      if (value1 !== 0) {
        if (map[type1] == null) {
          map[type1] = [];
        }
        map[type1].push({
          print,
          effectiveValue: value1,
          subType: type2 ?? '',
          subTypeEffectiveValue: value2,
          hasCompatibleHitterSubType: isHitterAbility(type2) && compatible2,
        });
      }
      if (type2 !== null) {
        var types = [type2];
        if (isHitterAbility(type2)) {
          types.push(effectiveTypesForHitter(type2));
        }
        types.filter(type => type !== type1).map(type => {
          const typeForMap = type2 === ability
            ? type2
            : type;
          const value = effectiveValue(print, type, element, weapon);
          if (value !== 0 || isHitterAbility(type)) {
            if (map[typeForMap] == null) {
              map[typeForMap] = [];
            }
            map[typeForMap].push({
              print,
              effectiveValue: value,
              subType: type1,
              subTypeEffectiveValue: value1,
              hasCompatibleHitterSubType: false,
              weapon: isHitterAbility(type) ? weapon : null,
            });
          }
        });
      }
    }
  });

  if (ability != null) {
    map = {[ability]: map[ability]};
  }

  const fields = [];
  Object.keys(map).map(type => {
    const printsWithValue = map[type].sort((a, b) => {
      if (a.weapon != null && b.weapon != null) {
        const weaponCmp = a.weapon.localeCompare(b.weapon);
        console.log({weaponCmp, a: a.weapon, b: b.weapon});
        if (weaponCmp !== 0) {
          return weaponCmp;
        }
      }
      const valueCmp = b.effectiveValue - a.effectiveValue;
      if (valueCmp === 0) {
        const subTypeCmp = a.subType.localeCompare(b.subType);
        // TODO check IDs 128 316 257
        // different sub types
        // deprioritize dead abilities
        // If b's subtype has no effective value
        // console.log({
        //   a: formatPrint(a.print),
        //   b: formatPrint(b.print),
        //   aSubTypeEffectiveValue: a.subTypeEffectiveValue,
        //   bSubTypeEffectiveValue: b.subTypeEffectiveValue,
        //   aHasCompatibleHitterSubType: a.hasCompatibleHitterSubType,
        //   bHasCompatibleHitterSubType: b.hasCompatibleHitterSubType,
        //   subTypeCmp,
        // })
        if (b.subTypeEffectiveValue === 0) {
          // ... and a's subtype also has no effective value
          if (a.subTypeEffectiveValue === 0) {
            // ... then if b's effective value is 0 because it has a compatible hitter
            if (b.hasCompatibleHitterSubType) {
              // ... and a's effective value is 0 for the same reason
              if (a.hasCompatibleHitterSubType) {
                return subTypeCmp;
              }
              // else prioritize b
              return 1;
            }
            if (a.hasCompatibleHitterSubType) {
              return -1;
            }
            // defer to strCmp
            return subTypeCmp;
          }
          // otherwise only b is an incompatible hitter, deprioritize
          return -1;
        } else if (a.subTypeEffectiveValue === 0) {
          return 1;
        }
        // same sub type, compare effective value
        if (subTypeCmp === 0) {
          return b.subTypeEffectiveValue - a.subTypeEffectiveValue;
        }
        return subTypeCmp;
      }
      return valueCmp;
    });
    const printStrs = printsWithValue.map(printWithValue =>
      formatPrint(printWithValue.print, sortBy, element, weapon, printWithValue.print.adventurer, type),
    );
    var counter = 0;
    var next = printStrs.shift();
    do {
      var value = '';
      while (next != null && (value.length + next.length + 1) < MAX_LENGTH) {
        value += next + '\n';
        next = printStrs.shift();
      }
      counter++;
      const pageStr = counter > 1
        ? ` (${counter})`
        : '';
      if (value !== '') {
        fields.push({
          name: type + pageStr,
          value: value.trim(),
        });
      }
    } while (printStrs.length > 0)
  });
  return fields;
}

async function chunkifyAndSendFields(interaction, title, fields, color) {
  const chunkified = chunkifyFields(fields);
  const editEmbed = {
    title,
    'fields': chunkified != null ? chunkified.shift() : null,
    'description': chunkified != null ? null : 'No prints found',
    color,
  }
  await interaction.editReply({embeds: [editEmbed]}).catch(onRejected => console.error(onRejected));
  var counter = 2;
  while ((chunkified?.length ?? 0) > 0) {
    const embed = {
      'title': title + ` (${counter})`,
      'fields': chunkified.shift(),
      color,
    }
    counter++;
    await interaction.followUp({embeds: [embed]}).catch(onRejected => console.error(onRejected));
  }
}

function chunkifyFields(fields) {
  if (fields == null || fields.length === 0) {
    return null;
  }

  const chunks = [];
  var next = fields.shift();
  do {
    const currentChunk = [];
    var length = 0;
    while (next != null && (length + next.value.length < MAX_FIELD_LENGTH_SUM)) {
      length += next.value.length;
      currentChunk.push(next);
      next = fields.shift();
    }
    chunks.push(currentChunk);
  } while (fields.length > 0)
  return chunks;
}

async function genHandleWizard(interaction) {
  // await sql`DROP FUNCTION getalldupes(text)`
  await sql`
    CREATE OR REPLACE FUNCTION getAllDupes(text) RETURNS TABLE(
      id int,
      adventurer varchar(255),
      userid varchar(255),
      ability1_type varchar(255),
      ability1_value int,
      ability2_type varchar(255),
      ability2_value int,
      ability1_weapon varchar(255),
      ability1_element varchar(255),
      ability2_weapon varchar(255),
      ability2_element varchar(255),
      basisId int
    ) AS
    $BODY$
    DECLARE
        r prints%rowtype;
    BEGIN
      FOR r IN SELECT * FROM prints
      WHERE prints.userid = $1
      LOOP
        RETURN QUERY VALUES(
          r.id,
          r.adventurer,
          r.userid,
          r.ability1_type,
          r.ability1_value,
          r.ability2_type,
          r.ability2_value,
          r.ability1_weapon,
          r.ability1_element,
          r.ability2_weapon,
          r.ability2_element,
          NULL::int
        );
        RETURN QUERY SELECT
          prints.id,
          prints.adventurer,
          prints.userid,
          prints.ability1_type,
          prints.ability1_value,
          prints.ability2_type,
          prints.ability2_value,
          prints.ability1_weapon,
          prints.ability1_element,
          prints.ability2_weapon,
          prints.ability2_element,
          r.id
        FROM prints
        WHERE prints.ability1_type = r.ability1_type
        AND prints.ability2_type = r.ability2_type
        AND (coalesce(prints.ability1_element, '') = coalesce(r.ability1_element, '') OR coalesce(prints.ability1_element, '') = '')
        AND (coalesce(prints.ability2_element, '') = coalesce(r.ability2_element, '') OR coalesce(prints.ability2_element, '') = '')
        AND (coalesce(prints.ability1_weapon, '') = coalesce(r.ability1_weapon, ''))
        AND (coalesce(prints.ability2_weapon, '') = coalesce(r.ability2_weapon, ''))
        AND coalesce(prints.ability1_value, 0) <= coalesce(r.ability1_value, 0)
        AND coalesce(prints.ability2_value, 0) <= coalesce(r.ability2_value, 0)
        AND prints.id <> r.id
        ORDER BY
          ability1_element,
          ability1_weapon,
          ability1_type,
          ability1_value DESC,
          ability2_element,
          ability2_weapon,
          ability2_type,
          ability2_value DESC;
      END LOOP;
    END
    $BODY$
    LANGUAGE plpgsql;
  `
  const prints = await sql`
    SELECT * FROM getAllDupes(${interaction.user.id});
  `
  const map = {};
  const basisMap = {};
  const replacementCandidates = {};
  prints.map(print => {
    // basis print record
    if (print.basisid == null) {
      // skip if it is already flagged as a candidate for replacement
      // i.e. for A > B > C, skip B as basis
      if (replacementCandidates[print.id]) {
        return;
      }
      basisMap[print.id] = print;
    } else {
      replacementCandidates[print.id] = true;
      if (map[print.basisid] == null) {
        map[print.basisid] = [];
      }
      map[print.basisid].push(print);
    }
  });

  const fields = await Promise.all(Object.keys(map).map(async basisId => {
    if (basisMap[basisId] == null) {
      return null;
    };
    const values = await Promise.all(map[basisId].map(async print => {
      const adventurerData = await genAdventurerData(print.adventurer.toLowerCase());
      return formatPrint(print, null, null, null, null, null, adventurerData.title);
    }));
    return {
      name: formatPrint(basisMap[basisId]),
      value: values.join('\n'),
    };
  }));
  await chunkifyAndSendFields(interaction, `${Object.keys(replacementCandidates).length} prints you can probably delete (identical or outclassed by bolded prints)`, fields.filter(Boolean));
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
  FEATURING: 'featuring',
  WIZARD: 'wizard',
}

const abilityOption = option =>
  option.setName('ability')
    .setDescription('Only find prints that affect this ability, both positively and negatively')
    .addChoices(Object.keys(ABILITY_TYPE).map((key) => {
      const name = ABILITY_TYPE[key];
      return [name, name];
    }));

const strictOption = option =>
  option.setName('strict')
    .setDescription('Whether to only show prints where both effects are compatible. True by default');

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
            .addStringOption(abilityOption)
            .addBooleanOption(strictOption)
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
            .addStringOption(abilityOption)
            .addBooleanOption(strictOption)
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName(PRINTS_SUBCOMMANDS.FEATURING)
        .setDescription('Find prints from your collection featuring the given adventurer as the portrait')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('The search query, single name, fuzzy match')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName(PRINTS_SUBCOMMANDS.WIZARD)
        .setDescription('Find prints from your print collection that are safe to delete')
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
    } else if (subcommand === PRINTS_SUBCOMMANDS.WIZARD) {
      await logCommand(interaction, 'prints wizard');
      await genHandleWizard(interaction);
    } else if (subcommand === PRINTS_SUBCOMMANDS.FEATURING) {
      const query = interaction.options.getString('query');
      await logCommand(interaction, 'prints featuring', query);
      const adventurerData = await genAdventurerData(query);
      if (adventurerData.error != null) {
        return interaction.editReply({
          content: adventurerData.error,
        }).catch(onRejected => console.error(onRejected));
      }
      const {name, element, title} = adventurerData;
      const prints = await sql`
        SELECT * from prints
        WHERE userid = ${interaction.user.id}
        AND adventurer = ${name}
      `;
      const embed = {
        title: `Prints featuring ${name} (${title})`,
        fields: fieldifyPrints(prints),
        color: COLORS[element.toUpperCase()],
      };
      return interaction.editReply({embeds: [embed]}).catch(onRejected => console.error(onRejected));
    } else {
      const group = interaction.options.getSubcommandGroup();
      if (group === PRINTS_COMMAND_GROUPS.FOR) {
        var baseTitle = '';
        var printsField;
        var element = '';
        const ability = interaction.options.getString('ability');
        const strict = interaction.options.getBoolean('strict') ?? true;
        switch (subcommand) {
          case PRINTS_SUBCOMMANDS.ADVENTURER: {
            const query = interaction.options.getString('query');
            await logCommand(interaction, 'prints for adventurer', query);
            const adventurerData = await genAdventurerData(query);
            if (adventurerData.error != null) {
              return interaction.editReply({
                content: adventurerData.error,
              }).catch(onRejected => console.error(onRejected));
            }
            element = adventurerData.element;
            printsField = await genPrintsFieldForElementWeapon(interaction, adventurerData, ability, strict);
            baseTitle = `Prints suitable for ${adventurerData.name} (${adventurerData.element} ${adventurerData.weapon})`;
            break;
          }
          case PRINTS_SUBCOMMANDS.ELEMENT:
            element = interaction.options.getString('element');
            const weapon = interaction.options.getString('weapon');
            await logCommand(interaction, 'prints for element', element + (weapon != null ? ` ${weapon}` : ''));
            printsField = await genPrintsFieldForElementWeapon(interaction, {element, weapon}, ability, strict);
            baseTitle = `Prints suitable for ${capitalize(element)} ${capitalize(pluralize(weapon)) ?? ''}`;
            break;
        }
        await chunkifyAndSendFields(interaction, baseTitle, printsField, COLORS[element.toUpperCase()]);
      }
    }
  }
}

module.exports = {
  printsCommand,
  ABILITY_NAMES,
}