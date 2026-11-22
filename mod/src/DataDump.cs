using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BepInEx;
using Newtonsoft.Json;
using UnityEngine;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// F9: writes the game's own data (items, prices, monsters, spawn curves) to
    /// BepInEx/config/RepoFieldGuide.dump.json so the website's data can be checked
    /// against the real game. Read-only; only runs when you press the key.
    /// </summary>
    internal static class DataDump
    {
        public static string Write()
        {
            try
            {
                var dump = new Dictionary<string, object>
                {
                    ["mod"] = Plugin.Version,
                    ["gameVersion"] = Application.version,
                    ["writtenAt"] = DateTime.UtcNow.ToString("o"),
                    ["shop"] = Shop(),
                    ["items"] = Items(),
                    ["enemyDirector"] = Director(),
                };
                var path = Path.Combine(Paths.ConfigPath, "RepoFieldGuide.dump.json");
                File.WriteAllText(path, JsonConvert.SerializeObject(dump, Formatting.Indented));
                return path;
            }
            catch (Exception e)
            {
                Plugin.Log.LogError("Data dump failed: " + e);
                return null;
            }
        }

        private static object Shop()
        {
            var s = ShopManager.instance;
            if (s == null) return "ShopManager not loaded (open the Service Station once, then dump again)";
            return new Dictionary<string, object>
            {
                ["itemValueMultiplier"] = s.itemValueMultiplier,
                ["upgradeValueIncrease"] = s.upgradeValueIncrease,
                ["healthPackValueIncrease"] = s.healthPackValueIncrease,
                ["crystalValueIncrease"] = s.crystalValueIncrease,
                ["slots"] = new Dictionary<string, int>
                {
                    ["items"] = s.itemSpawnTargetAmount,
                    ["consumables"] = s.itemConsumablesAmount,
                    ["upgrades"] = s.itemUpgradesAmount,
                    ["healthPacks"] = s.itemHealthPacksAmount,
                },
            };
        }

        private static object Items()
        {
            var stats = StatsManager.instance;
            if (stats == null) return null;
            return stats.itemDictionary.Values.Where(i => i != null).OrderBy(i => i.itemType.ToString()).ThenBy(i => i.name).Select(i =>
                new Dictionary<string, object>
                {
                    ["asset"] = i.name,
                    ["name"] = i.itemName,
                    ["type"] = i.itemType.ToString(),
                    ["disabled"] = i.disabled,
                    ["status"] = i.status.ToString(),
                    ["valueMin"] = i.value != null ? i.value.valueMin : (float?)null,
                    ["valueMax"] = i.value != null ? i.value.valueMax : (float?)null,
                    ["maxAmount"] = i.maxAmount,
                    ["maxAmountInShop"] = i.maxAmountInShop,
                    ["minPlayerCount"] = i.minPlayerCount,
                    ["maxPurchase"] = i.maxPurchase,
                    ["maxPurchaseAmount"] = i.maxPurchaseAmount,
                    ["secretShop"] = i.itemSecretShopType.ToString(),
                    ["volume"] = i.itemVolume.ToString(),
                }).ToList();
        }

        private static object Director()
        {
            var d = EnemyDirector.instance;
            if (d == null) return "EnemyDirector not loaded (dump from inside a level)";

            // Monster counts per level, sampled the same way AmountSetup() does.
            var perLevel = new List<object>();
            for (int completed = 0; completed <= 30; completed++)
            {
                float m1 = Mathf.Clamp01(completed / 9f);
                float m2 = Mathf.Clamp01((completed - 9) / 10f);
                float m3 = Mathf.Clamp01((completed - 19) / 10f);
                bool late = m2 > 0f;
                perLevel.Add(new Dictionary<string, object>
                {
                    ["level"] = completed + 1,
                    ["t1"] = (int)(late ? d.amountCurve1_2.Evaluate(m2) : d.amountCurve1_1.Evaluate(m1)),
                    ["t2"] = (int)(late ? d.amountCurve2_2.Evaluate(m2) : d.amountCurve2_1.Evaluate(m1)),
                    ["t3"] = (int)(late ? d.amountCurve3_2.Evaluate(m2) : d.amountCurve3_1.Evaluate(m1)),
                    ["respawnTimeMultiplier"] = m3 > 0f ? d.despawnTimeCurve_2.Evaluate(m3) : m2 > 0f ? d.despawnTimeCurve_1.Evaluate(m2) : 1f,
                });
            }

            return new Dictionary<string, object>
            {
                ["perLevel"] = perLevel,
                ["despawnedDecreaseMinutes"] = d.despawnedDecreaseMinutes,
                ["despawnedDecreasePercent"] = d.despawnedDecreasePercent,
                ["tier1"] = Enemies(d.enemiesDifficulty1),
                ["tier2"] = Enemies(d.enemiesDifficulty2),
                ["tier3"] = Enemies(d.enemiesDifficulty3),
            };
        }

        private static object Enemies(List<EnemySetup> list)
        {
            if (list == null) return null;
            return list.Where(s => s != null).Select(s =>
            {
                var entry = new Dictionary<string, object>
                {
                    ["setup"] = s.name,
                    ["rarity"] = s.rarityPreset != null ? s.rarityPreset.chance : (float?)null,
                    ["levelsCompletedCondition"] = s.levelsCompletedCondition,
                    ["levelsCompletedMin"] = s.levelsCompletedMin,
                    ["levelsCompletedMax"] = s.levelsCompletedMax,
                    ["runsPlayed"] = s.runsPlayed,
                };
                var parents = new List<object>();
                if (s.spawnObjects != null)
                {
                    foreach (var prefabRef in s.spawnObjects)
                    {
                        try
                        {
                            var go = prefabRef?.Prefab;
                            var parent = go != null ? go.GetComponentInChildren<EnemyParent>(true) : null;
                            if (parent == null) continue;
                            parents.Add(new Dictionary<string, object>
                            {
                                ["name"] = parent.enemyName,
                                ["key"] = parent.enemyNameLocalized != null ? parent.enemyNameLocalized.name : null,
                                ["spawnedTimeMin"] = parent.SpawnedTimeMin,
                                ["spawnedTimeMax"] = parent.SpawnedTimeMax,
                                ["despawnedTimeMin"] = parent.DespawnedTimeMin,
                                ["despawnedTimeMax"] = parent.DespawnedTimeMax,
                            });
                        }
                        catch (Exception e)
                        {
                            parents.Add(new Dictionary<string, object> { ["error"] = e.Message });
                        }
                    }
                }
                entry["parents"] = parents;
                return (object)entry;
            }).ToList();
        }
    }
}
