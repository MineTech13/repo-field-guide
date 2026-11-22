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
        private static float nextRooms;

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
            return map;
        }

        /// <summary>Explored rooms as boxes [cx, cy, cz, sx, sy, sz]. Rebuilt every 2 s.</summary>
        private static List<object> Rooms()
        {
            if (Time.time < nextRooms) return roomCache;
            nextRooms = Time.time + 2f;
            var list = new List<object>();
            foreach (var rv in UnityEngine.Object.FindObjectsByType<RoomVolume>(FindObjectsSortMode.None))
            {
                if (rv == null || !rv.Explored) continue;
                foreach (var col in rv.GetComponentsInChildren<Collider>())
                {
                    var b = col.bounds;
                    list.Add(new[] { R(b.center.x), R(b.center.y), R(b.center.z), R(b.size.x), R(b.size.y), R(b.size.z) });
                }
            }
            roomCache = list;
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
                    bool known = current || ep.currentState != ExtractionPoint.State.Idle || (rv != null && rv.Explored);
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
