using System;
using HarmonyLib;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// Harmony hooks. Each one is resolved by name and skipped (with a log line)
    /// if a game update removed it, so the rest of the companion keeps working.
    /// All hooks are postfixes that only observe; none change game behaviour.
    /// </summary>
    internal static class Patches
    {
        public static void Apply(Harmony harmony)
        {
            TryPatch(harmony, "EnemyVision:VisionTrigger", nameof(VisionTriggerPostfix), "'spotted you' detection");
        }

        private static void TryPatch(Harmony harmony, string target, string postfix, string feature)
        {
            try
            {
                var method = AccessTools.Method(target);
                if (method == null)
                {
                    Plugin.Log.LogWarning($"{target} not found; {feature} is disabled for this game version.");
                    return;
                }
                harmony.Patch(method, postfix: new HarmonyMethod(typeof(Patches), postfix));
                Plugin.Log.LogInfo($"Hooked {target} ({feature}).");
            }
            catch (Exception e)
            {
                Plugin.Log.LogWarning($"Could not hook {target}; {feature} is disabled. {e.Message}");
            }
        }

        private static void VisionTriggerPostfix(EnemyVision __instance, PlayerAvatar player)
        {
            try
            {
                if (player == null || !player.isLocal || __instance == null || __instance.Enemy == null) return;
                Plugin.Instance?.Tracker?.MarkSpotted(__instance.Enemy.EnemyParent);
            }
            catch
            {
                // observation only: never throw into game code
            }
        }
    }
}
