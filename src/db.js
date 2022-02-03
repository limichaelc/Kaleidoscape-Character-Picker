// db.js
const postgres = require('postgres')
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
    SELECT * FROM (
      SELECT CONCAT(name, ', ', element, ', ', weapon)
      FROM adventurers
      WHERE (${vars.element} = '' OR element ILIKE ${vars.element})
      AND weapon ILIKE ANY(ARRAY[${vars.weapons}])
      AND rarity = ANY(ARRAY[${vars.rarities}])
      AND limited = ANY(ARRAY[${vars.isLimited}])
      AND dragondrive = ANY(ARRAY[${vars.isDragonDrive}])
      AND unique_shapeshift = ANY(ARRAY[${vars.hasUniqueDragon}])
      EXCEPT
      SELECT CONCAT(name, ', ', element, ', ', weapon)
      FROM blocked
      WHERE userid = ${interaction.user.id}
      EXCEPT
      SELECT CONCAT(name, ', ', element, ', ', weapon)
      FROM completed
      WHERE userid = (
        CASE
          WHEN ${allowCompleted} THEN NULL
          ELSE ${interaction.user.id}
        END
      )
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
        name text PRIMARY KEY,
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
      const [name, element, weapon] = adventurer.split(', ');
      const rarity = threeStars.includes(adventurer)
        ? 3
        : fourStars.includes(adventurer)
        ? 4
        : 5;
      return sql`
        INSERT INTO adventurers(name, element, weapon, rarity, limited, dragondrive, unique_shapeshift)
        VALUES(
          ${name},
          ${element},
          ${weapon},
          ${rarity},
          ${limited.includes(adventurer)},
          ${dragonDrive.includes(adventurer)},
          ${uniqueDragon.includes(adventurer)}
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
  return interaction.reply(`Added ${name} to your blocklist (${numBlocked.count} blocked)`);
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
  return interaction.reply(`Marked ${name} as completed (${numCompleted.count} completed)`);
}

function getSearchQuery(interaction, addWildcards = false) {
  return interaction.options.getString('query').split(',').map(entry => {
    const trimmed = entry.toLowerCase().trim();
    return addWildcards ? `%${trimmed}%` : trimmed;
  });
}
async function search(interaction) {
  return await sql`
    SELECT CONCAT(name, ', ', element, ', ', weapon) FROM adventurers
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
  return interaction.reply(`Cleared your completed list (${removed.count} removed)`);
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
  return interaction.reply(`Marked ${added.count} new adventurers as complete (${numCompleted.count} completed total)`);
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
  return interaction.reply(`Removed ${removed.count} adventurers from completed list (${numCompleted.count} completed total)`);
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
  return interaction.reply(`Cleared your blocklist (${removed.count} removed)`);
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
  return interaction.reply(`Blocked ${added.count} new adventurers (${numBlocked.count} blocked total)`);
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
  return interaction.reply(`Removed ${removed.count} adventurers from block list (${numBlocked.count} blocked total)`);
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
}