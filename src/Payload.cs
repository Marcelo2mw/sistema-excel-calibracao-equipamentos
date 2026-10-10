using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

namespace Sistema_calibracao
{
    public static class WorkbookPayload
    {
        private sealed class Entry
        {
            public Content Content;
            public DateTime Written;
        }

        private static readonly Dictionary<string, Entry> _cache =
            new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase);

        public sealed class Content
        {
            public Dictionary<string, string> Web { get; } =
                new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            public Dictionary<string, string> Config { get; } =
                new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            public string Stamp { get; set; } = "";

            public string RibbonXml { get; set; } = "";

            public string LoaderBase64 { get; set; } = "";

            public byte[] LoaderBytes()
            {
                if (string.IsNullOrWhiteSpace(LoaderBase64)) return null;
                try { return Convert.FromBase64String(LoaderBase64.Trim()); }
                catch (Exception ex)
                {
                    Diagnostics.Log("the embedded WebView2 loader is unreadable: " + ex.Message);
                    return null;
                }
            }

            public bool Exists => Web.Count > 0;

            public string Get(string key, string fallback = "")
                => Config.TryGetValue(key, out string v) && !string.IsNullOrEmpty(v) ? v : fallback;
        }

        // Read through the Excel object model, never by unzipping the file: the workbook
        // is open, and the copy on disk is not the one Excel is showing.
        public static Content Read(dynamic workbook)
        {
            if (workbook == null) return new Content();

            string key;
            try { key = (string)workbook.FullName; }
            catch { return new Content(); }

            DateTime written = WriteDate(key);

            lock (_cache)
            {
                if (_cache.TryGetValue(key, out Entry cached) && cached.Written == written)
                    return cached.Content;
            }

            var output = new Content();
            var seen = new List<string>();
            try
            {
                foreach (dynamic part in workbook.CustomXMLParts)
                {
                    dynamic root = part.DocumentElement;
                    if (root == null) continue;

                    string name = (string)root.BaseName;
                    seen.Add(name);

                    switch (name)
                    {
                        case "appPackage":
                            ReadWeb((string)root.Text, output.Web);
                            break;
                        case "appConfig":
                            ReadConfig((string)root.Text, output.Config);
                            break;
                        case "appRibbon":
                            output.RibbonXml = ((string)root.Text).Trim();
                            break;
                        case "appLoader_x64":
                            if (IntPtr.Size == 8) output.LoaderBase64 = (string)root.Text;
                            break;
                        case "appLoader_x86":
                            if (IntPtr.Size == 4) output.LoaderBase64 = (string)root.Text;
                            break;
                        case "appStamp":
                            output.Stamp = ((string)root.Text).Trim();
                            break;
                    }
                }
            }
            catch (Exception ex)
            {
                Diagnostics.Log("failed to read the payload (parts seen: " +
                    string.Join(", ", seen) + "): " + ex);
                return new Content();
            }

            Diagnostics.Log("payload read from " + key +
                " | parts: " + (seen.Count == 0 ? "(none)" : string.Join(", ", seen)) +
                " | web: " + output.Web.Count +
                " | config: " + output.Config.Count);

            lock (_cache) _cache[key] = new Entry { Content = output, Written = written };
            return output;
        }

        private static DateTime WriteDate(string path)
        {
            try { return File.GetLastWriteTimeUtc(path); }
            catch { return DateTime.MinValue; }
        }

        private static void ReadWeb(string base64, Dictionary<string, string> target)
        {
            string json = InflateText(base64);
            if (json.Length == 0) return;

            foreach (JToken item in JArray.Parse(json))
            {
                string path = (string)item["path"];
                if (!string.IsNullOrEmpty(path)) target[path] = (string)item["text"] ?? "";
            }
        }

        private static void ReadConfig(string text, Dictionary<string, string> target)
        {
            foreach (string raw in text.Split('\n'))
            {
                string line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#")) continue;

                int equals = line.IndexOf('=');
                if (equals <= 0) continue;

                target[line.Substring(0, equals).Trim()] = line.Substring(equals + 1).Trim();
            }
        }

        private static string InflateText(string base64)
        {
            if (string.IsNullOrWhiteSpace(base64)) return "";
            try
            {
                byte[] compressed = Convert.FromBase64String(base64.Trim());
                using (var input = new MemoryStream(compressed))
                using (var gzip = new GZipStream(input, CompressionMode.Decompress))
                using (var output = new MemoryStream())
                {
                    gzip.CopyTo(output);
                    return Encoding.UTF8.GetString(output.ToArray());
                }
            }
            catch (Exception ex)
            {
                Diagnostics.Log("appPackage unreadable: " + ex.Message);
                return "";
            }
        }
    }

    public static class WebCache
    {
        private const string MARKER = ".stamp";

        /// <summary>
        /// The folder this workbook's front-end is extracted into.
        ///
        /// The stamp when there is one. Without it this used to be the literal
        /// "no-stamp", shared by every workbook that lacked the part — and the
        /// extraction below deletes the folder before writing, so one app wiped
        /// another app's pages while its WebView2 was serving from them. The
        /// workbook's own path is the fallback because it is the one thing that
        /// is certainly not shared.
        /// </summary>
        private static string Key(WorkbookPayload.Content payload, string workbookPath)
        {
            if (!string.IsNullOrEmpty(payload.Stamp)) return payload.Stamp;

            string path = workbookPath ?? "";
            using (var sha = SHA256.Create())
            {
                byte[] digest = sha.ComputeHash(Encoding.UTF8.GetBytes(path.ToLowerInvariant()));
                var hex = new StringBuilder("path-", 21);
                for (int i = 0; i < 8; i++) hex.Append(digest[i].ToString("x2"));
                return hex.ToString();
            }
        }

        public static string Materialize(WorkbookPayload.Content payload, string workbookPath)
        {
            if (!payload.Exists) return null;

            string key = Key(payload, workbookPath);
            string folder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Ribdim", "apps", Sanitize(key));

            string marker = Path.Combine(folder, MARKER);
            if (File.Exists(marker) && File.ReadAllText(marker) == key) return folder;

            if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
            Directory.CreateDirectory(folder);

            foreach (var file in payload.Web)
            {
                string target = Path.GetFullPath(Path.Combine(folder, file.Key));
                if (!target.StartsWith(folder, StringComparison.OrdinalIgnoreCase)) continue;

                Directory.CreateDirectory(Path.GetDirectoryName(target));
                File.WriteAllText(target, file.Value, new UTF8Encoding(false));
            }

            File.WriteAllText(marker, key);
            return folder;
        }

        private static string Sanitize(string text)
        {
            var sb = new StringBuilder(text.Length);
            foreach (char c in text)
                sb.Append(char.IsLetterOrDigit(c) ? c : '-');
            return sb.ToString();
        }
    }
}
