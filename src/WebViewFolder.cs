using Microsoft.Web.WebView2.Core;
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace Sistema_calibracao.UI
{
    public static class WebViewFolder
    {
        private const uint ERROR_INVALID_STATE = 0x8007139F;
        private const string MARKER = ".last-used";

        private static readonly TimeSpan MaxAge = TimeSpan.FromDays(30);

        // The folder cannot sit next to EXCEL.EXE, which is not writable, and two
        // processes cannot share one.
        public static async Task<CoreWebView2Environment> CreateEnvironment(string appName)
        {
            string root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Ribdim", "WebView2");

            string preferred = Path.Combine(root, Sanitize(appName));

            Sweep(root, keep: preferred);

            try
            {
                return await Open(preferred);
            }
            catch (Exception ex) when (IsContended(ex))
            {
                string perProcess = preferred + ".session-" + Process.GetCurrentProcess().Id;
                Diagnostics.Log("WebView2 folder contended; using " + perProcess);
                return await Open(perProcess);
            }
        }

        private static async Task<CoreWebView2Environment> Open(string folder)
        {
            Directory.CreateDirectory(folder);
            Mark(folder);
            return await CoreWebView2Environment.CreateAsync(null, folder);
        }

        private static bool IsContended(Exception ex)
            => unchecked((uint)ex.HResult) == ERROR_INVALID_STATE;

        private static void Mark(string folder)
        {
            try { File.WriteAllText(Path.Combine(folder, MARKER), DateTime.UtcNow.ToString("O")); }
            catch { /* the marker is a courtesy; it cannot stop the app opening */ }
        }

        private static void Sweep(string root, string keep)
        {
            try
            {
                if (!Directory.Exists(root)) return;

                foreach (string folder in Directory.GetDirectories(root))
                {
                    if (string.Equals(folder, keep, StringComparison.OrdinalIgnoreCase)) continue;

                    if (IsSession(folder, out int pid))
                    {
                        if (!ProcessAlive(pid)) Discard(folder, "orphaned session");
                        continue;
                    }

                    if (DateTime.UtcNow - LastUsed(folder) > MaxAge)
                        Discard(folder, "unused for more than " + MaxAge.TotalDays + " days");
                }
            }
            catch
            {
            }
        }

        private static bool IsSession(string folder, out int pid)
        {
            pid = 0;
            int cut = folder.LastIndexOf(".session-", StringComparison.Ordinal);
            return cut >= 0 && int.TryParse(folder.Substring(cut + ".session-".Length), out pid);
        }

        private static bool ProcessAlive(int pid)
        {
            try { Process.GetProcessById(pid); return true; }
            catch (ArgumentException) { return false; }
            catch { return true; } // when in doubt, do not delete
        }

        private static DateTime LastUsed(string folder)
        {
            try
            {
                string marker = Path.Combine(folder, MARKER);
                if (File.Exists(marker) &&
                    DateTime.TryParse(File.ReadAllText(marker), null,
                        System.Globalization.DateTimeStyles.RoundtripKind, out DateTime when))
                {
                    return when;
                }

                return Directory.GetLastWriteTimeUtc(folder);
            }
            catch
            {
                return DateTime.UtcNow; // when in doubt, do not delete
            }
        }

        private static void Discard(string folder, string reason)
        {
            try
            {
                Directory.Delete(folder, recursive: true);
                Diagnostics.Log("WebView2 folder removed (" + reason + "): " + Path.GetFileName(folder));
            }
            catch
            {
            }
        }

        private static string Sanitize(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return "app";

            var sb = new StringBuilder(text.Length);
            foreach (char c in text)
                sb.Append(char.IsLetterOrDigit(c) ? c : '-');

            string output = sb.ToString().Trim('-');
            return output.Length == 0 ? "app" : output;
        }
    }
}
