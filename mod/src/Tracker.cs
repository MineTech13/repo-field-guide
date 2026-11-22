using System.Collections.Generic;
using UnityEngine;

namespace RepoFieldGuide.Companion
{
    /// <summary>One monster the local player has met this level.</summary>
    internal sealed class Encounter
    {
        public EnemyParent Parent;
        public string Key;        // localization key, e.g. "ENEMY.BEAMER"
        public string Name;       // enemyName, e.g. "Clown"
        public int Tier;          // 1..3
        public float FirstSeenAt; // seconds since the level started
        public bool OnScreen;     // was on the local player's screen
        public bool SpottedYou;   // its vision triggered on the local player
        public bool Killed;
    }

    /// <summary>
    /// Tracks what the local player has actually encountered. A monster is only
    /// added once it has been on *your* screen or has spotted *you*.
    /// </summary>
    internal sealed class Tracker
    {
        private readonly Dictionary<int, Encounter> encounters = new Dictionary<int, Encounter>();
        private Level lastLevel;
        private int lastLevelsCompleted = -1;
        private float levelStart;
        private float nextScan;

        public IEnumerable<Encounter> Encounters => encounters.Values;
        public float LevelTime => Time.time - levelStart;

        public void Tick()
        {
            var run = RunManager.instance;
            if (run == null) return;

            // New level (or new run): forget the previous level's encounters.
            if (run.levelCurrent != lastLevel || run.levelsCompleted != lastLevelsCompleted)
            {
                lastLevel = run.levelCurrent;
                lastLevelsCompleted = run.levelsCompleted;
                encounters.Clear();
                levelStart = Time.time;
            }

            if (!Plugin.Instance.TrackMonsters.Value || !SemiFunc.RunIsLevel()) return;
            if (Time.time < nextScan) return;
            nextScan = Time.time + 0.2f;

            var director = EnemyDirector.instance;
            if (director == null || director.enemiesSpawned == null) return;

            foreach (var parent in director.enemiesSpawned)
            {
                if (parent == null) continue;
                var enemy = parent.Enemy;
                if (enemy == null) continue;

                bool onScreen = parent.Spawned && enemy.HasOnScreen && enemy.OnScreen != null && enemy.OnScreen.OnScreenLocal;
                if (onScreen) Get(parent).OnScreen = true;

                if (encounters.TryGetValue(parent.GetInstanceID(), out var e))
                {
                    if (enemy.HasHealth && enemy.Health != null && enemy.Health.healthCurrent <= 0) e.Killed = true;
                    else if (parent.Spawned && e.Killed && enemy.HasHealth && enemy.Health != null && enemy.Health.healthCurrent > 0) e.Killed = false;
                }
            }
        }

        /// <summary>Called from the EnemyVision.VisionTrigger patch.</summary>
        public void MarkSpotted(EnemyParent parent)
        {
            if (parent == null || !Plugin.Instance.TrackMonsters.Value) return;
            Get(parent).SpottedYou = true;
        }

        private Encounter Get(EnemyParent parent)
        {
            int id = parent.GetInstanceID();
            if (!encounters.TryGetValue(id, out var e))
            {
                e = new Encounter
                {
                    Parent = parent,
                    Key = parent.enemyNameLocalized != null ? parent.enemyNameLocalized.name : null,
                    Name = parent.enemyName,
                    Tier = TierOf(parent),
                    FirstSeenAt = LevelTime,
                };
                encounters[id] = e;
                Plugin.Log.LogInfo($"Encountered {e.Name} ({e.Key}, tier {e.Tier}).");
            }
            return e;
        }

        private static int TierOf(EnemyParent parent)
        {
            // EnemyParent.Difficulty: Difficulty1 / Difficulty2 / Difficulty3
            var s = parent.difficulty.ToString();
            if (s.EndsWith("3")) return 3;
            if (s.EndsWith("2")) return 2;
            return 1;
        }
    }
}
