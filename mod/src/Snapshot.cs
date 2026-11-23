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
                ["playerCount"] = PlayerCount(),
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
            if (plugin.TeamStatus.Value && SemiFunc.RunIsLevel())
            {
                state["me"] = MapData.Me();
                state["team"] = MapData.Team();
            }
            if (plugin.ShareMap.Value && SemiFunc.RunIsLevel()) state["layout"] = MapData.Map(tracker);
            if (plugin.ShopReader.Value && SemiFunc.RunIsShop())
            {
                state["shelf"] = Shelf();
                Basket(state);
                state["catalog"] = Catalog();
            }
            if (plugin.ShopReader.Value) state["owned"] = Owned();
            if (plugin.ShopReader.Value) state["players"] = Players(plugin.IncludeTeammates.Value);

            return JsonConvert.SerializeObject(state);
        }

        /// <summary>
        /// mainMenu · lobbyMenu (multiplayer lobby, waiting for players) · lobby (the truck
        /// between levels) · level · shop · arena · tutorial · menu (anything else, e.g. loading).
        /// </summary>
        private static string Phase()
        {
            if (RunManager.instance == null || RunManager.instance.levelCurrent == null) return "menu";
            if (SemiFunc.RunIsShop()) return "shop";
            if (SemiFunc.RunIsArena()) return "arena";
            if (SemiFunc.RunIsLobbyMenu()) return "lobbyMenu";
            if (SemiFunc.IsMainMenu()) return "mainMenu";
            if (SemiFunc.RunIsTutorial()) return "tutorial";
            if (SemiFunc.RunIsLobby()) return "lobby";
            if (SemiFunc.RunIsLevel()) return "level";
            return "menu";
        }

        private static int PlayerCount()
        {
            try
            {
                var list = SemiFunc.PlayerGetList();
                return list != null ? list.Count : 0;
            }
            catch
            {
                return 0;
            }
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
                if (e.Pinged) item["pinged"] = true;
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
                var entry = new Dictionary<string, object>
                {
                    ["item"] = ia.item.name,
                    ["name"] = ia.item.itemName,
                    ["type"] = ia.item.itemType.ToString(),
                    ["priceK"] = ia.value,
                };
                // Shopkeeper haggling: was this copy shown to him, and did he give a discount?
                var reaction = ia.GetComponent<ShopKeeperItemReaction>();
                if (reaction != null)
                {
                    if (reaction.StateGet() != ShopKeeperItemReaction.State.Idle) entry["haggle"] = reaction.StateGet().ToString();
                    if (reaction.TimesShownGet() > 0) entry["shown"] = reaction.TimesShownGet();
                }
                list.Add(entry);
            }
            return list;
        }

        /// <summary>
        /// What's in the checkout area right now. The host sends this list (asset names + prices)
        /// to every player, so it works for clients too.
        /// </summary>
        private static void Basket(Dictionary<string, object> state)
        {
            var shop = ShopManager.instance;
            if (shop == null) return;
            var list = new List<object>();
            var names = shop.shoppingListItemNames;
            var values = shop.shoppingListItemValues;
            if (names != null && values != null)
            {
                for (int i = 0; i < Math.Min(names.Count, values.Count); i++)
                    list.Add(new Dictionary<string, object> { ["item"] = names[i], ["priceK"] = values[i] });
            }
            state["basket"] = list;
            state["basketTotalK"] = shop.totalCost;

            // The shopkeeper allows 3 haggling attempts per shop visit.
            var keeper = ShopKeeper.instance;
            if (keeper != null)
            {
                int used = Math.Max(0, Math.Min(3, keeper.itemDiscountAttempts));
                state["shopkeeper"] = new Dictionary<string, object> { ["attemptsUsed"] = used, ["attemptsLeft"] = 3 - used };
            }
        }

        private static List<object> catalogCache;
        private static int catalogCount = -1;

        /// <summary>
        /// Every item the game knows, including items added by other mods: name, type,
        /// base price range ($K) and shelf limit. Lets the website show modded items properly.
        /// Built once and reused while the item list doesn't change.
        /// </summary>
        private static List<object> Catalog()
        {
            var stats = StatsManager.instance;
            if (stats == null || stats.itemDictionary == null) return new List<object>();
            if (catalogCache != null && catalogCount == stats.itemDictionary.Count) return catalogCache;
            var list = new List<object>();
            foreach (var i in stats.itemDictionary.Values)
            {
                if (i == null || i.disabled) continue;
                float min = i.value != null ? i.value.valueMin : 0f, max = i.value != null ? i.value.valueMax : 0f;
                list.Add(new Dictionary<string, object>
                {
                    ["item"] = i.name,
                    ["name"] = i.itemName,
                    ["type"] = i.itemType.ToString(),
                    ["priceK"] = new[] { Math.Max(1, (int)Math.Ceiling(min * 4f / 1000f)), Math.Max(1, (int)Math.Ceiling(max * 4f / 1000f)) },
                    ["maxInShop"] = i.maxAmountInShop,
                    ["coopOnly"] = i.minPlayerCount > 1,
                });
            }
            catalogCache = list;
            catalogCount = stats.itemDictionary.Count;
            return list;
        }

        /// <summary>
        /// The team inventory: items bought and still around (weapons, tools, drones, carts,
        /// crystals) and upgrades bought but not used yet.
        /// </summary>
        private static Dictionary<string, int> Owned()
        {
            var owned = new Dictionary<string, int>();
            var stats = StatsManager.instance;
            if (stats == null || stats.itemsPurchased == null) return owned;
            foreach (var kv in stats.itemsPurchased)
                if (kv.Value > 0) owned[kv.Key] = kv.Value;
            return owned;
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
