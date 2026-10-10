using ExcelDna.Integration;
using System;
using System.IO;
using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao
{
    /// <summary>
    /// Which workbook this add-in belongs to.
    ///
    /// Every entry point used to ask Excel for the *active* workbook, which is
    /// right while one app is open and wrong the moment a second one is: two
    /// workbooks mean two add-ins loaded in one Excel, both answering OnClick,
    /// and the panel would take its shape from the add-in that was clicked and
    /// its content from whatever file happened to be in front.
    /// </summary>
    public static class AppIdentity
    {
        private static string _stamp;

        /// <summary>
        /// This add-in's own stamp.
        ///
        /// The VBA extracts the add-in to
        /// %LOCALAPPDATA%\Ribdim\host\&lt;stamp&gt;\RibdimAppHost.xll and registers it
        /// from there, so the folder we were loaded from names the export we
        /// belong to — and the workbook carries that same stamp in its appStamp
        /// part. It is the only thing that survives RegisterXLL.
        /// </summary>
        public static string OwnStamp
        {
            get
            {
                if (_stamp != null) return _stamp;

                try
                {
                    string folder = Path.GetDirectoryName(ExcelDnaUtil.XllPath);
                    _stamp = string.IsNullOrEmpty(folder) ? "" : Path.GetFileName(folder);
                }
                catch (Exception ex)
                {
                    Diagnostics.Log("could not read this add-in's own path: " + ex.Message);
                    _stamp = "";
                }

                return _stamp;
            }
        }

        /// <summary>
        /// Whether a workbook is the one this add-in came out of.
        ///
        /// By stamp when both sides have one, which also tells two exports of
        /// the same app apart. The fallback is the app name, the same comparison
        /// SheetEvents has always made, for a workbook exported before the stamp
        /// existed.
        /// </summary>
        public static bool IsOwn(Excel.Workbook workbook)
        {
            if (workbook == null) return false;

            WorkbookPayload.Content payload = WorkbookPayload.Read(workbook);
            if (!payload.Exists) return false;

            string mine = OwnStamp;
            if (!string.IsNullOrEmpty(mine) && !string.IsNullOrEmpty(payload.Stamp))
                return string.Equals(payload.Stamp, mine, StringComparison.OrdinalIgnoreCase);

            return string.Equals(payload.Get("APP_NAME"), "MetroCal",
                StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// The workbook this add-in belongs to, or null when it is not open.
        ///
        /// The active workbook is tried first, and not as an optimization: two
        /// copies of the same exported file carry the same stamp, and the one
        /// the user is looking at is the one they meant.
        /// </summary>
        public static Excel.Workbook OwnWorkbook(Excel.Application excel)
        {
            if (excel == null) return null;

            try
            {
                Excel.Workbook active = excel.ActiveWorkbook;
                if (IsOwn(active)) return active;

                foreach (Excel.Workbook workbook in excel.Workbooks)
                {
                    if (IsOwn(workbook)) return workbook;
                }
            }
            catch (Exception ex)
            {
                Diagnostics.Log("could not find this app's workbook: " + ex.Message);
            }

            return null;
        }

        /// <summary>The workbook this add-in belongs to, through ExcelDnaUtil.</summary>
        public static Excel.Workbook OwnWorkbook()
        {
            try
            {
                return OwnWorkbook((Excel.Application)ExcelDnaUtil.Application);
            }
            catch (Exception ex)
            {
                Diagnostics.Log("Excel is not answering: " + ex.Message);
                return null;
            }
        }
    }
}
