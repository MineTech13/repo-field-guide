using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// Tiny read-only HTTP server on 127.0.0.1 only. Serves the latest snapshot at
    /// GET /state. Accepts no commands. Only websites in the allow-list get CORS
    /// access; anything else (other sites) can't read the response.
    /// </summary>
    internal sealed class LocalServer
    {
        private readonly int port;
        private readonly Func<string> allowedOrigins;
        private TcpListener listener;
        private Thread thread;
        private volatile bool running;

        public volatile string Latest = "{}";
        public volatile bool Running;
        public volatile int Requests;
        public string Error;
        public int Port => port;

        public LocalServer(int port, Func<string> allowedOrigins)
        {
            this.port = port;
            this.allowedOrigins = allowedOrigins;
        }

        public void Start()
        {
            try
            {
                listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                running = true;
                Running = true;
                thread = new Thread(Loop) { IsBackground = true, Name = "RepoFieldGuide.LocalServer" };
                thread.Start();
                Plugin.Log.LogInfo($"Live link on http://127.0.0.1:{port}/state");
            }
            catch (Exception e)
            {
                Error = e.Message;
                Running = false;
                Plugin.Log.LogWarning($"Live link could not start on port {port}: {e.Message}");
            }
        }

        public void Stop()
        {
            running = false;
            Running = false;
            try { listener?.Stop(); } catch { }
        }

        private void Loop()
        {
            while (running)
            {
                TcpClient client = null;
                try
                {
                    client = listener.AcceptTcpClient();
                    client.ReceiveTimeout = 2000;
                    client.SendTimeout = 2000;
                    Handle(client);
                }
                catch (Exception e)
                {
                    if (running) Plugin.Log.LogDebug("Live link request failed: " + e.Message);
                }
                finally
                {
                    try { client?.Close(); } catch { }
                }
            }
        }

        private void Handle(TcpClient client)
        {
            var stream = client.GetStream();
            var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, leaveOpen: true);
            var requestLine = reader.ReadLine();
            if (string.IsNullOrEmpty(requestLine)) return;

            string origin = null;
            string line;
            int headerCount = 0;
            while (!string.IsNullOrEmpty(line = reader.ReadLine()) && headerCount++ < 100)
            {
                int colon = line.IndexOf(':');
                if (colon > 0 && line.Substring(0, colon).Trim().Equals("Origin", StringComparison.OrdinalIgnoreCase))
                    origin = line.Substring(colon + 1).Trim();
            }

            var parts = requestLine.Split(' ');
            var method = parts.Length > 0 ? parts[0] : "";
            var path = parts.Length > 1 ? parts[1].Split('?')[0] : "/";
            Requests++;

            var cors = new StringBuilder();
            if (origin != null && IsAllowed(origin))
            {
                cors.Append("Access-Control-Allow-Origin: ").Append(origin).Append("\r\n");
                cors.Append("Vary: Origin\r\n");
                cors.Append("Access-Control-Allow-Methods: GET, OPTIONS\r\n");
                cors.Append("Access-Control-Allow-Headers: *\r\n");
                cors.Append("Access-Control-Allow-Private-Network: true\r\n");
            }

            if (method == "OPTIONS")
            {
                Write(stream, "204 No Content", cors.ToString(), null, null);
                return;
            }
            if (method != "GET")
            {
                Write(stream, "405 Method Not Allowed", cors.ToString(), "text/plain", "read-only");
                return;
            }

            switch (path)
            {
                case "/state":
                    Write(stream, "200 OK", cors.ToString(), "application/json", Latest);
                    break;
                case "/":
                case "/health":
                    Write(stream, "200 OK", cors.ToString(), "application/json",
                        "{\"ok\":true,\"name\":\"" + Plugin.Name + "\",\"version\":\"" + Plugin.Version + "\"}");
                    break;
                default:
                    Write(stream, "404 Not Found", cors.ToString(), "text/plain", "not found");
                    break;
            }
        }

        private bool IsAllowed(string origin)
        {
            foreach (var raw in (allowedOrigins() ?? "").Split(','))
            {
                var pattern = raw.Trim();
                if (pattern.Length == 0) continue;
                if (pattern == origin) return true;
                if (pattern.Contains("*"))
                {
                    // "https://*.example.dev" → one subdomain label
                    var regex = "^" + Regex.Escape(pattern).Replace("\\*", "[a-z0-9-]+") + "$";
                    if (Regex.IsMatch(origin, regex, RegexOptions.IgnoreCase)) return true;
                }
            }
            return false;
        }

        private static void Write(NetworkStream stream, string status, string extraHeaders, string contentType, string body)
        {
            var bytes = body == null ? new byte[0] : Encoding.UTF8.GetBytes(body);
            var header = new StringBuilder();
            header.Append("HTTP/1.1 ").Append(status).Append("\r\n");
            if (contentType != null) header.Append("Content-Type: ").Append(contentType).Append("; charset=utf-8\r\n");
            header.Append("Content-Length: ").Append(bytes.Length).Append("\r\n");
            header.Append("Cache-Control: no-store\r\n");
            header.Append("Connection: close\r\n");
            header.Append(extraHeaders);
            header.Append("\r\n");
            var h = Encoding.ASCII.GetBytes(header.ToString());
            stream.Write(h, 0, h.Length);
            if (bytes.Length > 0) stream.Write(bytes, 0, bytes.Length);
            stream.Flush();
        }
    }
}
