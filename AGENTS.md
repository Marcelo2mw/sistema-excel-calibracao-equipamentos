# Sistema_calibracao

An Excel application: a web front-end running inside Excel, talking to the
workbook through a bridge. Created by Ribdim Apps.

**This file is for you, the coding assistant.** It describes what you can call
and where to put things. Read it before changing anything.

## Two things that fail without an error message

Start here. Both mistakes are easy to make, and neither produces a stack trace, a
console warning, or a red line anywhere — they produce an app that looks built
and does nothing.

**1. Nothing under `src/` runs until the project is built.** The `.xlsm` that
export produces carries a compiled add-in. With no build, it carries the
*built-in* one, which knows the six bridge actions below and nothing else — not
your handler, not your ribbon callback, not your sheet class. Editing C# and
exporting produces a workbook where your change simply is not present. Building
is a button in Ribdim (it downloads a ~59 MB toolchain the first time). Anything
in `web/` and in `ribbon/Ribbon.xml`, by contrast, takes effect on the next
export with no build at all. **Prefer those two whenever the job can be done
there.** One exception, and only one: a picture in `ribbon/images/` is compiled
into the add-in like `src/` is, so it needs a build too — see **Your own button
icons**.

**2. The ribbon must be static XML.** In `ribbon/Ribbon.xml`, write labels
literally and never use `onLoad`, `getLabel`, `getVisible`, `getEnabled` or any
other `get*` callback. Idiomatic RibbonX is built on exactly those, and here they
cannot work — for two different reasons worth keeping apart. `onLoad` never runs:
the add-in is registered by the workbook's own VBA in the middle of the file
opening, so there is no `IRibbonUI`, nothing can be invalidated, and the tab does
not appear at all. The `get*` callbacks do run, but only an add-in compiled from
this project could answer them, and with no build the workbook carries the
built-in one, which cannot. A label that is not in the file is a control drawn
empty. Ribdim refuses both at export, so you will be told — but only at export.
The one thing with no literal form is a picture: see **Your own button icons**.

**3. `<button>` is the only control the built-in add-in can drive.** Office picks
the callback signature from the control type: a `checkBox` and a `toggleButton`
get their `onAction` called with a `bool`, an `editBox` and a `comboBox` get
`onChange` with a `string`, a `dropDown` and a `gallery` get `onAction` with a
string and an index. `OnClick` and `OnRibbonAction` take an `IRibbonControl` and
nothing else, so on any of those the call never binds: the control is drawn,
clicking it does nothing, and Excel says nothing. Build the ribbon out of
buttons — grouped in `<group>`, and in `<menu>` or `<splitButton>` when there are
many — and put check boxes, text fields and lists in the page, where the whole
web platform is available. Ribdim refuses these at export, so a mistake here
costs an export, not a debugging session.

## The window

The panel is a WinForms `Form`, and `ribdim-app.json` describes it:

```json
"window": {
  "borderStyle": "FixedDialog",
  "width": 700,
  "height": 500,
  "startPosition": "Manual",
  "left": 100,
  "top": 100
}
```

Every key is optional, and leaving one out is not the same as writing today's
default into it: absent means *not chosen*, and the value it resolves to lives
in one place in Ribdim. The names are the `System.Windows.Forms` member names
exactly — `FormBorderStyle`, `FormStartPosition`, `FormWindowState` — so
whatever the documentation says about one of those values is what happens here.

`width` and `height` are the **client** area, the part the page fills, not the
outer window. `minWidth` and `minHeight` are the outer window, because WinForms
has no client minimum. The two only disagree visibly when they are set close
together.

Three of them cost something that is not obvious: a tool window shows no icon,
`"borderStyle": "None"` leaves no title bar and therefore no close button, and
`"state": "Minimized"` means the first ribbon click only puts the panel in the
taskbar.

**All of this needs a build.** It lives in the add-in compiled from this
project; a workbook exported before that carries the built-in one, which was
frozen before these keys existed.

## Two apps open at once

Excel loads one add-in per app, in one process, and the ribbon belongs to the
session rather than to a workbook — so with two Ribdim apps open there are two
tabs and two add-ins, both answering the same two callbacks.

**Where the tab lives depends on whether the project was built.**

Built, the export writes `ribbon/Ribbon.xml` into the workbook as its own
customUI part, and Excel shows the tab **only while that file is active** — two
apps open no longer show each other's tabs. Excel resolves a workbook ribbon's
callbacks as VBA macros, so `OnClick` and `OnRibbonAction` are Subs in the
bootstrap module that forward into a macro the add-in exports
(`src/RibbonMacros.cs`). Nothing you write changes: the names in the XML are the
same two they always were.

Unbuilt, the built-in add-in publishes the tab the old way, and it belongs to
the Excel session — it shows in every window, for every workbook open alongside.
That add-in exports no macro, so it cannot be otherwise.

A second thing a build changes here: pictures. In a workbook ribbon they travel
as parts of the package under their own name, so `image="logo"` needs no
compiler once the project is built.

This app only ever touches **its own** workbook. It finds it at load time by the
stamp it was built with (`src/AppIdentity.cs`) and everything downstream goes
through that: the tab it publishes, the panel it opens, the events it listens
to, and every read and write the bridge makes. `bridge.call('writeCell', ...)`
writes into this app's workbook even when another file is in front.

The one exception is `readSelection`, which answers `null` when this app's
workbook is not the one in front — the selection belongs to Excel, not to a
workbook, and another file's selection would be a worse answer than none.

Keep it that way in anything you add. Reaching for `Application.ActiveWorkbook`
or `ActiveSheet` in `src/` is how this breaks, and it breaks silently: with one
file open it is right every time.

**This needs a Build.** A workbook exported without one carries the built-in
add-in, which was frozen before any of this and still resolves by whichever file
is in front. Two apps open at once means both of them built.

## Layout

```
Sistema_calibracao/
  Sistema_calibracao.xlsx      the workbook. Do not edit it by hand.
  ribdim-app.json        app identity and panel: name, title, ribbon labels,
                         entry page, and the panel's geometry — a `window`
                         block for the Form shape, a `pane` block for the Task
                         Pane one. The geometry needs a build; the title does
                         not.
  ribbon/
    Ribbon.xml           the Excel ribbon. No compiler needed.
    images/              your own button icons. Drop PNGs in; needs a build.
  resources/
    app.ico              the panel window's icon. Replace it and build.
  web/                   the interface. This is where most work happens.
    index.html       the page the panel opens
    app.js               your code
    style.css
    bridge.js            transport layer. DO NOT EDIT.
  src/                   the C# add-in — requires a build to take effect
    Bridge/Handlers.cs   add a bridge action here
    Sheets/              code that belongs to one sheet
    ...                  everything else is plumbing
  dist/                  export output. Generated; do not edit.
```

## The bridge

The page talks to Excel through `window.bridge`, already loaded by
`index.html`. **Twelve actions exist out of the box, and they are the whole
no-compiler API** — anything beyond this list means building the project.

Reading:

```js
await bridge.call('listSheets')
// -> ["Produtos", "Clientes"]

await bridge.call('readSelection')
// -> { sheet, address, value, rows, columns }   (value only when one cell)

await bridge.call('readRange', { sheet: 'Planilha1', address: 'A1:C10' })
// -> [[...], [...]]   a 2-D array, one COM call for the whole block

await bridge.call('usedRange', { sheet: 'Planilha1' })
// -> { sheet, address, rows, columns }   where the data actually is

await bridge.call('readConfig')
// -> { APP_NAME, WINDOW_TITLE, RIBBON_TAB, ENTRY_HTML, WINDOW_BORDER,
//      WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_START, WINDOW_STATE, ... }
```

Writing:

```js
await bridge.call('writeCell',  { sheet: 'Planilha1', address: 'B2', value: 42 })
await bridge.call('writeRange', { sheet: 'Planilha1', address: 'A1', rows: [[1,2],[3,4]] })
// -> { written: 2 }
```

The workbook itself:

```js
await bridge.call('addSheet', { name: 'Report' })
// -> { name: "Report" }   the name actually used, made legal and unique

await bridge.call('selectRange', { sheet: 'Report', address: 'A1:D10' })
// -> { sheet, address }   activates the sheet and selects — the page drives Excel
```

Appearance:

```js
await bridge.call('setFill', { sheet: 'Report', address: 'A1:D1', color: '#2563eb' })
// color: '' clears the fill. Always #RRGGBB — the BGR conversion Excel wants
// happens on the C# side, so never send it byte-reversed yourself.

await bridge.call('setFont', { sheet: 'Report', address: 'A1:D1',
                               bold: true, italic: false, size: 12, color: '#ffffff' })
// every field is optional; only what you send is applied

await bridge.call('autofitColumns', { sheet: 'Report' })
// address optional; without it, the used range
```

`sheet` is optional everywhere: omitted, it means the active sheet.

**Changes made through the bridge cannot be undone with Ctrl+Z.** Excel's undo
history does not cover what an add-in does, so a `writeRange` or a `setFill` over
someone's data is permanent. Prefer writing to a sheet you created with
`addSheet`, and be deliberate about writing anywhere else.

Four events are pushed from Excel without being asked for:

```js
bridge.on('selectionChanged', (d) => { ... });  // { sheet, address }
bridge.on('sheetChanged',     (d) => { ... });  // { sheet, address } — cells edited
bridge.on('sheetActivated',   (d) => { ... });  // { sheet }
bridge.on('ribbonAction',     (d) => { ... });  // { id, tag } — a ribbon button
```

They only arrive while the panel is open, because that is where the page lives.

`bridge.available()` is false when the page is opened outside Excel — useful for
a message, not for a fallback.

The sheets in this workbook: `Planilha1`

## Adding a ribbon button

This is the common request, and it needs **no compiler**. Two edits.

In `ribbon/Ribbon.xml`, inside the `<group>`:

```xml
<button id="btnListProducts" label="List products" size="large"
        imageMso="TableInsertExcel"
        onAction="OnRibbonAction" tag="listProducts" />
```

In `web/app.js`:

```js
bridge.on('ribbonAction', async function (d) {
  if (d.tag !== 'listProducts') return;
  const rows = await bridge.call('readRange', { sheet: 'Planilha1', address: 'A1:A100' });
  render(rows.map((r) => r[0]).filter((v) => v !== null));
});
```

`onAction` may only be **`OnRibbonAction`** or **`OnClick`**. Those are the two
callbacks the built-in add-in answers, and the list does not grow: one set of
bytes ships inside every workbook exported without a build, so it cannot have a
method named after a button you invented. `OnClick` opens the panel and nothing
else; `OnRibbonAction` opens the panel if it is closed and then sends the click
to the page, which is where behaviour belongs.

Match on `tag`, not on `id`: `id` has to be unique to Excel, `tag` is yours.

A method of your own in `src/Ribbon.cs` also works — but only after a build, and
the export refuses the ribbon until that method exists. Reach for it when the
work genuinely has to happen in C#, not by default.

### Your own button icons

`imageMso` needs no build and reaches Office's whole icon set, so it stays the
default. For your own artwork, drop a **32x32 PNG with transparency** into
`ribbon/images/` and name it from the XML without the extension:

```xml
<!-- ribbon/images/report.png -->
<button id="btnReport" label="Report" size="large" image="report"
        onAction="OnRibbonAction" tag="report" />
```

This is the one thing in `ribbon/` that **does** need a build: the files are
compiled into the add-in, and the built-in one cannot carry a picture it has
never seen. Ribdim refuses the export and says so rather than shipping blank
buttons. A name with no file behind it is refused the same way, with the list of
what the folder actually holds.

Three things to get right, all of them things an assistant gets wrong first.

**You cannot invent the picture.** `image="logo"` with nothing in
`ribbon/images/` is refused at export, and no amount of rewriting the XML fixes
it. Look in the folder before naming anything; if what the job needs is not
there, **ask for the file** rather than guessing a name or falling back to a
vaguely similar `imageMso`. Ask for a PNG. `.ico`, `.jpg`, `.jpeg`, `.gif` and
`.bmp` are accepted too, and none of them is as good: `.jpg` and `.bmp` have no
transparency at all, so the icon wears a visible box in dark themes; `.gif` has
one transparent colour and fringes badly at 32px; `.ico` does carry alpha, but
it is a container of several sizes and which one comes out is not yours to
choose.

**Do not write `loadImage` yourself.** Ribdim adds `loadImage="LoadImage"` to
`<customUI>` during export, and only when the ribbon actually uses a picture.
Writing it by hand is harmless but pointless; writing `getImage` on a control
instead is refused, and so is any other `get*` — see rule 2.

**Do not go through `App.dna`.** Excel-DNA has its own packed-image mechanism
(`<Image Name="…" Path="…" Pack="true"/>`), it does build, it does pack, and it
is *not* the path wired up here — `LoadImage` looks the picture up by the name
Ribdim gives it in the compiler's `/resource:` switch, which is
`Sistema_calibracao.images.<id>`. A picture added the Excel-DNA way is invisible to
it. The folder is the whole interface; there is nothing else to register, in
`App.dna` or anywhere.

Adding several at once is fine — tabs and groups cost nothing, and a ribbon of
fifteen buttons is a normal thing to write in one pass. Two things to hold on to
while doing it. Every `id` must be unique across the whole ribbon, including ids
inside menus: Excel answers a repeated one by dropping the entire `customUI`,
with no tab and no message. And each button needs its own `tag`, since that is
what `web/app.js` matches on. Ribdim validates both at export.

The tab ships with `insertBeforeMso="TabHome"`, which places it ahead of Home.
Remove the attribute to let it fall in last, or point it elsewhere with
`insertAfterMso`. Those `Mso` ids are internal and are never translated —
`TabHome` is `TabHome` on an Excel in any language.

## Code for one sheet

For "when something changes on the Produtos sheet, do X", there are two places,
and the difference between them is not style:

**`web/app.js`, no compiler.** Filter the event by sheet:

```js
bridge.on('sheetChanged', (d) => {
  if (d.sheet === 'Planilha1') recalculate();
});
```

Only fires while the panel is open.

**`src/Sheets/Planilha1Sheet.cs`, requires a build.** One class per sheet,
one file each — the equivalent of VSTO's `Sheet1.cs`:

```csharp
public class Planilha1Sheet : SheetHandler
{
    public override string SheetName => "Planilha1";

    public override void OnChange(Excel.Range target) { ... }
    public override void OnSelectionChange(Excel.Range target) { ... }
    public override void OnActivate() { ... }
}
```

Runs whether or not the panel is open — that is the only reason to choose it.
Nothing registers the class; `SheetEvents` finds it by reflection, so adding a
file is enough. Only the first sheet has a file already; copy it for the others.

If you write to the sheet from `OnChange`, your own write raises `OnChange`
again. Set `Application.EnableEvents = false` around it and restore it in a
`finally`.

## Adding a bridge action

Edit `src/Bridge/Handlers.cs`, next to the five that are already there:

```csharp
Register("sumColumn", d =>
{
    var ws = Sheet((string)d["sheet"]);
    return ws.Range[(string)d["address"]].Cells
             .Cast<Excel.Range>().Sum(c => (double)(c.Value2 ?? 0));
});
```

Then call it by the same name from `app.js`. Names and field names are in
English because they are the contract; keep it that way.

**This requires a build.** Until the project is built, a call to a handler you
added rejects with "unknown action". Check the twelve above first — between
`readRange`, `writeRange`, `setFill`, `setFont` and `selectRange` there is more
reach than it looks, and none of it costs a compile.

## Rules that are not style preferences

- **Do not edit `web/bridge.js`.** The C# side calls `window.bridge._resolve`
  and `window.bridge._event` *by name*. A change here produces an app that loads
  and answers nothing, with no error anywhere.
- **Do not edit `Sistema_calibracao.xlsx` with a spreadsheet library.** Opening and
  saving it risks dropping charts, slicers and conditional formatting the
  library does not understand. Change it in Excel, or through the bridge.
- **Do not write into `dist/`.** It is regenerated on every export.
- **Do not delete `src/WebView2Loader.cs`, and do not "simplify" it.** It looks
  like dead code on a machine where WebView2 already starts, because on those
  machines its first line succeeds and it does nothing else. On a machine whose
  Office does not ship `WebView2Loader.dll`, it is the only reason the app opens
  at all. It never replaces a working loader — it only supplies a missing one.
- **Read and write ranges in blocks**, not cell by cell. Every bridge call
  crosses into Excel's COM interface; `readRange` on a block is one call, a loop
  over cells is one per cell and is orders of magnitude slower.
- Excel refuses calls while it is busy (a cell being edited, a menu open, a
  recalculation). The bridge already retries those; do not add your own retry.

## Trying it

Front-end and ribbon changes: edit, then export from Ribdim and open the
`.xlsm`. C# changes: build first, then export. There is no live reload — the page
is embedded in the workbook.

Opening `web/index.html` directly in a browser renders the layout but no
bridge call will work, and `bridge.available()` returns false.

## The MetroCal system

`web/` implements a calibration-management system (MetroCal) on top of the
twelve bridge actions. Everything below is app-level convention, enforced only
by the code in `web/` — change it there, consistently.

**The workbook is the database.** Each entity is one sheet, headers in row 1,
data from row 2: `Instrumentos`, `Padroes`, `Aplicacoes`, `Vinculos`,
`Calibracoes`, `CalPontos`, `CalPadroes`, `Agenda`, `Ocorrencias`,
`Auditoria`, `Usuarios`, `Config`, `Arquivos`, `Documentos`. The schema lives
in `DB.SHEETS` (`web/data.js`) — a column added there is created on next
`DB.init()` only if the whole sheet is missing, so evolving an existing sheet
means migrating by hand. `DB.reset()` (Configurações screen) blanks the sheets
and re-seeds the sample data from `web/seed.js`.

**Dates travel as ISO text** (`2026-09-05`) and are normalized on read
(`Domain.normDate`), because Excel may convert the string to a real date on
write — what comes back then starts with the same ten characters.

**Files (photos, certificate PDFs).** `src/Bridge/FileHandlers.cs` adds five
actions — `fileSave`, `fileRead`, `fileOpen`, `fileDelete`, `fileList` — that
store bytes in an `arquivos/` folder next to the workbook. They exist **only
after a build**; until then `web/data.js` (`Files.*`) falls back to base64
chunks in the `Arquivos` sheet, and the stored reference tells the two apart:
`file:<name>` vs `db:<name>`. Don't break that prefix convention.

**Layers in web/:** `ui.js` (DOM, icons, formatting, charts — no network
assets), `data.js` (DB/Files/Domain), `seed-data.js` (sample data itself, pure
data with no bridge dependency — also usable from Node for direct injection),
`seed.js` (writes SeedData into the sheets), `screens.js` (one function per
screen), `app.js` (hash router, nav, boot). Conformity evaluation (ILAC G8:
simples / banda de guarda / TUR) is `Domain.evaluate`; conformity is a property
of instrument × application, never of the instrument alone.
