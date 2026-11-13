# Permanent save contract

Storage key: `samurexile-save`. Schema version: **1**. Level IDs are permanent, one-based integers from 1 through 500. Never rename the storage key, shift existing level IDs or reuse fields for different meanings during a content update.

```json
{
  "schemaVersion": 1,
  "currentLevel": 4,
  "highestUnlockedLevel": 4,
  "completed": false,
  "ultimateUnlocked": true,
  "seenCutscenes": [3]
}
```

New features add optional fields with safe defaults. Unknown fields are retained when reading and saving. A newer unsupported schema must not be overwritten. A migration must retain the source record and preserve progress. `samurexile-v2.chapter` and `shadow-exile-save-v1.stage` are zero-based; add one to migrate their checkpoint. Legacy completion also unlocks Moonfall.

The previous stable record is copied to `samurexile-save-backup` before writing. Portable exports use this same JSON object. Imports validate schema and level bounds, then require confirmation before replacing the checkpoint. Current level may be lower than highest unlocked level after replay. Completing a level saves the next checkpoint; completing level 500 marks the campaign complete.

A browser that blocks storage can play, but cannot persist locally. Export is the backup route. Clearing browser data or moving to another origin is outside the guarantees of the format.
