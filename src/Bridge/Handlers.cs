using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Text;
using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao.Bridge
{
    public partial class ExcelBridge
    {
        // Add your own actions here. Register("name", data => ...) is reached from the
        // page as bridge.call('name', data).
        public void RegisterDefaultHandlers()
        {
            Register("listSheets", d =>
            {
                var names = new List<string>();
                foreach (Excel.Worksheet ws in _workbook.Worksheets) names.Add(ws.Name);
                return names;
            });

            Register("readSelection", d =>
            {
                // The selection belongs to Excel, not to a workbook, so it is
                // the one place the app's own file has to be in front for the
                // answer to mean anything. Answering with another workbook's
                // selection would be worse than answering with nothing.
                if (!IsInFront()) return null;

                Excel.Range range = _excel.Selection as Excel.Range;
                if (range == null) return null;
                return new
                {
                    address = range.Address[false, false, Excel.XlReferenceStyle.xlA1],
                    sheet = ((Excel.Worksheet)range.Worksheet).Name,
                    value = range.Cells.Count == 1 ? range.Value2 : null,
                    rows = range.Rows.Count,
                    columns = range.Columns.Count
                };
            });

            Register("writeCell", d =>
            {
                Excel.Worksheet ws = Sheet((string)d["sheet"]);
                ws.Range[(string)d["address"]].Value2 = ValueOf(d["value"]);
                return new { ok = true };
            });

            Register("readRange", d =>
            {
                Excel.Worksheet ws = Sheet((string)d["sheet"]);
                return ToMatrix(ws.Range[(string)d["address"]].Value2);
            });

            Register("writeRange", d =>
            {
                Excel.Worksheet ws = Sheet((string)d["sheet"]);
                var rows = (JArray)d["rows"];

                int rowCount = rows == null ? 0 : rows.Count;
                int columnCount = rowCount == 0 ? 0 : ((JArray)rows[0]).Count;
                if (rowCount == 0 || columnCount == 0) return new { written = 0 };

                var matrix = new object[rowCount, columnCount];
                for (int i = 0; i < rowCount; i++)
                {
                    var row = (JArray)rows[i];
                    for (int j = 0; j < columnCount && j < row.Count; j++) matrix[i, j] = ValueOf(row[j]);
                }

                Excel.Range target = ws.Range[(string)d["address"]].Resize[rowCount, columnCount];
                target.Value2 = matrix;
                return new { written = rowCount };
            });

            Register("addSheet", d =>
            {
                Excel.Workbook wb = _workbook;
                Excel.Sheets sheets = wb.Worksheets;

                var added = (Excel.Worksheet)sheets.Add(
                    Type.Missing, sheets[sheets.Count], 1, Excel.XlSheetType.xlWorksheet);

                string wanted = (string)d["name"];
                if (!string.IsNullOrEmpty(wanted)) added.Name = UniqueSheetName(wb, wanted);

                return new { name = added.Name };
            });

            Register("usedRange", d =>
            {
                Excel.Worksheet ws = Sheet((string)d["sheet"]);
                Excel.Range used = ws.UsedRange;
                return new
                {
                    sheet = ws.Name,
                    address = used.Address[false, false, Excel.XlReferenceStyle.xlA1],
                    rows = used.Rows.Count,
                    columns = used.Columns.Count
                };
            });

            Register("selectRange", d =>
            {
                Excel.Worksheet ws = Sheet((string)d["sheet"]);
                ws.Activate();

                Excel.Range range = ws.Range[(string)d["address"]];
                range.Select();

                return new
                {
                    sheet = ws.Name,
                    address = range.Address[false, false, Excel.XlReferenceStyle.xlA1]
                };
            });

            Register("setFill", d =>
            {
                Excel.Range range = Sheet((string)d["sheet"]).Range[(string)d["address"]];
                string color = (string)d["color"];

                if (string.IsNullOrEmpty(color))
                    range.Interior.ColorIndex = Excel.XlColorIndex.xlColorIndexNone;
                else
                    range.Interior.Color = OleColor(color);

                return new { ok = true };
            });

            Register("setFont", d =>
            {
                Excel.Range range = Sheet((string)d["sheet"]).Range[(string)d["address"]];
                Excel.Font font = range.Font;

                if (d["bold"] != null) font.Bold = (bool)d["bold"];
                if (d["italic"] != null) font.Italic = (bool)d["italic"];
                if (d["size"] != null) font.Size = (double)d["size"];
                if (d["color"] != null) font.Color = OleColor((string)d["color"]);

                return new { ok = true };
            });

            Register("autofitColumns", d =>
            {
                Excel.Worksheet ws = Sheet((string)d["sheet"]);
                string address = (string)d["address"];

                Excel.Range target = string.IsNullOrEmpty(address)
                    ? ws.UsedRange
                    : ws.Range[address];

                target.Columns.AutoFit();
                return new { ok = true };
            });
        }

        private static string UniqueSheetName(Excel.Workbook workbook, string wanted)
        {
            var clean = new StringBuilder();
            foreach (char c in wanted)
                clean.Append(":\\/?*[]".IndexOf(c) >= 0 ? ' ' : c);

            string name = clean.ToString().Trim();
            if (name.Length == 0) name = "Sheet";
            if (name.Length > 31) name = name.Substring(0, 31);

            string candidate = name;
            for (int i = 2; Exists(workbook, candidate); i++)
            {
                string suffix = " " + i;
                candidate = name.Length + suffix.Length > 31
                    ? name.Substring(0, 31 - suffix.Length) + suffix
                    : name + suffix;
            }
            return candidate;
        }

        private static bool Exists(Excel.Workbook workbook, string name)
        {
            foreach (Excel.Worksheet ws in workbook.Worksheets)
                if (string.Equals(ws.Name, name, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}
