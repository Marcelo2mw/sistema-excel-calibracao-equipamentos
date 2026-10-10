using ExcelDna.Integration;

namespace Sistema_calibracao
{
    public class AddIn : IExcelAddIn
    {
        public void AutoOpen()
        {
            Diagnostics.Log("add-in loaded");

            // Probing turns a silent load failure into a line in the log.
            Probe("Newtonsoft.Json", () => typeof(Newtonsoft.Json.Linq.JArray));
            Probe("WebView2", () => typeof(Microsoft.Web.WebView2.WinForms.WebView2));
            Probe("Interop.Excel", () => typeof(Microsoft.Office.Interop.Excel.Application));

            Sheets.SheetEvents.Attach();
        }

        private static void Probe(string name, System.Func<System.Type> get)
        {
            try { get(); }
            catch (System.Exception ex)
            {
                Diagnostics.Log("MISSING DEPENDENCY: " + name + " -> " + ex.GetType().Name + ": " + ex.Message);
            }
        }

        public void AutoClose()
        {
            Sheets.SheetEvents.Detach();
        }
    }
}
