// 'use strict';

const {REST} = require('@discordjs/rest')
const {Routes} = require('discord-api-types/v9')
const postgres = require('postgres');
const {allAdventurers, dragonDrive, uniqueDragon, threeStars, fourStars, limited} = require('./adventurers');
const {
  ALL_WEAPONS,
  ALL_RARITIES,
  ALL_BOOLEAN_OPTIONS,
  ACTION_TYPE,
  PAGE_SIZE,
  ORDERINGS,
} = require('./consts');

const sql = postgres(process.env.DATABASE_URL, {ssl: true}); // will default to the same as psql

function getQuery(
  interaction,
  varOverrides,
) {
  const vars = Object.assign(
    {
      element: '',
      weapons: ALL_WEAPONS,
      rarities: ALL_RARITIES,
      isLimited: ALL_BOOLEAN_OPTIONS,
      isDragonDrive: ALL_BOOLEAN_OPTIONS,
      hasUniqueDragon: ALL_BOOLEAN_OPTIONS,
      limit: 1,
    },
    varOverrides,
  )
  const allowCompleted = interaction.options.getBoolean('allow_completed') ?? false;
  return sql`
    WITH exclude AS (
      SELECT CONCAT(name, ', ', element, ', ', weapon)
      FROM blocked
      WHERE userid = ${interaction.user.id}
      UNION ALL
      SELECT CONCAT(name, ', ', element, ', ', weapon)
      FROM completed
      WHERE userid = (
        CASE
          WHEN ${allowCompleted} THEN NULL
          ELSE ${interaction.user.id}
        END
      )
    )
    SELECT * FROM (
      SELECT CONCAT(id, ', ', rarity, ', ', name, ', ', element, ', ', weapon)
      FROM adventurers
      WHERE (${vars.element} = '' OR element ILIKE ${vars.element})
      AND weapon ILIKE ANY(ARRAY[${vars.weapons}])
      AND rarity = ANY(ARRAY[${vars.rarities}])
      AND limited = ANY(ARRAY[${vars.isLimited}])
      AND dragondrive = ANY(ARRAY[${vars.isDragonDrive}])
      AND unique_shapeshift = ANY(ARRAY[${vars.hasUniqueDragon}])
      AND CONCAT(name, ', ', element, ', ', weapon) NOT IN (SELECT * FROM exclude)
    ) t
      ORDER BY random() LIMIT ${vars.limit}
  `;
}

async function setupTables() {
  await Promise.all([
    sql`
      CREATE TABLE IF NOT EXISTS completed(
        userid text,
        name text,
        element text,
        weapon text,
        PRIMARY KEY (userid, name, element, weapon)
      );
    `,
    sql`
      CREATE TABLE IF NOT EXISTS blocked(
        userid text,
        name text,
        element text,
        weapon text,
        PRIMARY KEY (userid, name, element, weapon)
      );
    `,
    sql`
      CREATE TABLE IF NOT EXISTS adventurers(
        id text PRIMARY KEY,
        name text,
        element text,
        weapon text,
        rarity int,
        limited boolean,
        dragondrive boolean,
        unique_shapeshift boolean,
        aliases text
      );
    `,
    sql`
      CREATE TABLE IF NOT EXISTS logging(
        id serial PRIMARY KEY,
        timestamp timestamp,
        guildName text,
        userid text,
        command text,
        options text
      );
    `,
    sql`
      CREATE TABLE IF NOT EXISTS users(
        userid text PRIMARY KEY,
        username text
      );
    `,
  ]);
  try {
    await Promise.all(
      allAdventurers.map(adventurer => {
        const {id, name, element, weapon, rarity, limited, dragonDrive, uniqueDragon, aliases} = adventurer;
        return sql`
          INSERT INTO adventurers(id, name, element, weapon, rarity, limited, dragondrive, unique_shapeshift, aliases)
          VALUES(
            ${id},
            ${name},
            ${element},
            ${weapon},
            ${rarity ?? 5},
            ${limited ?? false},
            ${dragonDrive ?? false},
            ${uniqueDragon ?? false},
            ${aliases}
          )
        `;
      }),
    );
  } catch (error) {
    console.log(error);
  }
}

async function logCommand(interaction, command, options = '') {
  const userID = interaction.user.id;
  const username = interaction.user.username;
  const guildName = interaction.guild?.name;
  const allowCompleted = interaction.options?.getBoolean('allow_completed');
  const allowBlocked = interaction.options?.getBoolean('allow_blocked');
  const page = interaction.options?.getInteger('page');
  if (options === null) {
    options = '';
  }
  const additionalOptions = [allowCompleted, allowBlocked, page].filter(Boolean);
  const additionalOptionsString = additionalOptions.length > 0 ? (' ' + additionalOptions.join(' ')) : '';

  await sql`
    INSERT INTO logging(timestamp, guildName, userid, command, options)
    VALUES(NOW(), ${guildName}, ${userID}, ${command}, ${options + (additionalOptionsString)})
  `;
  await sql`
    INSERT INTO users(userid, username)
    VALUES(${userID}, ${username})
    ON CONFLICT(userid)
    DO NOTHING
  `;
}

async function addToBlocklist(interaction, adventurer) {
  const userID = interaction.user.id;
  const [name, element, weapon] = adventurer.split(', ');
  const [blocked] = await sql`
    INSERT INTO blocked(userid, name, element, weapon)
    VALUES(${userID}, ${name}, ${element}, ${weapon})
    ON CONFLICT(userid, name, element, weapon)
    DO NOTHING
  `
  await logCommand(interaction, ACTION_TYPE.BLOCK, adventurer);
  const [numBlocked] = await sql`
    SELECT COUNT(*)
    FROM blocked
    WHERE userID = ${userID}
  `
  return interaction.reply({
    content: `Added ${name} to your blocklist (${numBlocked.count} blocked)`,
    ephemeral: true,
  });
}

async function removeFromBlocklist(interaction, adventurer) {
  const userID = interaction.user.id;
  const [name, element, weapon] = adventurer.split(', ');
  const [unblocked] = await sql`
    DELETE FROM blocked
    WHERE userid = ${userID} AND name = ${name} AND element = ${element} AND weapon = ${weapon}
  `
  await logCommand(interaction, ACTION_TYPE.UNBLOCK, adventurer);
  const [numBlocked] = await sql`
    SELECT COUNT(*)
    FROM blocked
    WHERE userID = ${userID}
  `
  return interaction.reply({
    content: `Removed ${name} from your blocklist (${numBlocked.count} blocked)`,
    ephemeral: true,
  });
}

async function markCompleted(interaction, adventurer) {
  const userID = interaction.user.id;
  const [name, element, weapon] = adventurer.split(', ');
  const [completed] = await sql`
    INSERT INTO completed(userid, name, element, weapon)
    VALUES(${userID}, ${name}, ${element}, ${weapon})
    ON CONFLICT(userid, name, element, weapon)
    DO NOTHING
  `
  await logCommand(interaction, ACTION_TYPE.COMPLETE, adventurer);
  const [numCompleted] = await sql`
    SELECT COUNT(*)
    FROM completed
    WHERE userID = ${userID}
  `
  return interaction.reply({
    content: `Marked ${name} as completed (${numCompleted.count} completed)`,
    ephemeral: true,
  });
}

async function markIncomplete(interaction, adventurer) {
  const userID = interaction.user.id;
  const [name, element, weapon] = adventurer.split(', ');
  const [completed] = await sql`
    DELETE FROM completed
    WHERE userid = ${userID} AND name = ${name} AND element = ${element} AND weapon = ${weapon}
  `
  await logCommand(interaction, ACTION_TYPE.INCOMPLETE, adventurer);
  const [numCompleted] = await sql`
    SELECT COUNT(*)
    FROM completed
    WHERE userID = ${userID}
  `
  return interaction.reply({
    content: `Marked ${name} as incomplete (${numCompleted.count} completed)`,
    ephemeral: true,
  });
}

async function findCompleters(interaction, adventurer, thumbnailUrl) {
  const completers = await sql`
    SELECT userid
    FROM completed
    WHERE name = ${adventurer}
  `;
  await logCommand(interaction, ACTION_TYPE.COMPLETERS, adventurer);
  const names = await Promise.all(completers.map(async completer => await fetchUser(interaction, completer.userid)));
  const embed = {
    'type': 'rich',
    'title': adventurer,
    'fields': [
        {
          'name': `Completed by:`,
          'value': names.join('\n'),
        }
      ],
    'thumbnail': {
      'url': thumbnailUrl,
      'height': 0,
      'width': 0
    },
    'url': `https://dragalialost.wiki/index.php?title=Special:Search&search=${encodeURIComponent(adventurer)}`,
  };
  return interaction.reply({embeds: [embed]});
}

function getSearchQueryRaw(query, addWildcards = false) {
  return query.split(',').map(entry => {
    const trimmed = entry.toLowerCase().trim();
    return addWildcards ? `%${trimmed}%` : trimmed;
  });
}

function getSearchQuery(interaction, addWildcards = false) {
  return getSearchQueryRaw(interaction.options.getString('query'), addWildcards);
}

async function searchRaw(query) {
  return await sql`
    SELECT CONCAT(id, ', ', rarity, ', ', name, ', ', element, ', ', weapon)
    FROM adventurers
    WHERE name ILIKE ANY(ARRAY[${query}]) OR aliases ILIKE ANY(ARRAY[${query}])
  `;
}

async function search(interaction) {
  const query = getSearchQuery(interaction, true)
  await logCommand(interaction, 'search', query);
  return await searchRaw(query);
}

async function clearCompleted(interaction) {
  const userID = interaction.user.id;
  const [removed] = await sql`
    WITH rows AS (
      DELETE FROM completed
      WHERE userid = ${userID}
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
  await logCommand(interaction, 'manage completed clear');
  return interaction.reply({
    content: `Cleared your completed list (${removed.count} removed)`,
    ephemeral: true
  });
}

async function batchAddCompleted(interaction) {
  const userID = interaction.user.id;
  const query = getSearchQuery(interaction);
  const [added] = await sql`
    WITH rows AS (
      INSERT INTO completed(userid, name, element, weapon)
      SELECT ${userID}, name, element, weapon FROM adventurers
      WHERE LOWER(name) = ANY(ARRAY[${query}])
      ON CONFLICT(userid, name, element, weapon)
      DO NOTHING
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
  await logCommand(interaction, 'manage completed add', query);
  const [numCompleted] = await sql`
    SELECT COUNT(*)
    FROM completed
    WHERE userID = ${userID}
  `;
  return interaction.reply({
    content: `Marked ${added.count} new adventurers as complete (${numCompleted.count} completed total)`,
    ephemeral: true
  });
}

async function batchRemoveCompleted(interaction) {
  const userID = interaction.user.id;
  const query = getSearchQuery(interaction);
  const [removed] = await sql`
    WITH rows AS (
      DELETE FROM completed
      WHERE (userid, name, element, weapon) in (
        SELECT ${userID}, name, element, weapon FROM adventurers
        WHERE LOWER(name) = ANY(ARRAY[${query}])
      )
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
  await logCommand(interaction, 'manage completed remove', query);
  const [numCompleted] = await sql`
    SELECT COUNT(*)
    FROM completed
    WHERE userID = ${userID}
  `;
  return interaction.reply({
    content: `Removed ${removed.count} adventurers from completed list (${numCompleted.count} completed total)`,
    ephemeral: true
  });
}

async function clearBlocked(interaction) {
  const userID = interaction.user.id;
  const [removed] = await sql`
    WITH rows AS (
      DELETE FROM blocked
      WHERE userid = ${userID}
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
  await logCommand(interaction, 'manage blocked clear');
  return interaction.reply({
    content: `Cleared your blocklist (${removed.count} removed)`,
    ephemeral: true
  });
}

async function batchAddBlocked(interaction) {
  const userID = interaction.user.id;
  const query = getSearchQuery(interaction);
  const [added] = await sql`
    WITH rows AS (
      INSERT INTO blocked(userid, name, element, weapon)
      SELECT ${userID}, name, element, weapon FROM adventurers
      WHERE LOWER(name) = ANY(ARRAY[${query}])
      ON CONFLICT(userid, name, element, weapon)
      DO NOTHING
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
  await logCommand(interaction, 'manage blocked add', query);
  const [numBlocked] = await sql`
    SELECT COUNT(*)
    FROM blocked
    WHERE userID = ${userID}
  `;
  return interaction.reply({
    content: `Blocked ${added.count} new adventurers (${numBlocked.count} blocked total)`,
    ephemeral: true,
  });
}

async function batchRemoveBlocked(interaction) {
  const userID = interaction.user.id;
  const query = getSearchQuery(interaction);
  const [removed] = await sql`
    WITH rows AS (
      DELETE FROM blocked
      WHERE (userid, name, element, weapon) in (
        SELECT ${userID}, name, element, weapon FROM adventurers
        WHERE LOWER(name) = ANY(ARRAY[${query}])
      )
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
  await logCommand(interaction, 'manage blocked add', query);
  const [numBlocked] = await sql`
    SELECT COUNT(*)
    FROM blocked
    WHERE userID = ${userID}
  `;
  return interaction.reply({
    content: `Removed ${removed.count} adventurers from block list (${numBlocked.count} blocked total)`,
    ephemeral: true
  });
}

async function fetchUser(interaction, id) {
  const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);
  const guildID = interaction.guildId;
  if (guildID != null) {
    try {
      const guildMember = await rest.get(Routes.guildMember(guildID, id));
      const nickname = guildMember?.nick;
      if (nickname != null) {
        return nickname;
      }
    } catch (error) {
      console.log(`Could not find guild member ${id} in ${guildID}`);
    }
  }
  try {
    const user = await rest.get(Routes.user(id));
    return user.username;
  } catch (error) {
    console.log(`Could not find user ${id}`);
    return null;
  }
}

async function leaderboard(interaction) {
  const leaderboard = await sql`
    SELECT COUNT(*), userid FROM completed
    GROUP BY userid
    ORDER BY 1 DESC
  `;
  // const users = await sql`
  //   SELECT userid, username FROM users
  // `;
  await logCommand(interaction, 'leaderboard');
  const results = await Promise.all(leaderboard.map(async entry => {
    const {count, userid} = entry;
    // const username = users.find(user => userid == user.userid)?.username;
    const username = await fetchUser(interaction, userid);
    if (username == null) {
      return null;
    }
    return {count, username, isSelf: userid === interaction.user.id};
  }));
  return results.filter(Boolean);
}

function getRelativeTime(d1, d2 = new Date()) {
  const units = {
    year  : 24 * 60 * 60 * 1000 * 365,
    month : 24 * 60 * 60 * 1000 * 365/12,
    day   : 24 * 60 * 60 * 1000,
    hour  : 60 * 60 * 1000,
    minute: 60 * 1000,
    second: 1000
  };
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const elapsed = d1 - d2

  // "Math.abs" accounts for both "past" & "future" scenarios
  for (const u in units)
    if (Math.abs(elapsed) > units[u] || u == 'second')
      return rtf.format(Math.round(elapsed/units[u]), u)
}

async function history(interaction) {
  const history = await sql`
    SELECT timestamp, userid, command, options FROM logging
    WHERE command IN ('complete', 'manage completed add')
    AND timestamp > (now() - INTERVAL '1 day')
    ORDER BY timestamp DESC
  `;

  await logCommand(interaction, 'history');
  const usernameMap = {};
  const adventurersMap = {};
  var results = await Promise.all(history.map(async entry => {
    const {timestamp, userid, command, options} = entry;
    const prefix = getRelativeTime(timestamp);
    var username = usernameMap[userid];
    if (adventurersMap[userid] == null) {
      adventurersMap[userid] = [];
    }
    if (username == null) {
      username = await fetchUser(interaction, userid);
      if (username == null) {
        return null;
      }
      usernameMap[userid] = username;
    }
    var names;
    if (command === 'manage completed add') {
      const query = getSearchQueryRaw(options);
      const adventurers = await searchRaw(query);
      names = adventurers.map(adventurer => {
        const [_id, _rarity, name, _element, _weapon] = adventurer.concat.split(', ');
        return name;
      });
    } else {
      names = [options.split(', ')[0]];
    }
    names = names.filter(name => !adventurersMap[userid].includes(name));
    if (names.length === 0) {
      return null;
    }
    adventurersMap[userid] = adventurersMap[userid].concat(names);
    return {prefix, username, names, userid};
  }));
  results = results.filter(Boolean);
  for (var i = 0; i < results.length - 1; i++) {
    const curr = results[i];
    const next = results[i + 1];
    if (curr.timestamp === next.timestamp && curr.username === next.username) {
      curr.names = curr.names.concat(next.names);
      results[i + 1] = null;
      i++;
    }
  }

  return results.filter(Boolean).map(result => {
    const {prefix, username, names, userid} = result;
    const andStr = names.length > 2 ? ', and ' : ' and ';
    const namesStr = names.length > 1 ? names.slice(0, -1).join(', ') + andStr + names.slice(-1) : names[0];
    return {prefix, username, names: namesStr, isSelf: userid === interaction.user.id};
  });
}

async function popularity(interaction, weapon, element) {
  await logCommand(interaction, 'popularity');
  return await sql`
    SELECT COUNT(*), name FROM completed
    WHERE weapon = (
      CASE
        WHEN ${weapon == null} THEN weapon
        ELSE ${weapon}
      END
    )
    AND WHERE element = (
      CASE
        WHEN ${element == null} THEN element
        ELSE ${element}
      END
    )
    GROUP BY name
    ORDER BY 1 DESC
  `;
}

module.exports = {
  sql,
  getQuery,
  setupTables,
  markCompleted,
  markIncomplete,
  addToBlocklist,
  removeFromBlocklist,
  findCompleters,
  search,
  batchAddCompleted,
  batchAddBlocked,
  batchRemoveCompleted,
  batchRemoveBlocked,
  clearCompleted,
  clearBlocked,
  leaderboard,
  popularity,
  history,
  logCommand,
}