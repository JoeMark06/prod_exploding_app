import { useRef, useState } from "react";
import { FileSpreadsheet, Layers3, Plus, Search, Trash2, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

type PartRow = {
  id: string;
  partNo: string;
  version: string;
  lineNo: string;
  quantity: number;
  status: "In progress" | "Included" | "Not included";
};

const emptyForm = { partNo: "", version: "", lineNo: "", quantity: "1" };
const requiredColumns = ["Part No.", "Product Version", "Line No.", "Quantity"];

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[._\s-]+/g, "");
}

function parseRows(file: File): Promise<PartRow[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("The workbook has no readable worksheet.");
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!records.length) throw new Error("The worksheet does not contain any part rows.");
    const headerMap = new Map(Object.keys(records[0]).map((key) => [normalizeHeader(key), key]));
    const columns = requiredColumns.map((name) => headerMap.get(normalizeHeader(name)));
    if (columns.some((column) => !column)) {
      throw new Error("Include Part No., Product Version, Line No. and Quantity columns.");
    }
    return records.map((record, index) => {
      const [partNo, version, lineNo, quantity] = columns.map((column) => record[column!]);
      const parsedQuantity = Number(quantity);
      if (!String(partNo).trim() || !String(version).trim() || !String(lineNo).trim() || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        throw new Error(`Check the required values in spreadsheet row ${index + 2}.`);
      }
      return { id: crypto.randomUUID(), partNo: String(partNo).trim(), version: String(version).trim(), lineNo: String(lineNo).trim(), quantity: parsedQuantity, status: "In progress" as const };
    });
  });
}

function PartForm({ onAdd }: { onAdd: (row: Omit<PartRow, "id" | "status">) => void }) {
  const [form, setForm] = useState(emptyForm);
  const update = (field: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!form.partNo.trim() || !form.version.trim() || !form.lineNo.trim() || !Number.isInteger(quantity) || quantity < 1) return;
    onAdd({ partNo: form.partNo.trim(), version: form.version.trim(), lineNo: form.lineNo.trim(), quantity });
    setForm(emptyForm);
  };

  return (
    <form className="part-form" onSubmit={submit}>
      <label className="field"><span>Part number</span><input required value={form.partNo} onChange={(event) => update("partNo", event.target.value)} placeholder="e.g. 30-4821" /></label>
      <label className="field"><span>Product version</span><input required value={form.version} onChange={(event) => update("version", event.target.value)} placeholder="e.g. C" /></label>
      <label className="field"><span>Production line</span><input required value={form.lineNo} onChange={(event) => update("lineNo", event.target.value)} placeholder="e.g. 02" /></label>
      <label className="field quantity-field"><span>Quantity</span><input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /></label>
      <button className="button button-primary add-button" type="submit"><Plus aria-hidden="true" /> Add to list</button>
    </form>
  );
}

function PartsTable({ rows, onRemove }: { rows: PartRow[]; onRemove: (id: string) => void }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th scope="col">Part number</th><th scope="col">Version</th><th scope="col">Line</th><th scope="col">Quantity</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <td><span className="part-code">{row.partNo}</span></td><td>{row.version}</td><td>{row.lineNo}</td><td>{row.quantity.toLocaleString()}</td>
            <td><span className={`status status-${row.status === "In progress" ? "progress" : row.status === "Included" ? "included" : "excluded"}`}><i aria-hidden="true" />{row.status}</span></td>
            <td><button className="icon-button" type="button" aria-label={`Remove ${row.partNo} from list`} onClick={() => onRemove(row.id)}><Trash2 aria-hidden="true" /></button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function HomePage() {
  const [rows, setRows] = useState<PartRow[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showConnectNote, setShowConnectNote] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const filteredRows = rows.filter((row) => `${row.partNo} ${row.version} ${row.lineNo}`.toLowerCase().includes(query.toLowerCase()));

  const addRow = (part: Omit<PartRow, "id" | "status">) => {
    setRows((current) => [...current, { ...part, id: crypto.randomUUID(), status: "In progress" }]);
    setNotice("");
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await parseRows(file);
      setRows((current) => [...current, ...imported]);
      setNotice(`${imported.length} ${imported.length === 1 ? "part" : "parts"} added from ${file.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The file could not be read.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <main className="app-frame">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Production Exploding home"><span className="brand-mark"><Layers3 aria-hidden="true" /></span><span>Production<span className="brand-light">Exploding</span></span></a>
        <div className="topbar-right"><span className="workspace-label"><span className="online-dot" /> Production workspace</span><span className="avatar" aria-label="Workspace user">PE</span></div>
      </header>

      <div className="page-wrap" id="home">
        <div className="page-heading">
          <div><div className="eyebrow">MATERIAL PLANNING <span> / </span> PART EXPLOSION</div><h1>Part explosion</h1><p className="page-description">Turn production parts into a clear list of the materials they need.</p></div>
          <button className="button button-outline import-button" type="button" onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" /> Import list</button>
          <input ref={fileInput} className="sr-only" type="file" accept=".xlsx,.xls,.csv" aria-label="Import parts from Excel or CSV" onChange={(event) => void importFile(event.target.files?.[0])} />
        </div>

        <section className="entry-card" aria-labelledby="add-heading">
          <div className="section-heading"><div className="section-icon"><Plus aria-hidden="true" /></div><div><h2 id="add-heading">Add a production part</h2><p>Enter a part and its production details to start a new list.</p></div></div>
          <PartForm onAdd={addRow} />
          <div className="import-hint"><FileSpreadsheet aria-hidden="true" /><span>Have several parts? Import an Excel or CSV file with Part No., Product Version, Line No. and Quantity columns.</span></div>
        </section>

        <section className="list-section" aria-labelledby="list-heading">
          <div className="list-heading-row"><div><div className="list-title"><h2 id="list-heading">In progress</h2><span className="count-badge" aria-label={`${rows.length} parts`}>{rows.length}</span></div><p className="list-subtitle">Parts waiting to be exploded into materials</p></div>
            {rows.length > 0 && <button className="text-button" type="button" onClick={() => { setRows([]); setNotice(""); }}>Clear list</button>}
          </div>
          {notice && <div className={`inline-notice ${notice.includes("added from") ? "notice-success" : "notice-error"}`} role="status"><span>{notice}</span><button type="button" className="dismiss-button" aria-label="Dismiss message" onClick={() => setNotice("")}><X aria-hidden="true" /></button></div>}
          {rows.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><Layers3 aria-hidden="true" /></div><h3>Your list is ready for parts</h3><p>Add a part above or import a spreadsheet to build your production list.</p><button className="button button-quiet" type="button" onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" /> Import a list</button></div>
          ) : (
            <div className="table-card"><div className="table-toolbar"><div className="table-total"><strong>{rows.length}</strong> {rows.length === 1 ? "part" : "parts"} in this list</div><label className="search-box"><Search aria-hidden="true" /><span className="sr-only">Filter parts</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter parts…" /></label></div><PartsTable rows={filteredRows} onRemove={(id) => setRows((current) => current.filter((row) => row.id !== id))} />{filteredRows.length === 0 && <p className="no-results">No parts match your search.</p>}</div>
          )}
          <div className="explosion-footer"><div className="secure-note"><span className="secure-mark">i</span><span>Explosions use the active BOM and product version data.</span></div><button className="button button-primary explode-button" type="button" disabled={rows.length === 0} onClick={() => setShowConnectNote(true)}>Explode parts <span aria-hidden="true">↗</span></button></div>
        </section>

        {showConnectNote && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowConnectNote(false); }}><section className="connect-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title"><button className="icon-button dialog-close" type="button" aria-label="Close dialog" onClick={() => setShowConnectNote(false)}><X aria-hidden="true" /></button><div className="dialog-symbol"><Layers3 aria-hidden="true" /></div><p className="eyebrow">DATA SOURCE NEEDED</p><h2 id="connect-title">Connect your BOM data</h2><p>The application interface is ready, but this repository does not include its SharePoint data connector yet. Connect the PartVersions and SummaryBOM data sources to calculate material requirements.</p><button className="button button-primary dialog-action" type="button" onClick={() => setShowConnectNote(false)}>Got it</button></section></div>}
        <footer className="page-footer"><span>Production Exploding</span><span>Part explosion workspace</span></footer>
      </div>
    </main>
  );
}
