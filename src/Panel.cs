using System;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao.UI
{
    public class PanelForm : Form
    {
        private readonly PanelView _view;
        private readonly WorkbookPayload.Content _payload;

        public PanelForm(WorkbookPayload.Content payload, Excel.Workbook workbook)
        {
            _payload = payload;

            Text = payload.Get("WINDOW_TITLE", payload.Get("APP_NAME", "MetroCal"));
            Icon = AppIcon();
            ApplyWindow();

            // No BeginInit/EndInit here: that pair belongs to the WebView2 inside PanelView.
            _view = new PanelView(payload, workbook) { Dock = DockStyle.Fill };
            Controls.Add(_view);
        }

        public void DeliverRibbonAction(string id, string tag)
            => _view.DeliverRibbonAction(id, tag);

        private void ApplyWindow()
        {
            // The order matters: border before size, minimum before size, start position
            // before location, state last.
            FormBorderStyle = Choice(_payload.Get("WINDOW_BORDER", "Sizable"), FormBorderStyle.Sizable);

            MinimumSize = new Size(
                Pixels(_payload.Get("WINDOW_MIN_WIDTH", "640"), 640),
                Pixels(_payload.Get("WINDOW_MIN_HEIGHT", "420"), 420));

            ClientSize = new Size(
                Pixels(_payload.Get("WINDOW_WIDTH", "1000"), 1000),
                Pixels(_payload.Get("WINDOW_HEIGHT", "620"), 620));

            StartPosition = Choice(_payload.Get("WINDOW_START", "CenterScreen"), FormStartPosition.CenterScreen);

            if (StartPosition == FormStartPosition.Manual)
            {
                Location = new Point(Coordinate(_payload.Get("WINDOW_LEFT", "0")), Coordinate(_payload.Get("WINDOW_TOP", "0")));
                RescueFromOffScreen();
            }

            WindowState = Choice(_payload.Get("WINDOW_STATE", "Normal"), FormWindowState.Normal);
        }

        private const int SMALLEST_SIDE = 120;
        private const int LARGEST_SIDE = 20000;

        private static T Choice<T>(string text, T fallback) where T : struct
        {
            T value;
            // Enum.TryParse alone returns true for values that are not members, and WinForms
            // then throws inside the constructor. Enum.IsDefined is what refuses them.
            if (!string.IsNullOrWhiteSpace(text)
                && Enum.TryParse<T>(text.Trim(), true, out value)
                && Enum.IsDefined(typeof(T), value))
            {
                return value;
            }

            if (!string.IsNullOrWhiteSpace(text))
            {
                Diagnostics.Log("ignoring an unusable window value: " + text);
            }
            return fallback;
        }

        private static int Pixels(string text, int fallback)
        {
            int value;
            // Invariant culture: a hand-edited "1.000" must not read as 1 on a pt-BR machine.
            if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out value)
                && value >= SMALLEST_SIDE && value <= LARGEST_SIDE)
            {
                return value;
            }

            if (!string.IsNullOrWhiteSpace(text))
            {
                Diagnostics.Log("ignoring an unusable window size: " + text);
            }
            return fallback;
        }

        private static int Coordinate(string text)
        {
            int value;
            if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out value))
            {
                return value;
            }
            return 0;
        }

        private void RescueFromOffScreen()
        {
            // A window on no monitor at all is unrecoverable, and Windows will not rescue it.
            if (SystemInformation.VirtualScreen.IntersectsWith(new Rectangle(Location, Size)))
            {
                return;
            }

            Diagnostics.Log("the configured window position is on no monitor; centring instead");
            StartPosition = FormStartPosition.CenterScreen;
        }

        private static Icon AppIcon()
        {
            try
            {
                using (Stream stream = Assembly.GetExecutingAssembly()
                           .GetManifestResourceStream("MetroCal.app.ico"))
                {
                    if (stream == null)
                    {
                        Diagnostics.Log("resources/app.ico is not embedded in the assembly");
                        return null;
                    }
                    return new Icon(stream);
                }
            }
            catch (Exception ex)
            {
                Diagnostics.Log("the icon could not be loaded: " + ex.Message);
                return null;
            }
        }
    }
}
