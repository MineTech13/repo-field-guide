using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using UnityEngine;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// GameState v1: the contract shared with the website (src/live/schema.ts).
    /// Only contains what the local player can know.
    /// </summary>
    internal static class Snapshot
    {
        private static readonly FieldInfo[] UpgradeFields = typeof(StatsManager)
            .GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            .Where(f => f.Name.StartsWith("playerUpgrade") && f.FieldType == typeof(Dictionary<string, int>))
            .ToArray();

        public static string BuildJson(Tracker tracker)
        {
            var plugin = Plugin.Instance;
            var state = new Dictionary<string, object>
            {
                ["v"] = 1,
                ["mod"] = Plugin.Version,
                ["phase"] = Phase(),
                ["updatedAt"] = DateTime.UtcNow.ToString("o"),
            };

            var run = RunManager.instance;
            if (run != null)
            {
                state["map"] = run.levelCurrent != null ? run.levelCurrent.NarrativeName : null;
                state["mapAsset"] = run.levelCurrent != null ? run.levelCurrent.name : null;
                state["levelsCompleted"] = run.levelsCompleted;
            }

            var round = RoundDirector.instance;
            if (round != null && SemiFunc.RunIsLevel())
            {
                state["haul"] = new Dictionary<string, object>
                {
                    ["goal"] = round.haulGoal,
                    ["current"] = round.currentHaul,
                    ["extractionPoints"] = round.extractionPoints,
                    ["extractionPointsCompleted"] = round.extractionPointsCompleted,
                };
            }

            try { state["surplusK"] = SemiFunc.StatGetRunCurrency(); } catch { /* not in a run */ }

            if (plugin.TrackMonsters.Value) state["seen"] = Seen(tracker, plugin.ShowRespawnTimers.Value);
            if (plugin.ShopReader.Value && SemiFunc.RunIsShop()) state["shelf"] = Shelf();
            if (plugin.ShopReader.Value) state["players"] = Players(plugin.IncludeTeammates.Value);

            return JsonConvert.SerializeObject(state);
        }

        private static string Phase()
        {
            if (SemiFunc.RunIsShop()) return "shop";
            if (SemiFunc.RunIsArena()) return "arena";
            if (SemiFunc.RunIsLobby()) return "lobby";
            if (SemiFunc.RunIsLevel()) return "level";
            return "menu";
        }

        private static List<object> Seen(Tracker tracker, bool respawn)
        {
            var list = new List<object>();
            foreach (var e in tracker.Encounters.OrderBy(x => x.FirstSeenAt))
            {
                var item = new Dictionary<string, object>
                {
                    ["key"] = e.Key,
                    ["name"] = e.Name,
                    ["tier"] = e.Tier,
                    ["firstSeenAt"] = Math.Round(e.FirstSeenAt, 1),
                    ["onScreen"] = e.OnScreen,
                    ["spottedYou"] = e.SpottedYou,
                    ["killed"] = e.Killed,
                };
                if (respawn && e.Parent != null && !e.Parent.Spawned)
                    item["respawnInSec"] = Math.Round(Mathf.Max(0f, e.Parent.DespawnedTimer), 0);
                list.Add(item);
            }
            return list;
        }

        private static List<object> Shelf()
        {
            var list = new List<object>();
            foreach (var ia in UnityEngine.Object.FindObjectsByType<ItemAttributes>(FindObjectsSortMode.None))
            {
                if (ia == null || !ia.shopItem || ia.item == null) continue;
                list.Add(new Dictionary<string, object>
                {
                    ["item"] = ia.item.name,
                    ["name"] = ia.item.itemName,
                    ["type"] = ia.item.itemType.ToString(),
                    ["priceK"] = ia.value,
                });
            }
            return list;
        }

        private static List<object> Players(bool includeTeammates)
        {
            var list = new List<object>();
            var stats = StatsManager.instance;
            if (stats == null) return list;

            string localId = null;
            try { localId = SemiFunc.PlayerGetSteamID(SemiFunc.PlayerAvatarLocal()); } catch { }

            foreach (var kv in stats.playerNames)
            {
                bool isLocal = kv.Key == localId;
                if (!isLocal && !includeTeammates) continue;
                var upgrades = new Dictionary<string, int>();
                foreach (var f in UpgradeFields)
                {
                    if (f.GetValue(stats) is Dictionary<string, int> d && d.TryGetValue(kv.Key, out var n) && n > 0)
                        upgrades[f.Name.Substring("playerUpgrade".Length)] = n;
                }
                list.Add(new Dictionary<string, object>
                {
                    ["name"] = kv.Value,
                    ["isLocal"] = isLocal,
                    ["upgrades"] = upgrades,
                });
            }
            return list;
        }
    }
}
