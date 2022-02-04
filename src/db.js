// db.js
const {REST} = require('@discordjs/rest')
const {Routes} = require('discord-api-types/v9')
const postgres = require('postgres');
const {allAdventurers, dragonDrive, uniqueDragon, threeStars, fourStars, limited} = require('./adventurers');
const {
  ALL_WEAPONS,
  ALL_RARITIES,
  ALL_BOOLEAN_OPTIONS
} = require('./consts');

const sql = postgres() // will default to the same as psql

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
        unique_shapeshift boolean
      );
    `,
  ]);

  await Promise.all(
    allAdventurers.map(adventurer => {
      const {id, name, element, weapon, rarity, uniqueDragon, dragonDrive, limited} = adventurer;
      return sql`
        INSERT INTO adventurers(id, name, element, weapon, rarity, limited, dragondrive, unique_shapeshift)
        VALUES(
          ${id},
          ${name},
          ${element},
          ${weapon},
          ${rarity ?? 5},
          ${limited ?? false},
          ${dragonDrive ?? false},
          ${uniqueDragon ?? false}
        )
      `;
    }),
  );
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
  console.log(blocked);
  const [numBlocked] = await sql`
    SELECT COUNT(*)
    FROM blocked
    WHERE userID = ${userID}
  `
  console.log(numBlocked);
  return interaction.reply({
    content: `Added ${name} to your blocklist (${numBlocked.count} blocked)`,
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
  console.log(completed);
  const [numCompleted] = await sql`
    SELECT COUNT(*)
    FROM completed
    WHERE userID = ${userID}
  `
  console.log(numCompleted);
  return interaction.reply({
    content: `Marked ${name} as completed (${numCompleted.count} completed)`,
    ephemeral: true,
  });
}

function getSearchQuery(interaction, addWildcards = false) {
  return interaction.options.getString('query').split(',').map(entry => {
    const trimmed = entry.toLowerCase().trim();
    return addWildcards ? `%${trimmed}%` : trimmed;
  });
}

async function search(interaction) {
  return await sql`
    SELECT CONCAT(id, ', ', rarity, ', ', name, ', ', element, ', ', weapon)
    FROM adventurers
    WHERE name ILIKE ANY(ARRAY[${getSearchQuery(interaction, true)}])
  `;
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
  return interaction.reply({
    content: `Cleared your completed list (${removed.count} removed)`,
    ephemeral: true
  });
}

async function batchAddCompleted(interaction) {
  const userID = interaction.user.id;
  const [added] = await sql`
    WITH rows AS (
      INSERT INTO completed(userid, name, element, weapon)
      SELECT ${userID}, name, element, weapon FROM adventurers
      WHERE LOWER(name) = ANY(ARRAY[${getSearchQuery(interaction)}])
      ON CONFLICT(userid, name, element, weapon)
      DO NOTHING
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
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
  const [removed] = await sql`
    WITH rows AS (
      DELETE FROM completed
      WHERE (userid, name, element, weapon) in (
        SELECT ${userID}, name, element, weapon FROM adventurers
        WHERE LOWER(name) = ANY(ARRAY[${getSearchQuery(interaction)}])
      )
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
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
  return interaction.reply({
    content: `Cleared your blocklist (${removed.count} removed)`,
    ephemeral: true
  });
}

async function batchAddBlocked(interaction) {
  const userID = interaction.user.id;
  const [added] = await sql`
    WITH rows AS (
      INSERT INTO blocked(userid, name, element, weapon)
      SELECT ${userID}, name, element, weapon FROM adventurers
      WHERE LOWER(name) = ANY(ARRAY[${getSearchQuery(interaction)}])
      ON CONFLICT(userid, name, element, weapon)
      DO NOTHING
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
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
  const [removed] = await sql`
    WITH rows AS (
      DELETE FROM blocked
      WHERE (userid, name, element, weapon) in (
        SELECT ${userID}, name, element, weapon FROM adventurers
        WHERE LOWER(name) = ANY(ARRAY[${getSearchQuery(interaction)}])
      )
      RETURNING *
    )
    SELECT COUNT(*) FROM rows
  `;
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
    const guildMember = await rest.get(Routes.guildMember(guildID, id));
    const nickname = guildMember?.nick;
    if (nickname != null) {
      return nickname;
    }
  }
  const user = await rest.get(Routes.user(id));
  return user.username;
}

async function leaderboard(interaction) {
  const leaderboard = await sql`
    SELECT COUNT(*), userid FROM completed
    GROUP BY userid
    ORDER BY 1 DESC
  `;
  console.log(leaderboard);

  const results = await Promise.all(leaderboard.map(async entry => {
    const {count, userid} = entry;
    const username = await fetchUser(interaction, userid);
    if (username == null) {
      return null;
    }
    return {count, username};
  }));
  return results.filter(Boolean);
}

module.exports = {
  sql,
  getQuery,
  setupTables,
  markCompleted,
  addToBlocklist,
  search,
  batchAddCompleted,
  batchAddBlocked,
  batchRemoveCompleted,
  batchRemoveBlocked,
  clearCompleted,
  clearBlocked,
  leaderboard,
}