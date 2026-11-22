using System;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace RepoFieldGuide.Companion
{
    /// <summary>
    /// Copy code format: "RFG1:" + base64url(raw DEFLATE(UTF-8 JSON)).
    /// The website decodes it with DecompressionStream("deflate-raw").
    /// </summary>
    internal static class ShareCode
    {
        public const string Prefix = "RFG1:";

        public static string Encode(string json)
        {
            var raw = Encoding.UTF8.GetBytes(json);
            using (var output = new MemoryStream())
            {
                using (var deflate = new DeflateStream(output, CompressionLevel.Optimal, leaveOpen: true))
                    deflate.Write(raw, 0, raw.Length);
                return Prefix + Convert.ToBase64String(output.ToArray()).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            }
        }

        public static string Decode(string code)
        {
            if (!code.StartsWith(Prefix)) throw new FormatException("Not an RFG1 code");
            var b64 = code.Substring(Prefix.Length).Replace('-', '+').Replace('_', '/');
            b64 = b64.PadRight(b64.Length + (4 - b64.Length % 4) % 4, '=');
            using (var input = new MemoryStream(Convert.FromBase64String(b64)))
            using (var deflate = new DeflateStream(input, CompressionMode.Decompress))
            using (var reader = new StreamReader(deflate, Encoding.UTF8))
                return reader.ReadToEnd();
        }
    }
}
