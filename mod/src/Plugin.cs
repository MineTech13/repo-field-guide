using System;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using HarmonyLib;
using UnityEngine;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// Optional, read-only companion for the R.E.P.O. Field Guide website.
    /// It never changes gameplay: it only reads what the local player can know
    /// and shares it with the website on this PC (127.0.0.1) or as a copy code.
    /// </summary>
    [BepInPlugin(Guid, Name, Version)]
    public sealed class Plugin : BaseUnityPlugin
    {
        public const string Guid = "minetech13.repofieldguide.companion";
        public const string Name = "R.E.P.O. Field Guide Companion";
        public const string Version = "0.1.2";

        internal static Plugin Instance { get; private set; }
        internal static ManualLogSource Log { get; private set; }

        // ---- settings (all show up in REPOConfig automatically) ----
        internal ConfigEntry<bool> TrackMonsters;
        internal ConfigEntry<bool> ShopReader;
        internal ConfigEntry<bool> IncludeTeammates;
        internal ConfigEntry<bool> ShowRespawnTimers;
        internal ConfigEntry<bool> LiveLink;
        internal ConfigEntry<int> Port;
        internal ConfigEntry<string> AllowedOrigins;
        internal ConfigEntry<KeyboardShortcut> PanelKey;
        internal ConfigEntry<KeyboardShortcut> CopyCodeKey;
        internal ConfigEntry<KeyboardShortcut> DumpKey;

        internal Tracker Tracker { get; private set; }
        private LocalServer server;
        private Panel panel;
        private float nextSnapshot;
        private float nextServerRetry;

        private void Awake()
        {
            Instance = this;
            Log = Logger;

            TrackMonsters = Config.Bind("Features", "Track seen monsters", true,
                "Record monsters once they've been on your screen or have spotted you. Monsters you haven't met are never shown.");
            ShopReader = Config.Bind("Features", "Shop reader", true,
                "In the Service Station, read the shelf (each copy's price), your surplus and upgrades.");
            IncludeTeammates = Config.Bind("Features", "Include teammates upgrades", true,
                "Also share each teammate's upgrades so the website can suggest who should buy what.");
            ShowRespawnTimers = Config.Bind("Features", "Respawn timers", true,
                "For monsters you've met: show the real time until they respawn.");

            LiveLink = Config.Bind("Live link", "Enabled", true,
                "Serve read-only game data on this PC for the website (http://127.0.0.1:<port>/state). Nothing leaves your PC.");
            Port = Config.Bind("Live link", "Port", 47380,
                new ConfigDescription("Local port for the live link.", new AcceptableValueRange<int>(1024, 65535)));
            AllowedOrigins = Config.Bind("Live link", "Allowed websites",
                "https://repoguide.pages.dev,https://*.repoguide.pages.dev,https://minetech13.github.io,http://localhost:5173",
                "Comma-separated list of websites allowed to read the live link. * matches a subdomain.");

            // Defaults avoid keys popular mods already use (F7/F9 NoSaveDelete, F8 SpawnBrowser).
            // A shortcut only fires when exactly its modifiers are held, so these three never overlap.
            const string keys = "Keys";
            const string keyHint = " Change it if another mod uses the same key. Format: Key or Key + Modifier, e.g. F10 + LeftControl.";
            PanelKey = Config.Bind(keys, "Toggle panel", new KeyboardShortcut(KeyCode.F10),
                "Show or hide the companion panel." + keyHint);
            CopyCodeKey = Config.Bind(keys, "Copy game code", new KeyboardShortcut(KeyCode.F10, KeyCode.LeftControl),
                "Copy an RFG1: code to paste into the website." + keyHint);
            DumpKey = Config.Bind(keys, "Write data dump", new KeyboardShortcut(KeyCode.F10, KeyCode.LeftControl, KeyCode.LeftShift),
                "Write game data (items, prices, monsters, spawn curves) to BepInEx/config/RepoFieldGuide.dump.json." + keyHint);

            Tracker = new Tracker();
            panel = new Panel();
            Patches.Apply(new Harmony(Guid));

            if (LiveLink.Value) StartServer();
            LiveLink.SettingChanged += (_, __) => { if (LiveLink.Value) StartServer(); else StopServer(); };
            Port.SettingChanged += (_, __) => { if (LiveLink.Value) { StopServer(); StartServer(); } };

            Log.LogInfo($"{Name} {Version} loaded (read-only).");
        }

        private void StartServer(bool quiet = false)
        {
            StopServer();
            server = new LocalServer(Port.Value, () => AllowedOrigins.Value) { Quiet = quiet };
            server.Start();
        }

        private void StopServer()
        {
            server?.Stop();
            server = null;
        }

        private void Update()
        {
            try
            {
                Tracker.Tick();

                // If the port was busy (e.g. another program), keep retrying quietly.
                if (LiveLink.Value && (server == null || !server.Running) && Time.unscaledTime >= nextServerRetry)
                {
                    nextServerRetry = Time.unscaledTime + 5f;
                    StartServer(quiet: true);
                }

                if (Time.unscaledTime >= nextSnapshot)
                {
                    nextSnapshot = Time.unscaledTime + 0.5f;
                    var json = Snapshot.BuildJson(Tracker);
                    if (server != null) server.Latest = json;
                    panel.LatestJsonLength = json.Length;
                }

                if (PanelKey.Value.IsDown()) panel.Visible = !panel.Visible;
                if (CopyCodeKey.Value.IsDown())
                {
                    GUIUtility.systemCopyBuffer = ShareCode.Encode(Snapshot.BuildJson(Tracker));
                    panel.Toast("Game code copied. Paste it into the Field Guide website.");
                }
                if (DumpKey.Value.IsDown())
                {
                    var path = DataDump.Write();
                    panel.Toast(path != null ? "Data dump written: " + path : "Data dump failed, see the BepInEx log.");
                }
            }
            catch (Exception e)
            {
                // Never let the companion break the game loop.
                Log.LogError("Update error: " + e);
            }
        }

        private void OnGUI() => panel.Draw(Tracker, server);

        private void OnDestroy() => StopServer();
    }
}
