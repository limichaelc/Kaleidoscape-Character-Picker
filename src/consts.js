module.exports = {
  ACTION_TYPE: {
    COMPLETE: 'complete',
    BLOCK: 'block',
  },
  ALL_WEAPONS: ['sword', 'blade', 'dagger', 'axe', 'lance', 'wand', 'bow', 'staff', 'manacaster'],
  ALL_ELEMENTS: ['flame', 'water', 'wind', 'light', 'shadow'],
  MELEE_WEAPONS: ['sword', 'blade', 'dagger', 'axe', 'lance'],
  RANGED_WEAPONS: ['wand', 'bow', 'staff', 'manacaster'],
  ALL_RARITIES: [3, 4, 5],
  ALL_BOOLEAN_OPTIONS: [true, false],
  COLORS: {
    FLAME: '#d14038',
    WATER: '#408fd9',
    WIND: '#61d37c',
    LIGHT: '#f5b642',
    SHADOW: '#9a46d6',
  },
  MANAGE_COMMAND_GROUPS: {
    COMPLETED: 'completed',
    BLOCKED: 'blocked',
  },
  MANAGE_SUBCOMMANDS: {
    ADD: 'add',
    REMOVE: 'remove',
    CLEAR: 'clear',
  },
}