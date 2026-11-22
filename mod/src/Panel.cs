using System.Linq;
using UnityEngine;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// Simple fallback panel (default F10). The polished MenuLib page and HUD come later;
    /// this one is mainly for checking that the companion reads the game correctly.
    /// </summary>
    internal sealed class Panel
    {
        public bool Visible;
        public int LatestJsonLength;
        private Rect rect = new Rect(20, 120, 380, 440);
        private Vector2 scroll;
        private string toast;
        private float toastUntil;

        public void Toast(string message)
        {
            toast = message;
            toastUntil = Time.unscaledTime + 4f;
            Plugin.Log.LogInfo(message);
        }

        public void Draw(Tracker tracker, LocalServer server)
        {
            if (toast != null && Time.unscaledTime < toastUntil)
            {
                var w = Mathf.Min(Screen.width - 40, 640);
                GUI.Box(new Rect((Screen.width - w) / 2f, 40, w, 30), toast);
            }
            if (!Visible) return;
            rect = GUI.Window(0x52464731, rect, id => DrawWindow(id, tracker, server), "Field Guide Companion " + Plugin.Version);
        }

        private void DrawWindow(int id, Tracker tracker, LocalServer server)
        {
            var p = Plugin.Instance;
            GUILayout.Label(server == null
                ? "Live link: off"
                : server.Running ? $"Live link: http://127.0.0.1:{server.Port}/state  ({server.Streams} live, {server.Requests} requests)" : "Live link failed: " + server.Error);

            var run = RunManager.instance;
            if (run != null)
                GUILayout.Label($"Map: {(run.levelCurrent != null ? run.levelCurrent.NarrativeName : "?")}   Levels completed: {run.levelsCompleted}");
            try { GUILayout.Label($"Surplus: ${SemiFunc.StatGetRunCurrency()}K"); } catch { }

            scroll = GUILayout.BeginScrollView(scroll);
            if (p.TrackMonsters.Value && SemiFunc.RunIsLevel())
            {
                GUILayout.Label("<b>Monsters you've met</b>");
                var list = tracker.Encounters.OrderByDescending(e => e.Tier).ToList();
                if (list.Count == 0) GUILayout.Label("  none yet");
                foreach (var e in list)
                {
                    var flags = (e.SpottedYou ? " · spotted you" : "") + (e.Killed ? " · killed" : "");
                    var respawn = p.ShowRespawnTimers.Value && e.Parent != null && !e.Parent.Spawned
                        ? $" · back in {Mathf.CeilToInt(Mathf.Max(0, e.Parent.DespawnedTimer))}s" : "";
                    GUILayout.Label($"  {new string('★', e.Tier)} {e.Name}{flags}{respawn}");
                }
            }

            if (p.ShopReader.Value && SemiFunc.RunIsShop())
            {
                GUILayout.Label("<b>Shelf</b> (cheapest first)");
                var shelf = Object.FindObjectsByType<ItemAttributes>(FindObjectsSortMode.None)
                    .Where(ia => ia != null && ia.shopItem && ia.item != null)
                    .OrderBy(ia => ia.value);
                foreach (var ia in shelf)
                    GUILayout.Label($"  ${ia.value}K  {ia.item.itemName}");
            }
            GUILayout.EndScrollView();

            GUILayout.Label($"{p.CopyCodeKey.Value} copy code · {p.DumpKey.Value} data dump · snapshot {LatestJsonLength} bytes");
            GUI.DragWindow();
        }
    }
}
