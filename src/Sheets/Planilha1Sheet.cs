using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao.Sheets
{
    // Code for one sheet, found by reflection and matched to the tab by SheetName.
    // This runs whether or not the panel is open.
    public class Planilha1Sheet : SheetHandler
    {
        public override string SheetName => "Planilha1";

        public override void OnChange(Excel.Range target)
        {
            Diagnostics.Log(SheetName + " changed at " +
                target.Address[false, false, Excel.XlReferenceStyle.xlA1]);
        }

        public override void OnSelectionChange(Excel.Range target)
        {
        }

        public override void OnActivate()
        {
        }
    }
}
