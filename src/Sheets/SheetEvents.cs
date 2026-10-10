using ExcelDna.Integration;
using System;
using System.Collections.Generic;
using System.Reflection;
using Excel = Microsoft.Office.Interop.Excel;

namespace Sistema_calibracao.Sheets
{
    public abstract class SheetHandler
    {
        public abstract string SheetName { get; }

        public virtual void OnChange(Excel.Range target) { }

        public virtual void OnSelectionChange(Excel.Range target) { }

        public virtual void OnActivate() { }
    }

    public static class SheetEvents
    {
        private static readonly Dictionary<string, List<SheetHandler>> _bySheet =
            new Dictionary<string, List<SheetHandler>>(StringComparer.OrdinalIgnoreCase);

        private static Excel.Application _excel;

        public static void Attach()
        {
            if (_excel != null) return;

            Discover();
            if (_bySheet.Count == 0)
            {
                Diagnostics.Log("no sheet handlers in src/Sheets/");
                return;
            }

            try
            {
                _excel = (Excel.Application)ExcelDnaUtil.Application;
                _excel.SheetChange += OnChange;
                _excel.SheetSelectionChange += OnSelectionChange;
                _excel.SheetActivate += OnActivate;

                Diagnostics.Log("sheet handlers attached for: " +
                    string.Join(", ", new List<string>(_bySheet.Keys).ToArray()));
            }
            catch (Exception ex)
            {
                Diagnostics.Log("could not attach the sheet handlers: " + ex.Message);
                _excel = null;
            }
        }

        public static void Detach()
        {
            if (_excel == null) return;
            try
            {
                _excel.SheetChange -= OnChange;
                _excel.SheetSelectionChange -= OnSelectionChange;
                _excel.SheetActivate -= OnActivate;
            }
            catch { /* Excel may already be shutting down */ }
            _excel = null;
        }

        private static void OnChange(object sheet, Excel.Range target)
            => Dispatch(sheet, h => h.OnChange(target));

        private static void OnSelectionChange(object sheet, Excel.Range target)
            => Dispatch(sheet, h => h.OnSelectionChange(target));

        private static void OnActivate(object sheet)
            => Dispatch(sheet, h => h.OnActivate());

        private static void Dispatch(object sheet, Action<SheetHandler> call)
        {
            try
            {
                var worksheet = sheet as Excel.Worksheet;
                if (worksheet == null) return;

                List<SheetHandler> handlers;
                if (!_bySheet.TryGetValue(worksheet.Name, out handlers)) return;
                if (!BelongsToThisApp(worksheet)) return;

                foreach (SheetHandler handler in handlers)
                {
                    try { call(handler); }
                    catch (Exception ex)
                    {
                        Diagnostics.Log(handler.GetType().Name + " threw: " + ex);
                    }
                }
            }
            catch (Exception ex)
            {
                Diagnostics.Log("sheet event dispatch failed: " + ex.Message);
            }
        }

        private static bool BelongsToThisApp(Excel.Worksheet worksheet)
        {
            try
            {
                var workbook = worksheet.Parent as Excel.Workbook;
                if (workbook == null) return false;

                return string.Equals(
                    WorkbookPayload.Read(workbook).Get("APP_NAME"),
                    "MetroCal",
                    StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private static void Discover()
        {
            _bySheet.Clear();

            Type[] types;
            try
            {
                types = Assembly.GetExecutingAssembly().GetTypes();
            }
            catch (ReflectionTypeLoadException ex)
            {
                types = ex.Types ?? new Type[0];
            }

            foreach (Type type in types)
            {
                if (type == null || type.IsAbstract || !typeof(SheetHandler).IsAssignableFrom(type)) continue;
                if (type.GetConstructor(Type.EmptyTypes) == null)
                {
                    Diagnostics.Log(type.Name + " needs a parameterless constructor to be used as a sheet handler");
                    continue;
                }

                try
                {
                    var handler = (SheetHandler)Activator.CreateInstance(type);
                    string name = handler.SheetName;
                    if (string.IsNullOrEmpty(name)) continue;

                    List<SheetHandler> list;
                    if (!_bySheet.TryGetValue(name, out list))
                    {
                        list = new List<SheetHandler>();
                        _bySheet[name] = list;
                    }
                    list.Add(handler);
                }
                catch (Exception ex)
                {
                    Diagnostics.Log("could not create " + type.Name + ": " + ex.Message);
                }
            }
        }
    }
}
