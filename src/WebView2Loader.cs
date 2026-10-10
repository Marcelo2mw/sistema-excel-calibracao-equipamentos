using System;
using System.IO;
using System.Runtime.InteropServices;

namespace Sistema_calibracao
{
    internal static class WebView2Native
    {
        private const string DLL = "WebView2Loader.dll";

        private static bool _done;

        public static void Ensure(WorkbookPayload.Content payload)
        {
            if (_done) return;
            _done = true;

            try
            {
                if (LoadLibrary(DLL) != IntPtr.Zero)
                {
                    Diagnostics.Log("WebView2Loader.dll came from the system search path");
                    return;
                }

                byte[] bytes = payload.LoaderBytes();
                if (bytes == null || bytes.Length == 0)
                {
                    Diagnostics.Log("WebView2Loader.dll is missing and the workbook carries no copy");
                    return;
                }

                string path = Materialize(bytes);
                if (path == null) return;

                IntPtr handle = LoadLibrary(path);
                Diagnostics.Log(handle != IntPtr.Zero
                    ? "WebView2Loader.dll loaded from the workbook's own copy at " + path
                    : "the workbook's WebView2Loader.dll failed to load, error " +
                      Marshal.GetLastWin32Error());
            }
            catch (Exception ex)
            {
                Diagnostics.Log("could not prepare WebView2Loader.dll: " + ex.Message);
            }
        }

        private static string Materialize(byte[] bytes)
        {
            string folder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Ribdim", "webview2", bytes.Length.ToString());

            string path = Path.Combine(folder, DLL);
            if (File.Exists(path) && new FileInfo(path).Length == bytes.Length) return path;

            try
            {
                Directory.CreateDirectory(folder);

                string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
                File.WriteAllBytes(temporary, bytes);

                if (File.Exists(path)) File.Delete(path);
                File.Move(temporary, path);
            }
            catch (IOException)
            {
                if (!File.Exists(path)) return null;
            }
            catch (UnauthorizedAccessException)
            {
                if (!File.Exists(path)) return null;
            }

            return path;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr LoadLibrary(string fileName);
    }
}
