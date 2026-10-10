using System;
using System.IO;

namespace Sistema_calibracao
{
    public static class Diagnostics
    {
        private static readonly object _lock = new object();

        private static string Path_ => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Ribdim", "host.log");

        private const long LIMIT_BYTES = 256 * 1024;

        public static void Log(string text)
        {
            // The app's name on every line. One log file serves every add-in
            // loaded in the Excel session, and with two apps open the lines
            // interleave — without this there is no way to tell whose they are,
            // which is precisely the situation the log is needed for.
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff")
                + "  [MetroCal] " + text + Environment.NewLine;

            lock (_lock)
            {
                Rotate();

                for (int attempt = 0; attempt < 5; attempt++)
                {
                    try
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(Path_));
                        File.AppendAllText(Path_, line);
                        return;
                    }
                    catch (IOException)
                    {
                        System.Threading.Thread.Sleep(20 * (attempt + 1));
                    }
                    catch
                    {
                        return; // a failing log must never take the add-in down
                    }
                }
            }
        }

        private static void Rotate()
        {
            try
            {
                var info = new FileInfo(Path_);
                if (!info.Exists || info.Length < LIMIT_BYTES) return;

                string previous = Path_ + ".previous";
                if (File.Exists(previous)) File.Delete(previous);
                File.Move(Path_, previous);
            }
            catch
            {
            }
        }
    }
}
