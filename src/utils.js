const {ALL_WEAPONS} = require('./consts');

const allWeaponOptions = option =>
  option.setName('weapon')
    .setDescription('Specify the character weapon type')
    .setRequired(false)
    .addChoices(ALL_WEAPONS.map(weapon => [weapon, weapon]));

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

module.exports = {
  allWeaponOptions,
  capitalize,
  pluralize,
  formatPercentage,
  formatCounts,
}