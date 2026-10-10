using Sistema_calibracao.Bridge;
using ExcelDna.Integration;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Windows.Forms;
using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao.UI
{
    public class PanelView : UserControl
    {
        private const string VIRTUAL_HOST = "app.local";

        private readonly WebView2 _webView = new WebView2 { Dock = DockStyle.Fill };
        private readonly WorkbookPayload.Content _payload;
        private ExcelBridge _bridge;

        // The workbook this app came out of, decided by the ribbon before the
        // panel exists. Everything below reads and writes through it and never
        // through Excel's active workbook, which with a second app open is
        // regularly somebody else's file.
        private Excel.Workbook _workbook;

        // Ribbon clicks that arrived before the page had window.bridge.
        private readonly List<KeyValuePair<string, string>> _pendingActions =
            new List<KeyValuePair<string, string>>();
        private bool _pageReady;

        public PanelView(WorkbookPayload.Content payload, Excel.Workbook workbook)
        {
            _payload = payload;
            _workbook = workbook;

            ((ISupportInitialize)_webView).BeginInit();
            Controls.Add(_webView);
            ((ISupportInitialize)_webView).EndInit();

            Load += delegate { StartWebView(); };
        }

        /// <summary>The owning workbook's path, for the cache key. Empty is fine.</summary>
        private string WorkbookPath()
        {
            try { return _workbook == null ? "" : _workbook.FullName; }
            catch { return ""; }
        }

        private string Caption
        {
            get { return _payload.Get("WINDOW_TITLE", _payload.Get("APP_NAME", "MetroCal")); }
        }

        private async void StartWebView()
        {
            try
            {
                WebView2Native.Ensure(_payload);

                string version = null;
                try { version = CoreWebView2Environment.GetAvailableBrowserVersionString(); }
                catch (WebView2RuntimeNotFoundException) { version = null; }

                if (string.IsNullOrEmpty(version))
                {
                    Warn("The Microsoft Edge WebView2 runtime is not installed on this machine.\r\n\r\n" +
                         "Download the \"Evergreen Bootstrapper\" from:\r\n" +
                         "https://developer.microsoft.com/microsoft-edge/webview2/");
                    return;
                }

                CoreWebView2Environment environment = await WebViewFolder.CreateEnvironment(
                    _payload.Get("APP_NAME", "app"));

                await _webView.EnsureCoreWebView2Async(environment);

                string webFolder = WebCache.Materialize(_payload, WorkbookPath());
                if (webFolder == null)
                {
                    Warn("This workbook does not contain an embedded application.");
                    return;
                }

                // A virtual host rather than file://: under file:// the origin is opaque, and
                // fetch(), XHR and ES modules all fail on CORS.
                _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    VIRTUAL_HOST, webFolder, CoreWebView2HostResourceAccessKind.Allow);

                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

                _bridge = new ExcelBridge(_webView, (Excel.Application)ExcelDnaUtil.Application, _workbook);
                _bridge.RegisterDefaultHandlers();
                _bridge.RegisterFileHandlers();
                _bridge.Register("readConfig", delegate { return _payload.Config; });

                // This workbook's events, not the Application's. On the
                // Application they fire for every open file, so a second app
                // open meant this page being told about edits in somebody
                // else's workbook, with that workbook's sheet names.
                _workbook.SheetSelectionChange += OnSelectionChange;
                _workbook.SheetChange += OnSheetChange;
                _workbook.SheetActivate += OnSheetActivate;

                _webView.CoreWebView2.NavigationCompleted += delegate
                {
                    _pageReady = true;
                    FlushRibbonActions();
                };

                _webView.CoreWebView2.Navigate(
                    "https://" + VIRTUAL_HOST + "/" + _payload.Get("ENTRY_HTML", "index.html"));
            }
            catch (DllNotFoundException ex)
            {
                Diagnostics.Log("the WebView2 loader is missing: " + ex.Message);
                Warn("This application needs the Microsoft Edge WebView2 runtime, and it " +
                     "could not be started on this machine.\r\n\r\n" +
                     "Install the \"Evergreen Bootstrapper\" from:\r\n" +
                     "https://developer.microsoft.com/microsoft-edge/webview2/\r\n\r\n" +
                     "If it is already installed, updating Microsoft Office usually resolves it.");
            }
            catch (Exception ex)
            {
                Warn("Failed to start the WebView2:\r\n\r\n" + ex.Message);
            }
        }

        public void DeliverRibbonAction(string id, string tag)
        {
            _pendingActions.Add(new KeyValuePair<string, string>(id ?? "", tag ?? ""));
            if (_pageReady) FlushRibbonActions();
        }

        private void FlushRibbonActions()
        {
            if (_bridge == null) return;

            foreach (KeyValuePair<string, string> action in _pendingActions)
                Emit("ribbonAction", new { id = action.Key, tag = action.Value });

            _pendingActions.Clear();
        }

        private void OnSelectionChange(object sheet, Excel.Range target)
            => Emit("selectionChanged", new
            {
                sheet = ((Excel.Worksheet)sheet).Name,
                address = target.Address[false, false, Excel.XlReferenceStyle.xlA1]
            });

        private void OnSheetChange(object sheet, Excel.Range target)
            => Emit("sheetChanged", new
            {
                sheet = ((Excel.Worksheet)sheet).Name,
                address = target.Address[false, false, Excel.XlReferenceStyle.xlA1]
            });

        private void OnSheetActivate(object sheet)
            => Emit("sheetActivated", new { sheet = ((Excel.Worksheet)sheet).Name });

        private void Emit(string name, object data)
        {
            if (_bridge == null) return;
            try
            {
                _bridge.Emit(name, data);
            }
            catch
            {
                // A dropped UI event does not justify taking Excel down.
            }
        }

        // Lets go of the workbook before the control goes. A handler left attached
        // fires into a disposed WebView2 on the next edit.
        protected override void Dispose(bool disposing)
        {
            if (disposing && _workbook != null)
            {
                try
                {
                    _workbook.SheetSelectionChange -= OnSelectionChange;
                    _workbook.SheetChange -= OnSheetChange;
                    _workbook.SheetActivate -= OnSheetActivate;
                }
                catch
                {
                    // Excel may already be shutting down.
                }
                _workbook = null;
            }

            base.Dispose(disposing);
        }

        private void Warn(string message)
            => MessageBox.Show(this, message, Caption, MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
}
