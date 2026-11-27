using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// Team status and map data for the website. Same rule as everything else: only what
    /// the local player could know in-game (explored rooms, discovered valuables, heads
    /// that someone has found).
    /// </summary>
    internal static class MapData
    {
        private static float[] P(Vector3 v) => new[] { R(v.x), R(v.y), R(v.z) };
        private static float R(float f) => (float)Math.Round(f * 2f, MidpointRounding.AwayFromZero) / 2f; // 0.5 m

        // ---------------- team status ----------------

        public static Dictionary<string, object> Me()
        {
            var me = SemiFunc.PlayerAvatarLocal();
            if (me == null) return null;
            var d = new Dictionary<string, object> { ["dead"] = me.isDisabled };
            var h = me.playerHealth;
            if (h != null)
            {
                d["health"] = h.health;
                d["maxHealth"] = h.maxHealth;
            }
            return d;
        }

        // Teammates' last known positions: only from seeing them on your screen, or from their pings.
        private static readonly Dictionary<string, (Vector3 pos, float time, string how)> mates = new Dictionary<string, (Vector3, float, string)>();
        private static int sightMask = -1;

        public static void ClearMates() => mates.Clear();

        /// <summary>Called when a teammate pings (Ping_It): you know where they were standing.</summary>
        public static void MatePinged(PlayerAvatar p)
        {
            if (p == null || p.isLocal || p.isDisabled) return;
            mates[p.playerName ?? "?"] = (p.transform.position, Time.time, "ping");
        }

        private static void UpdateMateSighting(PlayerAvatar p)
        {
            if (p == null || p.isLocal || p.isDisabled) return;
            var cam = Camera.main;
            if (cam == null) return;
            var chest = p.transform.position + Vector3.up * 1.2f;
            if (Vector3.Distance(cam.transform.position, chest) > 60f) return;
            bool onScreen;
            try { onScreen = SemiFunc.OnScreen(chest, -0.05f, -0.05f); } catch { var v = cam.WorldToViewportPoint(chest); onScreen = v.z > 0 && v.x > 0 && v.x < 1 && v.y > 0 && v.y < 1; }
            if (!onScreen) return;
            if (sightMask == -1) sightMask = LayerMask.GetMask("Default"); // level geometry only, not the teammate's own body
            if (Physics.Linecast(cam.transform.position, chest, sightMask, QueryTriggerInteraction.Ignore)) return;
            mates[p.playerName ?? "?"] = (p.transform.position, Time.time, "seen");
        }

        /// <summary>Everyone in the game. A teammate only counts as dead once their head has been found.</summary>
        public static List<object> Team()
        {
            var list = new List<object>();
            List<PlayerAvatar> players;
            try { players = SemiFunc.PlayerGetList(); } catch { return list; }
            if (players == null) return list;
            foreach (var p in players)
            {
                if (p == null) continue;
                var head = p.playerDeathHead;
                bool headFound = head != null && head.triggered && head.serverSeen;
                bool dead = p.isLocal ? p.isDisabled : p.isDisabled && headFound;
                var d = new Dictionary<string, object>
                {
                    ["name"] = p.playerName,
                    ["isLocal"] = p.isLocal,
                    ["dead"] = dead,
                };
                if (!p.isLocal && !dead)
                {
                    UpdateMateSighting(p);
                    if (mates.TryGetValue(p.playerName ?? "?", out var m))
                    {
                        d["lastSeen"] = P(m.pos);
                        d["lastSeenAgo"] = Mathf.Round(Time.time - m.time);
                        d["lastSeenHow"] = m.how;
                    }
                }
                if (dead && head != null && head.triggered)
                {
                    d["head"] = P(head.transform.position);
                    if (head.inTruck) d["headIn"] = "truck";
                    else if (head.inExtractionPoint) d["headIn"] = "extraction";
                }
                list.Add(d);
            }
            return list;
        }

        // ---------------- map ----------------

        private static List<object> roomCache = new List<object>();
        private static Vector3? truckPos; // you always know where the truck is: you start there
        private static float nextRooms;
        private static List<Bounds> exploredBounds = new List<Bounds>();

        private static bool InExplored(Vector3 p)
        {
            foreach (var b in exploredBounds)
            {
                var bb = b;
                bb.Expand(1f);
                if (bb.Contains(p)) return true;
            }
            return false;
        }

        // The in-game map is built from these tiles (DirtFinderMapFloor/Wall). A fog cover hides
        // each room until it's explored, so we only send tiles inside explored rooms.
        private struct Tile { public Vector3 Pos, Mid; public int Layer; public float Yaw, Sx, Sz; public int Kind; public bool Truck; }
        private static List<Tile> allFloors, allWalls;
        private static Level tilesLevel;
        private static int tilesLevelsCompleted = -1;
        private static float nextTileScan;
        private static List<object> floorCache = new List<object>(), wallCache = new List<object>();
        private const float LayerHeight = 4f; // Map.LayerHeight

        private static int LayerOf(float y) => Mathf.FloorToInt((y + 0.1f) / LayerHeight);

        private static void CollectTiles()
        {
            var run = RunManager.instance;
            bool sameLevel = allFloors != null && run != null && run.levelCurrent == tilesLevel && run.levelsCompleted == tilesLevelsCompleted;
            // The level's rooms can spawn after LevelGenerator says it's generated (seen as a client),
            // so keep re-scanning: often until the tile count settles, then now and then.
            if (sameLevel && Time.unscaledTime < nextTileScan) return;
            if (LevelGenerator.Instance == null || !LevelGenerator.Instance.Generated) return;
            int before = sameLevel ? allFloors.Count + allWalls.Count : -1;
            tilesLevel = run != null ? run.levelCurrent : null;
            tilesLevelsCompleted = run != null ? run.levelsCompleted : -1;
            allFloors = new List<Tile>();
            allWalls = new List<Tile>();
            foreach (var f in UnityEngine.Object.FindObjectsByType<DirtFinderMapFloor>(FindObjectsSortMode.None))
            {
                if (f == null) continue;
                var t = f.Type;
                int kind = t == DirtFinderMapFloor.FloorType.Floor_Stairs ? 2
                    : t.ToString().Contains("Diagonal") ? 1
                    : t == DirtFinderMapFloor.FloorType.Truck_Floor || t == DirtFinderMapFloor.FloorType.Truck_Wall ? 3
                    : t.ToString().EndsWith("_Wall") ? 4 : 0;
                if (t.ToString().EndsWith("_Wall")) continue; // truck/extraction walls, not floor
                // Map pieces are squares (1x1, 0.5x0.5, 0.25x0.25) anchored at a corner, scaled by the transform.
                float s = t.ToString().Contains("1x05") ? 0.5f : t.ToString().Contains("1x025") ? 0.25f : 1f;
                var sc = f.transform.lossyScale;
                allFloors.Add(new Tile { Pos = f.transform.position, Mid = f.transform.position + (f.transform.right * Mathf.Abs(sc.x) * s + f.transform.forward * Mathf.Abs(sc.z) * s) * (LevelGenerator.TileSize / 2f), Layer = LayerOf(f.transform.position.y), Yaw = f.transform.eulerAngles.y, Sx = Mathf.Abs(sc.x) * s, Sz = Mathf.Abs(sc.z) * s, Kind = kind, Truck = kind == 3 });
            }
            foreach (var w in UnityEngine.Object.FindObjectsByType<DirtFinderMapWall>(FindObjectsSortMode.None))
            {
                if (w == null) continue;
                var n = w.Type.ToString();
                int kind = n.StartsWith("Door_Blocked") ? 2 : n.StartsWith("Door") ? 1 : n.StartsWith("Stairs") ? 3 : 0;
                float len = n.Contains("1x05") ? 0.5f : n.Contains("1x025") ? 0.25f : n.Contains("1x2") ? 2f : 1f;
                float l = Mathf.Abs(w.transform.lossyScale.x) * len;
                // Walls start at their pivot and run along local X.
                allWalls.Add(new Tile { Pos = w.transform.position, Mid = w.transform.position + w.transform.right * l * (LevelGenerator.TileSize / 2f), Layer = LayerOf(w.transform.position.y), Yaw = w.transform.eulerAngles.y, Sx = Mathf.Abs(w.transform.lossyScale.x) * len, Kind = kind });
            }
            int after = allFloors.Count + allWalls.Count;
            nextTileScan = Time.unscaledTime + (after == before && after > 50 ? 20f : 2f);
            if (after != before) Plugin.Log.LogInfo($"Map tiles: {allFloors.Count} floors, {allWalls.Count} walls (tile size {LevelGenerator.TileSize} m).");
        }

        /// <summary>
        /// Tiles inside explored rooms. Floors: [x, z, layer, yaw, sizeX, sizeZ, kind] (kind 0 floor,
        /// 1 diagonal, 2 stairs, 3 truck, 4 used/inactive). Walls: [x, z, layer, yaw, length, kind]
        /// (kind 0 wall, 1 door, 2 blocked door, 3 stairs). Sizes are in tiles (1 = LevelGenerator.TileSize).
        /// </summary>
        private static void VisibleTiles(List<Bounds> explored)
        {
            CollectTiles();
            var floors = new List<object>();
            var walls = new List<object>();
            if (allFloors == null) { floorCache = floors; wallCache = walls; return; }
            bool Seen(Vector3 p)
            {
                foreach (var b in explored)
                {
                    var bb = b;
                    bb.Expand(1.5f);
                    if (bb.Contains(p)) return true;
                }
                return false;
            }
            foreach (var t in allFloors)
                if (t.Truck || Seen(t.Mid))
                    floors.Add(new object[] { R(t.Pos.x), R(t.Pos.z), t.Layer, Mathf.Round(t.Yaw), Math.Round(t.Sx, 2), Math.Round(t.Sz, 2), t.Kind });
            foreach (var t in allWalls)
                if (Seen(t.Mid))
                    walls.Add(new object[] { R(t.Pos.x), R(t.Pos.z), t.Layer, Mathf.Round(t.Yaw), Math.Round(t.Sx, 2), t.Kind });
            floorCache = floors;
            wallCache = walls;
        }

        public static Dictionary<string, object> Map(Tracker tracker)
        {
            var map = new Dictionary<string, object>();
            var me = SemiFunc.PlayerAvatarLocal();
            if (me != null)
            {
                map["me"] = P(me.transform.position);
                var cam = Camera.main;
                if (cam != null) map["yaw"] = Mathf.Round(cam.transform.eulerAngles.y);
            }
            map["rooms"] = Rooms();
            map["floors"] = floorCache;
            map["walls"] = wallCache;
            if (truckPos != null) map["truck"] = P(truckPos.Value);
            map["extraction"] = Extraction();
            map["valuables"] = Valuables();
            var seen = new List<object>();
            foreach (var e in tracker.Encounters)
            {
                if (e.LastSeenPos == null) continue;
                seen.Add(new Dictionary<string, object>
                {
                    ["key"] = e.Key,
                    ["name"] = e.Name,
                    ["at"] = P(e.LastSeenPos.Value),
                    ["agoSec"] = Mathf.Round(tracker.LevelTime - e.LastSeenAt),
                    ["killed"] = e.Killed,
                });
            }
            map["monsters"] = seen;
            if (Pings.Installed && Plugin.Instance.UsePings.Value) map["pings"] = Pings.Snapshot();
            return map;
        }

        /// <summary>Explored rooms as boxes [cx, cy, cz, sx, sy, sz]. Rebuilt every 2 s, together with the tiles.</summary>
        private static List<object> Rooms()
        {
            if (Time.time < nextRooms) return roomCache;
            nextRooms = Time.time + 2f;
            var list = new List<object>();
            var explored = new List<Bounds>();
            truckPos = null;
            foreach (var rv in UnityEngine.Object.FindObjectsByType<RoomVolume>(FindObjectsSortMode.None))
            {
                if (rv == null) continue;
                if (rv.Truck && truckPos == null)
                {
                    var tc = rv.GetComponentInChildren<Collider>();
                    truckPos = tc != null ? tc.bounds.center : rv.transform.position;
                }
                if (!rv.Explored) continue;
                foreach (var col in rv.GetComponentsInChildren<Collider>())
                {
                    var b = col.bounds;
                    explored.Add(b);
                    list.Add(new[] { R(b.center.x), R(b.center.y), R(b.center.z), R(b.size.x), R(b.size.y), R(b.size.z) });
                }
            }
            roomCache = list;
            exploredBounds = explored;
            try { VisibleTiles(explored); } catch (Exception ex) { Plugin.Log.LogWarning("Map tiles: " + ex.Message); }
            return list;
        }

        private static Dictionary<string, object> Extraction()
        {
            var rd = RoundDirector.instance;
            var d = new Dictionary<string, object>();
            if (rd == null) return d;
            int count = Math.Max(1, rd.extractionPoints);
            d["goalPerPoint"] = rd.haulGoal / count;
            d["total"] = rd.extractionPoints;
            d["completed"] = rd.extractionPointsCompleted;
            var points = new List<object>();
            if (rd.extractionPointList != null)
            {
                foreach (var go in rd.extractionPointList)
                {
                    if (go == null) continue;
                    var ep = go.GetComponent<ExtractionPoint>();
                    if (ep == null || ep.isShop) continue;
                    var rv = ep.roomVolume != null ? ep.roomVolume.GetComponent<RoomVolume>() : null;
                    bool current = rd.extractionPointCurrent == ep;
                    // Found = active/used, its own room explored, or it stands in a room someone explored
                    // (the game only marks the pad's own little room when you stand right on it).
                    bool known = current || ep.currentState != ExtractionPoint.State.Idle || (rv != null && rv.Explored) || InExplored(go.transform.position);
                    if (!known) continue; // not found yet
                    points.Add(new Dictionary<string, object>
                    {
                        ["at"] = P(go.transform.position),
                        ["state"] = ep.currentState.ToString(),
                        ["current"] = current,
                    });
                }
            }
            d["points"] = points;
            return d;
        }

        private static List<object> Valuables()
        {
            var list = new List<object>();
            var rd = RoundDirector.instance;
            foreach (var v in UnityEngine.Object.FindObjectsByType<ValuableObject>(FindObjectsSortMode.None))
            {
                if (v == null || !v.discovered) continue;
                var item = new Dictionary<string, object>
                {
                    ["name"] = CleanName(v.gameObject.name),
                    ["value"] = Mathf.Round(v.dollarValueCurrent),
                    ["at"] = P(v.transform.position),
                    ["size"] = v.volumeType.ToString(),
                };
                if (rd != null && rd.dollarHaulList != null && rd.dollarHaulList.Contains(v.gameObject)) item["inHaul"] = true;
                list.Add(item);
            }
            return list;
        }

        private static string CleanName(string n)
        {
            if (string.IsNullOrEmpty(n)) return "Valuable";
            n = n.Replace("(Clone)", "").Trim();
            if (n.StartsWith("Valuable ")) n = n.Substring("Valuable ".Length);
            return n;
        }
    }
}
