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
    /// Debug / collect mode (off by default). Writes to BepInEx/config/RepoFieldGuide/recordings:
    /// - one recording per level (.jsonl): what the live link sends, every few seconds, so a
    ///   round can be replayed on the website or used to test the guide against real data;
    /// - one level dump per level (_level.json): the full map tiles, rooms, extraction points,
    ///   spawned monsters and level values, for checking the guide's data and the map drawing.
    /// Files stay on this PC. The level dump is never sent to the website.
    /// </summary>
    internal static class Recorder
    {
        private static string dir;
        private static StreamWriter writer;
        private static string currentKey;
        private static float fileStart;
        private static float nextWrite;
        private static string lastJson;
        private static bool levelDumped;
        public static string CurrentFile { get; private set; }

        public static void Tick(string snapshotJson)
        {
            var plugin = Plugin.Instance;
            if (!plugin.RecordSessions.Value)
            {
                Close();
                return;
            }
            try
            {
                var run = RunManager.instance;
                string key = run == null || run.levelCurrent == null ? "menu" : $"{run.levelsCompleted}|{run.levelCurrent.name}|{SemiFunc.RunIsLevel()}|{SemiFunc.RunIsShop()}";
                if (key != currentKey)
                {
                    Open(run); // closes the previous file first
                    currentKey = key;
                }
                if (!levelDumped && SemiFunc.RunIsLevel() && LevelGenerator.Instance != null && LevelGenerator.Instance.Generated)
                {
                    levelDumped = true;
                    WriteLevelDump(run);
                }
                if (writer == null || Time.unscaledTime < nextWrite || snapshotJson == lastJson) return;
                nextWrite = Time.unscaledTime + Mathf.Clamp(plugin.RecordInterval.Value, 0.5f, 10f);
                lastJson = snapshotJson;
                writer.Write("{\"t\":");
                writer.Write(Math.Round(Time.unscaledTime - fileStart, 1).ToString(System.Globalization.CultureInfo.InvariantCulture));
                writer.Write(",\"s\":");
                writer.Write(snapshotJson);
                writer.Write("}\n");
                writer.Flush();
            }
            catch (Exception e)
            {
                Plugin.Log.LogWarning("Recorder: " + e.Message);
                Close();
            }
        }

        private static void Open(RunManager run)
        {
            Close();
            levelDumped = false;
            if (run == null || run.levelCurrent == null) return; // nothing worth recording in menus
            dir = Path.Combine(Paths.ConfigPath, "RepoFieldGuide", "recordings");
            Directory.CreateDirectory(dir);
            Prune();
            string phase = SemiFunc.RunIsShop() ? "shop" : SemiFunc.RunIsLevel() ? "level" : "other";
            string name = $"{DateTime.Now:yyyyMMdd-HHmmss}_L{run.levelsCompleted + 1}_{phase}_{Safe(run.levelCurrent.NarrativeName ?? run.levelCurrent.name)}";
            CurrentFile = Path.Combine(dir, name + ".jsonl");
            writer = new StreamWriter(CurrentFile, append: false) { AutoFlush = false };
            fileStart = Time.unscaledTime;
            nextWrite = 0f;
            lastJson = null;
            Plugin.Log.LogInfo("Recording to " + CurrentFile);
        }

        public static void Close()
        {
            if (writer == null) return;
            try { writer.Flush(); writer.Dispose(); } catch { }
            writer = null;
            CurrentFile = null;
            currentKey = null;
        }

        /// <summary>Keep only the newest recordings (Debug → Keep recordings).</summary>
        private static void Prune()
        {
            int keep = Math.Max(1, Plugin.Instance.KeepRecordings.Value);
            var files = new DirectoryInfo(dir).GetFiles("*.jsonl").OrderByDescending(f => f.CreationTimeUtc).ToList();
            foreach (var f in files.Skip(keep - 1))
            {
                try
                {
                    f.Delete();
                    var level = Path.Combine(dir, Path.GetFileNameWithoutExtension(f.Name) + "_level.json");
                    if (File.Exists(level)) File.Delete(level);
                }
                catch { }
            }
        }

        private static string Safe(string s) => new string((s ?? "level").Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());

        private static float[] V(Vector3 v) => new[] { (float)Math.Round(v.x, 2), (float)Math.Round(v.y, 2), (float)Math.Round(v.z, 2) };

        private static object B(Bounds b) => new { center = V(b.center), size = V(b.size) };

        private static void WriteLevelDump(RunManager run)
        {
            if (CurrentFile == null) return;
            var rd = RoundDirector.instance;
            var dump = new Dictionary<string, object>
            {
                ["mod"] = Plugin.Version,
                ["written"] = DateTime.Now.ToString("s"),
                ["level"] = run.levelCurrent != null ? run.levelCurrent.name : null,
                ["map"] = run.levelCurrent != null ? run.levelCurrent.NarrativeName : null,
                ["levelsCompleted"] = run.levelsCompleted,
                ["players"] = SafeCount(),
                ["tileSize"] = LevelGenerator.TileSize,
                ["haulGoal"] = rd != null ? rd.haulGoal : 0,
                ["haulGoalMax"] = rd != null ? rd.haulGoalMax : 0,
                ["extractionPoints"] = rd != null ? rd.extractionPoints : 0,
            };

            // Map tiles, unfiltered, with everything needed to check how they're drawn.
            dump["floors"] = UnityEngine.Object.FindObjectsByType<DirtFinderMapFloor>(FindObjectsSortMode.None).Where(f => f != null).Select(f => new
            {
                type = f.Type.ToString(),
                pos = V(f.transform.position),
                euler = V(f.transform.eulerAngles),
                scale = V(f.transform.lossyScale),
                name = f.gameObject.name,
            }).ToList();
            dump["walls"] = UnityEngine.Object.FindObjectsByType<DirtFinderMapWall>(FindObjectsSortMode.None).Where(w => w != null).Select(w => new
            {
                type = w.Type.ToString(),
                pos = V(w.transform.position),
                euler = V(w.transform.eulerAngles),
                scale = V(w.transform.lossyScale),
                right = V(w.transform.right),
                name = w.gameObject.name,
            }).ToList();
            dump["rooms"] = UnityEngine.Object.FindObjectsByType<RoomVolume>(FindObjectsSortMode.None).Where(r => r != null).Select(r => new
            {
                name = r.gameObject.name,
                truck = r.Truck,
                extraction = r.Extraction,
                explored = r.Explored,
                bounds = r.GetComponentsInChildren<Collider>().Select(c => B(c.bounds)).ToList(),
            }).ToList();
            if (rd != null && rd.extractionPointList != null)
                dump["extractionPointList"] = rd.extractionPointList.Where(g => g != null).Select(g => new { pos = V(g.transform.position), state = g.GetComponent<ExtractionPoint>()?.currentState.ToString() }).ToList();

            // What the level spawned (for checking spawn tables). Debug file only.
            var director = EnemyDirector.instance;
            if (director != null && director.enemiesSpawned != null)
                dump["enemies"] = director.enemiesSpawned.Where(e => e != null).Select(e => new
                {
                    name = e.enemyName,
                    key = e.enemyNameLocalized != null ? e.enemyNameLocalized.name : null,
                    difficulty = e.difficulty.ToString(),
                    spawned = e.Spawned,
                }).ToList();
            var valuables = UnityEngine.Object.FindObjectsByType<ValuableObject>(FindObjectsSortMode.None).Where(v => v != null).ToList();
            dump["valuables"] = new
            {
                count = valuables.Count,
                total = valuables.Sum(v => Math.Round(v.dollarValueCurrent)),
                bySize = valuables.GroupBy(v => v.volumeType.ToString()).ToDictionary(g => g.Key, g => g.Count()),
            };
            dump["pingIt"] = Pings.Installed;

            var path = Path.Combine(dir, Path.GetFileNameWithoutExtension(CurrentFile) + "_level.json");
            File.WriteAllText(path, JsonConvert.SerializeObject(dump, Formatting.None));
            Plugin.Log.LogInfo("Level dump written: " + path);
        }

        private static int SafeCount()
        {
            try { return SemiFunc.PlayerGetList().Count; } catch { return 0; }
        }
    }
}
