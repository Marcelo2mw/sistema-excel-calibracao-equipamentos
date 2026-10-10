using ExcelDna.Integration;
using System;

namespace Sistema_calibracao
{
    /// <summary>
    /// The way in from a ribbon that lives inside the workbook.
    ///
    /// A ribbon published by the add-in belongs to the Excel session: it shows
    /// in every window, for every file open alongside. A ribbon that lives in
    /// the workbook shows only with that workbook — which is what an app wants —
    /// but Excel resolves its callbacks as **VBA macros in that workbook**,
    /// never as methods here. The workbook's own VBA forwards them through this.
    ///
    /// The exported name carries the app's, because macro names are unique
    /// across the Excel session and two apps open at once would otherwise
    /// register the same one.
    /// </summary>
    public static class RibbonMacros
    {
        /// <summary>
        /// The plain open button.
        ///
        /// Two macros rather than one with a flag: a click that has crossed into
        /// VBA and back has lost everything except which name was called, and
        /// the open button and a tagged button do different things — one toggles
        /// the panel, the other shows it and hands the click to the page.
        /// </summary>
        [ExcelCommand(Name = "MetroCal_RibbonToggle")]
        public static void RibbonToggle()
        {
            try
            {
                Diagnostics.Log("macro RibbonToggle");
                Ribbon.Toggle();
            }
            catch (Exception ex)
            {
                // A macro that throws reaches the user as Excel's own error
                // dialog, with nothing in it that names this app.
                Diagnostics.Log("RibbonToggle failed: " + ex);
            }
        }

        /// <summary>A button with a tag, on its way to the page.</summary>
        [ExcelCommand(Name = "MetroCal_RibbonAction")]
        public static void RibbonAction(string id, string tag)
        {
            try
            {
                Diagnostics.Log("macro RibbonAction id=" + id + " tag=" + tag);
                Ribbon.Dispatch(id, tag);
            }
            catch (Exception ex)
            {
                Diagnostics.Log("RibbonAction failed: " + ex);
            }
        }
    }
}
