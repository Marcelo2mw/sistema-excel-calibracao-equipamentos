using Microsoft.Web.WebView2.WinForms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao.Bridge
{
    public partial class ExcelBridge
    {
        private readonly WebView2 _webView;
        private readonly Excel.Application _excel;

        // The workbook this app owns. Every sheet the bridge touches is resolved
        // from it, never from Excel's active workbook: the panel is not modal,
        // so the user can bring another file to the front at any moment, and
        // writeCell would then write into that one.
        protected readonly Excel.Workbook _workbook;
        private readonly Dictionary<string, Func<JObject, object>> _handlers =
            new Dictionary<string, Func<JObject, object>>(StringComparer.OrdinalIgnoreCase);

        private const uint RPC_E_CALL_REJECTED = 0x80010001;
        private const uint RPC_E_SERVERCALL_RETRYLATER = 0x8001010A;

        public ExcelBridge(WebView2 webView, Excel.Application excel, Excel.Workbook workbook)
        {
            _webView = webView;
            _excel = excel;
            _workbook = workbook;
            _webView.CoreWebView2.WebMessageReceived += OnMessage;
        }

        public void Register(string action, Func<JObject, object> handler) => _handlers[action] = handler;

        public void Emit(string name, object data)
            => RunInJs("window.bridge._event",
                JsonConvert.SerializeObject(new Envelope.Event { Name = name, Data = data }));

        private void OnMessage(object sender,
            Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
        {
            Envelope.Request request;
            try
            {
                request = JsonConvert.DeserializeObject<Envelope.Request>(e.TryGetWebMessageAsString());
            }
            catch (Exception ex)
            {
                Answer(new Envelope.Response { Ok = false, Error = "Invalid message: " + ex.Message });
                return;
            }

            if (request == null || string.IsNullOrEmpty(request.Action))
            {
                Answer(new Envelope.Response { Ok = false, Error = "Missing action." });
                return;
            }

            Func<JObject, object> handler;
            if (!_handlers.TryGetValue(request.Action, out handler))
            {
                Answer(new Envelope.Response
                {
                    Id = request.Id,
                    Ok = false,
                    Error = "Unknown action: " + request.Action
                });
                return;
            }

            JObject data = request.Data ?? new JObject();
            try
            {
                object result = WithRetry(() => handler(data));
                Answer(new Envelope.Response { Id = request.Id, Ok = true, Data = result });
            }
            catch (Exception ex)
            {
                Answer(new Envelope.Response { Id = request.Id, Ok = false, Error = ex.Message });
            }
        }

        private void Answer(Envelope.Response response)
            => RunInJs("window.bridge._resolve", JsonConvert.SerializeObject(response));

        // The JSON travels as a string literal and is rehydrated with JSON.parse on the
        // other side, which is what survives quotes and newlines in the data.
        private void RunInJs(string function, string json)
        {
            if (_webView == null || _webView.CoreWebView2 == null) return;

            string script = function + "(JSON.parse(" + JsonConvert.SerializeObject(json) + "))";

            if (_webView.InvokeRequired)
            {
                _webView.BeginInvoke(new Action(delegate
                {
                    if (_webView.CoreWebView2 != null) _webView.CoreWebView2.ExecuteScriptAsync(script);
                }));
            }
            else
            {
                _webView.CoreWebView2.ExecuteScriptAsync(script);
            }
        }

        private static object WithRetry(Func<object> call, int attempts = 5)
        {
            for (int i = 0; ; i++)
            {
                try { return call(); }
                catch (COMException ex) when (i < attempts && IsBusy(ex))
                {
                    Thread.Sleep(60 * (i + 1));
                }
            }
        }

        private static bool IsBusy(COMException ex)
        {
            uint hr = unchecked((uint)ex.ErrorCode);
            return hr == RPC_E_CALL_REJECTED || hr == RPC_E_SERVERCALL_RETRYLATER;
        }

        protected Excel.Worksheet Sheet(string name)
        {
            if (string.IsNullOrEmpty(name)) return (Excel.Worksheet)_workbook.ActiveSheet;
            return (Excel.Worksheet)_workbook.Worksheets[name];
        }

        /// <summary>Whether the app's own workbook is the one in front.</summary>
        protected bool IsInFront()
        {
            try
            {
                Excel.Workbook active = _excel.ActiveWorkbook;
                return active != null && _workbook != null
                    && string.Equals(active.FullName, _workbook.FullName,
                        StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        protected static int OleColor(string hex)
        {
            string clean = (hex ?? "").TrimStart('#').Trim();
            if (clean.Length != 6)
                throw new ArgumentException("a colour must be #RRGGBB, got: " + hex);

            int r = Convert.ToInt32(clean.Substring(0, 2), 16);
            int g = Convert.ToInt32(clean.Substring(2, 2), 16);
            int b = Convert.ToInt32(clean.Substring(4, 2), 16);

            return (b << 16) | (g << 8) | r;
        }

        protected static object ValueOf(JToken token)
        {
            JValue value = token as JValue;
            return value == null ? null : value.Value;
        }

        protected static List<List<object>> ToMatrix(object raw)
        {
            var output = new List<List<object>>();
            object[,] array = raw as object[,];
            if (array == null)
            {
                output.Add(new List<object> { raw });
                return output;
            }

            for (int i = array.GetLowerBound(0); i <= array.GetUpperBound(0); i++)
            {
                var row = new List<object>();
                for (int j = array.GetLowerBound(1); j <= array.GetUpperBound(1); j++)
                {
                    row.Add(array[i, j]);
                }
                output.Add(row);
            }
            return output;
        }
    }

    public static class Envelope
    {
        public class Request
        {
            [JsonProperty("id")] public string Id { get; set; }
            [JsonProperty("acao")] public string Action { get; set; }
            [JsonProperty("dados")] public JObject Data { get; set; }
        }

        public class Response
        {
            [JsonProperty("id")] public string Id { get; set; }
            [JsonProperty("ok")] public bool Ok { get; set; }
            [JsonProperty("dados")] public object Data { get; set; }
            [JsonProperty("erro")] public string Error { get; set; }
        }

        public class Event
        {
            [JsonProperty("evento")] public string Name { get; set; }
            [JsonProperty("dados")] public object Data { get; set; }
        }
    }
}
