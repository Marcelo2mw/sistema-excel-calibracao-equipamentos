using Sistema_calibracao.UI;
using ExcelDna.Integration;
using ExcelDna.Integration.CustomUI;
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security;
using System.Windows.Forms;
using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao
{
    [ComVisible(true)]
    public class Ribbon : ExcelRibbon
    {
        // One panel per workbook. The ribbon is global, so a single field made the second
        // app button bring up the first one panel.
        private static readonly Dictionary<string, PanelForm> _panels =
            new Dictionary<string, PanelForm>(StringComparer.OrdinalIgnoreCase);

        private const string IMAGE_PREFIX = "MetroCal.images.";

        // Nothing. The ribbon of a built app lives in the workbook.
        //
        // A tab published from here belongs to the Excel session and shows in
        // every window, for every file open alongside — which is how add-ins
        // work and not what an app wants. The export writes the ribbon into the
        // workbook's own customUI part instead, where Excel shows it only while
        // that file is active, and its buttons arrive through the bootstrap's
        // VBA and RibbonMacros.
        //
        // The built-in add-in still answers this, which is why a workbook
        // exported without a Build keeps the old, session-wide tab.
        public override string GetCustomUI(string ribbonId)
        {
            Diagnostics.Log("GetCustomUI(" + ribbonId + ") - the ribbon is in the workbook");
            return null;
        }

        public void OnClick(IRibbonControl control) => OpenPanel();

        public void OnRibbonAction(IRibbonControl control)
        {
            PanelForm panel = OpenPanel();
            if (panel == null) return;

            string id = control == null ? "" : control.Id;
            string tag = control == null ? "" : control.Tag;

            Diagnostics.Log("ribbonAction id=" + id + " tag=" + tag);
            panel.DeliverRibbonAction(id, tag);
        }

        /// <summary>
        /// The plain open button, reached from the workbook's own ribbon through
        /// the VBA — see RibbonMacros.
        ///
        /// Opens the window, or brings the open one to the front. It does not
        /// close it on a second click, unlike the docked shape: a window has its
        /// own close button, and a button that shut it from across the ribbon
        /// would be a surprise.
        /// </summary>
        public static void Toggle()
        {
            OpenPanel();
        }

        /// <summary>
        /// A button with a tag: open the window if needed and hand the click to
        /// the page. Reached the same way as Toggle.
        /// </summary>
        public static void Dispatch(string id, string tag)
        {
            PanelForm panel = OpenPanel();
            if (panel == null) return;

            Diagnostics.Log("ribbonAction id=" + id + " tag=" + tag);
            panel.DeliverRibbonAction(id ?? "", tag ?? "");
        }

        public override object LoadImage(string imageId)
        {
            try
            {
                Stream stream = Assembly.GetExecutingAssembly()
                    .GetManifestResourceStream(IMAGE_PREFIX + imageId);

                if (stream == null)
                {
                    Diagnostics.Log("no picture embedded for image=\"" + imageId + "\"");
                    return null;
                }

                // The stream is deliberately not disposed: GDI+ reads it lazily, and a closed one
                // fails while Office is painting the ribbon.
                return PictureConverter.ToPictureDisp(System.Drawing.Image.FromStream(stream));
            }
            catch (Exception ex)
            {
                Diagnostics.Log("LoadImage(" + imageId + ") failed: " + ex);
                return null;
            }
        }

        private static PanelForm OpenPanel()
        {
            try
            {
                // This app's workbook, not whichever one is in front. With two
                // apps open there are two add-ins answering OnClick, and the
                // active one is very often the other app's.
                Excel.Workbook wb = AppIdentity.OwnWorkbook();

                if (wb == null)
                {
                    MessageBox.Show("This app's workbook is not open.",
                        "MetroCal", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return null;
                }

                WorkbookPayload.Content payload = WorkbookPayload.Read(wb);

                if (!payload.Exists)
                {
                    MessageBox.Show("This workbook does not contain an embedded application.",
                        "MetroCal", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return null;
                }

                string key = wb.FullName;

                if (_panels.TryGetValue(key, out PanelForm existing) && !existing.IsDisposed)
                {
                    if (existing.WindowState == FormWindowState.Minimized)
                        existing.WindowState = FormWindowState.Normal;
                    existing.Activate();
                    return existing;
                }

                var panel = new PanelForm(payload, wb);
                panel.FormClosed += delegate { _panels.Remove(key); };
                _panels[key] = panel;
                panel.Show(new ExcelWindow());
                return panel;
            }
            catch (Exception ex)
            {
                Diagnostics.Log("failed to open the panel: " + ex);
                MessageBox.Show("Could not open the panel:\r\n" + ex.Message,
                    "MetroCal", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return null;
            }
        }

        private class ExcelWindow : IWin32Window
        {
            public IntPtr Handle
            {
                get { return new IntPtr(((Excel.Application)ExcelDnaUtil.Application).Hwnd); }
            }
        }

        private class PictureConverter : AxHost
        {
            private PictureConverter() : base(string.Empty) { }

            public static object ToPictureDisp(System.Drawing.Image image)
            {
                return GetIPictureDispFromPicture(image);
            }
        }
    }
}
