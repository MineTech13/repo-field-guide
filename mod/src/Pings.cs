using System;
using System.Collections.Generic;
using System.Reflection;
using HarmonyLib;
using UnityEngine;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// Optional Ping_It support (soft dependency, no compile reference). A ping is shown to you
    /// in-game, so it's fair game:
    /// - every ping becomes a spot on the map (where, what kind, who pinged, how long ago);
    /// - an enemy ping with the Ping Info upgrade (which shows its name in-game) also counts as
    ///   meeting that monster. Without Ping Info it's only an "unknown enemy here" spot.
    /// </summary>
    internal static class Pings
    {
        internal sealed class Ping
        {
            public string Kind;   // Valuable, Enemy, Item, Location, Cosmetic, Cart
            public Vector3 At;
            public float Time;
            public string By;
            public string Name;   // only when Ping Info shows it
            public int Value;     // valuables, only with Ping Info
        }

        private static readonly List<Ping> recent = new List<Ping>();
        private static MethodInfo hasPingInfo;
        public static bool Installed { get; private set; }
        private const float KeepSeconds = 90f;

        public static void Apply(Harmony harmony)
        {
            var spawn = AccessTools.Method("PingIt.PingIt:Spawn");
            if (spawn == null) return; // Ping_It isn't installed: nothing to do
            try
            {
                harmony.Patch(spawn, postfix: new HarmonyMethod(typeof(Pings), nameof(SpawnPostfix)));
                hasPingInfo = AccessTools.Method("PingIt.PingIt:LocalHasPingInfo");
                Installed = true;
                Plugin.Log.LogInfo("Ping_It found: pings show on the map" + (hasPingInfo != null ? ", enemy pings with Ping Info count as seen." : "."));
            }
            catch (Exception e)
            {
                Plugin.Log.LogWarning("Could not hook Ping_It; ping support is off. " + e.Message);
            }
        }

        private static bool LocalHasPingInfo()
        {
            try { return hasPingInfo != null && (bool)hasPingInfo.Invoke(null, null); }
            catch { return false; }
        }

        // Spawn(PhysGrabObject physGrab, PingTarget type, string locationPrefix, int? sender)
        private static void SpawnPostfix(object[] __args)
        {
            try
            {
                if (!Plugin.Instance.UsePings.Value || !SemiFunc.RunIsLevel()) return;
                var grab = __args.Length > 0 ? __args[0] as PhysGrabObject : null;
                if (grab == null) return;
                string kind = __args.Length > 1 && __args[1] != null ? __args[1].ToString() : "Location";
                if (kind == "Cancel") return;
                int? sender = __args.Length > 3 ? __args[3] as int? : null;
                bool info = LocalHasPingInfo();
                var ping = new Ping { Kind = kind, At = grab.transform.position, Time = UnityEngine.Time.time, By = NameOf(sender) };
                MapData.MatePinged(AvatarOf(sender)); // a ping tells you who and roughly where they are

                if (kind == "Enemy")
                {
                    var parent = grab.GetComponentInParent<EnemyParent>();
                    if (parent != null)
                    {
                        var center = parent.Enemy != null && parent.Enemy.CenterTransform != null ? parent.Enemy.CenterTransform.position : grab.transform.position;
                        ping.At = center;
                        if (info)
                        {
                            ping.Name = parent.enemyName;
                            Plugin.Instance.Tracker?.MarkPinged(parent, center);
                        }
                    }
                }
                else if (kind == "Valuable" && info)
                {
                    var v = grab.GetComponent<ValuableObject>();
                    if (v != null)
                    {
                        ping.Value = Mathf.RoundToInt(v.dollarValueCurrent);
                        ping.Name = v.gameObject.name.Replace("(Clone)", "").Replace("Valuable ", "").Trim();
                    }
                }

                recent.RemoveAll(p => UnityEngine.Time.time - p.Time > KeepSeconds);
                recent.Add(ping);
                if (recent.Count > 30) recent.RemoveAt(0);
            }
            catch
            {
                // observation only: never throw into another mod's code
            }
        }

        private static PlayerAvatar AvatarOf(int? actor)
        {
            if (actor == null) return null;
            try
            {
                foreach (var p in SemiFunc.PlayerGetList())
                    if (p != null && p.photonView != null && p.photonView.OwnerActorNr == actor.Value) return p;
            }
            catch { }
            return null;
        }

        private static string NameOf(int? actor)
        {
            if (actor == null) return null;
            try
            {
                foreach (var p in SemiFunc.PlayerGetList())
                    if (p != null && p.photonView != null && p.photonView.OwnerActorNr == actor.Value) return p.isLocal ? "You" : p.playerName;
            }
            catch { }
            return null;
        }

        public static void Clear() => recent.Clear();

        public static List<object> Snapshot()
        {
            var list = new List<object>();
            float now = UnityEngine.Time.time;
            foreach (var p in recent)
            {
                if (now - p.Time > KeepSeconds) continue;
                var d = new Dictionary<string, object>
                {
                    ["kind"] = p.Kind,
                    ["at"] = new[] { Round(p.At.x), Round(p.At.y), Round(p.At.z) },
                    ["agoSec"] = Mathf.Round(now - p.Time),
                };
                if (p.By != null) d["by"] = p.By;
                if (p.Name != null) d["name"] = p.Name;
                if (p.Value > 0) d["value"] = p.Value;
                list.Add(d);
            }
            return list;
        }

        private static float Round(float f) => (float)Math.Round(f * 2f, MidpointRounding.AwayFromZero) / 2f;
    }
}
