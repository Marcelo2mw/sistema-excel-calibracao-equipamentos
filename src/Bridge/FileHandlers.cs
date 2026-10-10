using Newtonsoft.Json.Linq;
using System;
using System.IO;

namespace Sistema_calibracao.Bridge
{
    public partial class ExcelBridge
    {
        // Photos and certificate PDFs are too big for worksheet cells. They live
        // as files in an "arquivos" folder next to the workbook, and the sheets
        // store only the file name. The page sends and receives base64; the
        // workbook has to have been saved at least once, otherwise there is no
        // folder to anchor to.
        //
        // Requires a build. Until then every call rejects with "unknown action"
        // and the page falls back to embedding the bytes in the Arquivos sheet.
        public void RegisterFileHandlers()
        {
            Register("fileSave", d =>
            {
                string name = SafeName((string)d["name"]);
                byte[] bytes = Convert.FromBase64String((string)d["base64"]);
                File.WriteAllBytes(Path.Combine(FilesDir(), name), bytes);
                return new { name = name, bytes = bytes.Length };
            });

            Register("fileRead", d =>
            {
                string path = Path.Combine(FilesDir(), SafeName((string)d["name"]));
                if (!File.Exists(path)) return null;
                return new
                {
                    base64 = Convert.ToBase64String(File.ReadAllBytes(path)),
                    bytes = new FileInfo(path).Length
                };
            });

            Register("fileOpen", d =>
            {
                string name = SafeName((string)d["name"]);
                string path = Path.Combine(FilesDir(), name);
                if (!File.Exists(path)) throw new FileNotFoundException("Arquivo não encontrado: " + name);
                System.Diagnostics.Process.Start(path);
                return new { ok = true };
            });

            Register("fileDelete", d =>
            {
                string path = Path.Combine(FilesDir(), SafeName((string)d["name"]));
                if (File.Exists(path)) File.Delete(path);
                return new { ok = true };
            });

            Register("fileList", d =>
            {
                var names = new System.Collections.Generic.List<string>();
                string dir = FilesDir();
                foreach (string path in Directory.GetFiles(dir)) names.Add(Path.GetFileName(path));
                return names;
            });
        }

        private string FilesDir()
        {
            string root = _workbook.Path;
            if (string.IsNullOrEmpty(root))
                throw new InvalidOperationException(
                    "Salve a pasta de trabalho uma vez antes de anexar arquivos.");

            string dir = Path.Combine(root, "arquivos");
            Directory.CreateDirectory(dir);
            return dir;
        }

        // The name comes from the page, so it is treated as hostile: only a
        // plain file name may ever reach the disk, never a path.
        private static string SafeName(string name)
        {
            string clean = Path.GetFileName((name ?? "").Trim());
            if (clean.Length == 0) throw new ArgumentException("Nome de arquivo vazio.");
            return clean;
        }
    }
}
