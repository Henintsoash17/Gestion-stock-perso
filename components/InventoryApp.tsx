"use client";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";
import {
    Activity,
    AlertTriangle,
    ArrowDownToLine,
    ArrowLeftRight,
    Bell,
    Boxes,
    ChartNoAxesCombined,
    ChevronDown,
    CircleAlert,
    LayoutDashboard,
    Package,
    Plus,
    Search,
    Settings2,
    Trash2,
    TrendingUp,
    X,
    Pencil,
    Minus,
    Download,
    RefreshCw,
} from "lucide-react";
type Product = {
    id: number;
    name: string;
    sku: string;
    category: string;
    price: number;
    quantity: number;
    min_stock: number;
    emoji: string;
    created_at: string;
    updated_at: string;
};
type Draft = Omit<Product, "id" | "created_at" | "updated_at">;
const empty: Draft = {
    name: "",
    sku: "",
    category: "",
    price: 0,
    quantity: 0,
    min_stock: 5,
    emoji: "📦",
};
const money = (n: number) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) +
    " Ar";
const status = (p: Product) =>
    p.quantity === 0 ? "out" : p.quantity <= p.min_stock ? "low" : "ok";
const statusText = (s: string) =>
    s === "out" ? "Rupture" : s === "low" ? "Stock faible" : "En stock";
export default function InventoryApp() {
    const [products, setProducts] = useState<Product[]>([]),
        [loading, setLoading] = useState(true),
        [query, setQuery] = useState(""),
        [category, setCategory] = useState(""),
        [filterStatus, setFilterStatus] = useState(""),
        [view, setView] = useState("Vue d’ensemble"),
        [modal, setModal] = useState(false),
        [editing, setEditing] = useState<Product | null>(null),
        [draft, setDraft] = useState<Draft>(empty),
        [error, setError] = useState(""),
        [toast, setToast] = useState(""),
        [page, setPage] = useState(1),
        [moves, setMoves] = useState<any[]>([]);
    const notify = (s: string) => {
        setToast(s);
        window.setTimeout(() => setToast(""), 2600);
    };
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/products");
            if (!r.ok) throw new Error("Chargement impossible");
            setProducts(await r.json());
            const mr = await fetch("/api/movements");
            if (mr.ok) setMoves(await mr.json());
        } catch {
            notify("Erreur de chargement. Vérifiez le serveur.");
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const categories = useMemo(
        () => Array.from(new Set(products.map((p) => p.category))).sort(),
        [products],
    );
    const filtered = useMemo(
        () =>
            products.filter(
                (p) =>
                    (p.name.toLowerCase().includes(query.toLowerCase()) ||
                        p.sku.toLowerCase().includes(query.toLowerCase())) &&
                    (!category || p.category === category) &&
                    (!filterStatus || status(p) === filterStatus) &&
                    (view !== "Alertes de stock" || status(p) !== "ok"),
            ),
        [products, query, category, filterStatus, view],
    );
    const pageSize = 6,
        pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
        shown = filtered.slice((page - 1) * pageSize, page * pageSize);
    const value = products.reduce((sum, p) => sum + p.price * p.quantity, 0),
        low = products.filter((p) => status(p) === "low").length,
        out = products.filter((p) => status(p) === "out").length;
    function openCreate(p?: Product) {
        setEditing(p || null);
        setDraft(
            p
                ? {
                      name: p.name,
                      sku: p.sku,
                      category: p.category,
                      price: p.price,
                      quantity: p.quantity,
                      min_stock: p.min_stock,
                      emoji: p.emoji,
                  }
                : empty,
        );
        setError("");
        setModal(true);
    }
    async function save(e: FormEvent) {
        e.preventDefault();
        setError("");
        try {
            const r = await fetch(
                editing ? `/api/products/${editing.id}` : "/api/products",
                {
                    method: editing ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(draft),
                },
            );
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
            await load();
            setModal(false);
            notify(
                editing
                    ? "Produit mis à jour."
                    : "Produit ajouté au catalogue.",
            );
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Une erreur est survenue.",
            );
        }
    }
    async function move(p: Product, type: "IN" | "OUT") {
        const raw = window.prompt(
            `${type === "IN" ? "Entrée" : "Sortie"} de stock pour ${p.name}. Quantité :`,
            type === "IN" ? "5" : "1",
        );
        if (raw === null) return;
        const quantity = Number(raw);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            notify("Saisissez une quantité entière positive.");
            return;
        }
        try {
            const r = await fetch(`/api/products/${p.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "move", type, quantity }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            await load();
            notify("Mouvement enregistré.");
        } catch (e) {
            notify(e instanceof Error ? e.message : "Mouvement impossible.");
        }
    }
    async function remove(p: Product) {
        if (!window.confirm(`Supprimer ${p.name} ?`)) return;
        try {
            const r = await fetch(`/api/products/${p.id}`, {
                    method: "DELETE",
                }),
                d = await r.json();
            if (!r.ok) throw new Error(d.error);
            await load();
            notify("Produit supprimé.");
        } catch (e) {
            notify(e instanceof Error ? e.message : "Suppression impossible.");
        }
    }
    function exportCsv() {
        const csv = [
            [
                "SKU",
                "Produit",
                "Catégorie",
                "Prix achat Ar",
                "Quantité",
                "Seuil",
                "État",
            ],
            ...filtered.map((p) => [
                p.sku,
                p.name,
                p.category,
                p.price,
                p.quantity,
                p.min_stock,
                statusText(status(p)),
            ]),
        ]
            .map((row) =>
                row
                    .map((v) => `"${String(v).replaceAll('"', '""')}"`)
                    .join(";"),
            )
            .join("\r\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
            new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
        );
        a.download = "stockflow-inventaire.csv";
        a.click();
        URL.revokeObjectURL(a.href);
    }
    const nav = [
        { label: "Vue d’ensemble", icon: LayoutDashboard },
        { label: "Produits", icon: Package },
        { label: "Mouvements", icon: ArrowLeftRight },
        { label: "Alertes de stock", icon: CircleAlert },
        { label: "Rapports", icon: ChartNoAxesCombined },
    ];
    return (
        <main className="shell">
            <aside className="sidebar">
                <a className="brand" href="#">
                    <span className="brand-icon">S</span>
                    <span>
                        <b>Gestion de stock</b>
                        <small>Inventaire</small>
                    </span>
                </a>
                <div className="nav-title">ESPACE DE TRAVAIL</div>
                <nav>
                    {nav.map(({ label, icon: Icon }) => (
                        <button
                            key={label}
                            className={
                                view === label ? "nav-item active" : "nav-item"
                            }
                            onClick={() => {
                                setView(label);
                                setPage(1);
                            }}
                        >
                            <Icon size={18} />
                            {label}
                            {label === "Alertes de stock" && (
                                <span className="nav-count">{low + out}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </aside>
            <section className="main">
                <header className="topbar">
                    <div className="breadcrumb">
                        Inventaire <span>/</span> <b>{view}</b>
                    </div>
                    <div className="profile">
                        <button
                            className="icon-button"
                            aria-label="Alertes"
                            onClick={() => setView("Alertes de stock")}
                        >
                            <Bell size={17} />
                            {low + out > 0 && <i />}
                        </button>
                        <span className="avatar">Ad</span>
                        <span className="profile-text">
                            <b>Administrateur</b>
                            <small>Gestionnaire de stock</small>
                        </span>
                    </div>
                </header>
                <div className="content">
                    <div className="page-heading">
                        <div>
                            <div className="eyebrow">ESPACE INVENTAIRE</div>
                            <h1>{view}</h1>
                            <p>
                                Voici ce qui se passe dans votre inventaire
                                aujourd’hui.
                            </p>
                        </div>
                        <button
                            className="btn primary"
                            onClick={() => openCreate()}
                        >
                            <Plus size={17} /> Ajouter un produit
                        </button>
                    </div>
                    <div className="stats">
                        <Stat
                            icon={<Package />}
                            label="Total des produits"
                            value={String(products.length)}
                            note="Références enregistrées"
                        />
                        <Stat
                            icon={<TrendingUp />}
                            label="Valeur du stock"
                            value={
                                value >= 1e6
                                    ? (value / 1e6).toLocaleString("fr-FR", {
                                          maximumFractionDigits: 2,
                                      }) + " M Ar"
                                    : money(value)
                            }
                            note="Valorisation au prix d’achat"
                        />
                        <Stat
                            icon={<AlertTriangle />}
                            label="Stock faible"
                            value={String(low)}
                            note="À réapprovisionner"
                            tone="orange"
                        />
                        <Stat
                            icon={<CircleAlert />}
                            label="Ruptures de stock"
                            value={String(out)}
                            note="Produits indisponibles"
                            tone="red"
                        />
                    </div>
                    <div className="middle-grid">
                        <section className="panel chart-panel">
                            <div className="panel-head">
                                <div>
                                    <h2>Vue de l’inventaire</h2>
                                    <p>Répartition actuelle des références</p>
                                </div>
                                <span className="subtle-pill">Temps réel</span>
                            </div>
                            <div className="chart-content">
                                <div
                                    className="donut"
                                    style={{
                                        background: `conic-gradient(var(--green) 0 ${products.length ? (products.filter((p) => status(p) === "ok").length / products.length) * 100 : 0}%, var(--orange) 0 ${products.length ? ((products.filter((p) => status(p) === "ok").length + low) / products.length) * 100 : 0}%, var(--red) 0 100%)`,
                                    }}
                                >
                                    <div>
                                        <b>{products.length}</b>
                                        <small>produits</small>
                                    </div>
                                </div>
                                <div className="chart-legend">
                                    <Legend
                                        color="green"
                                        label="En stock"
                                        value={
                                            products.filter(
                                                (p) => status(p) === "ok",
                                            ).length
                                        }
                                    />
                                    <Legend
                                        color="orange"
                                        label="Stock faible"
                                        value={low}
                                    />
                                    <Legend
                                        color="red"
                                        label="Rupture"
                                        value={out}
                                    />
                                </div>
                            </div>
                            <div className="chart-foot">
                                <Activity size={15} /> Les indicateurs sont
                                calculés depuis la base SQLite locale.
                            </div>
                        </section>
                        <section className="panel recent-panel">
                            <div className="panel-head">
                                <div>
                                    <h2>Mouvements récents</h2>
                                    <p>Les dernières opérations</p>
                                </div>
                                <button
                                    className="text-btn"
                                    onClick={() => setView("Mouvements")}
                                >
                                    Tout voir ↗
                                </button>
                            </div>
                            <div className="recent-list">
                                {moves.length === 0 ? (
                                    <div className="empty">
                                        Aucun mouvement enregistré pour le
                                        moment.
                                    </div>
                                ) : (
                                    moves.slice(0, 4).map((m) => (
                                        <div className="recent-row" key={m.id}>
                                            <span
                                                className={`move-icon ${m.type === "IN" ? "positive" : "negative"}`}
                                            >
                                                {m.type === "IN" ? (
                                                    <ArrowDownToLine
                                                        size={16}
                                                    />
                                                ) : (
                                                    <ArrowLeftRight size={16} />
                                                )}
                                            </span>
                                            <div className="move-info">
                                                <b>{m.name}</b>
                                                <small>
                                                    {m.type === "IN"
                                                        ? "Entrée"
                                                        : m.type === "OUT"
                                                          ? "Sortie"
                                                          : "Ajustement"}{" "}
                                                    · {m.created_at}
                                                </small>
                                            </div>
                                            <strong
                                                className={
                                                    m.type === "IN"
                                                        ? "positive-text"
                                                        : "negative-text"
                                                }
                                            >
                                                {m.type === "IN" ? "+" : "−"}
                                                {m.quantity}
                                            </strong>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                    <section className="panel inventory-panel">
                        <div className="panel-head">
                            <div>
                                <h2>
                                    {view === "Alertes de stock"
                                        ? "Produits à surveiller"
                                        : view === "Mouvements"
                                          ? "Inventaire des produits"
                                          : "Inventaire des produits"}
                                </h2>
                                <p>
                                    Consultez et gérez vos références en un coup
                                    d’œil.
                                </p>
                            </div>
                            <button className="btn" onClick={exportCsv}>
                                <Download size={15} /> Exporter CSV
                            </button>
                        </div>
                        <div className="table-tools">
                            <label className="search">
                                <Search size={16} />
                                <input
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Rechercher un produit, SKU…"
                                />
                            </label>
                            <select
                                aria-label="Filtrer par catégorie"
                                value={category}
                                onChange={(e) => {
                                    setCategory(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">Toutes catégories</option>
                                {categories.map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </select>
                            <select
                                aria-label="Filtrer par état"
                                value={filterStatus}
                                onChange={(e) => {
                                    setFilterStatus(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">Tous les états</option>
                                <option value="ok">En stock</option>
                                <option value="low">Stock faible</option>
                                <option value="out">Rupture</option>
                            </select>
                            <button
                                className="btn"
                                onClick={() => {
                                    setQuery("");
                                    setCategory("");
                                    setFilterStatus("");
                                    setPage(1);
                                }}
                            >
                                <RefreshCw size={14} /> Réinitialiser
                            </button>
                        </div>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Produit</th>
                                        <th>Catégorie</th>
                                        <th>Prix d’achat</th>
                                        <th>Quantité</th>
                                        <th>État du stock</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="empty">
                                                Chargement de l’inventaire…
                                            </td>
                                        </tr>
                                    ) : shown.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="empty">
                                                Aucun produit trouvé.
                                            </td>
                                        </tr>
                                    ) : (
                                        shown.map((p) => (
                                            <tr key={p.id}>
                                                <td>
                                                    <div className="product-cell">
                                                        <span className="product-emoji">
                                                            {p.emoji}
                                                        </span>
                                                        <span>
                                                            <b>{p.name}</b>
                                                            <small>
                                                                {p.sku}
                                                            </small>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="muted">
                                                    {p.category}
                                                </td>
                                                <td>{money(p.price)}</td>
                                                <td>
                                                    <b>{p.quantity} unités</b>
                                                    <div className="stock-bar">
                                                        <span
                                                            className={status(
                                                                p,
                                                            )}
                                                            style={{
                                                                width: `${Math.min(100, (p.quantity / Math.max(1, p.min_stock * 2)) * 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td>
                                                    <span
                                                        className={`status ${status(p)}`}
                                                    >
                                                        {statusText(status(p))}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button
                                                            title="Entrée en stock"
                                                            onClick={() =>
                                                                move(p, "IN")
                                                            }
                                                        >
                                                            <Plus size={15} />
                                                        </button>
                                                        <button
                                                            title="Sortie de stock"
                                                            onClick={() =>
                                                                move(p, "OUT")
                                                            }
                                                        >
                                                            <Minus size={15} />
                                                        </button>
                                                        <button
                                                            title="Modifier"
                                                            onClick={() =>
                                                                openCreate(p)
                                                            }
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button
                                                            title="Supprimer"
                                                            onClick={() =>
                                                                remove(p)
                                                            }
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-footer">
                            <span>
                                {filtered.length} produit(s) · page {page}/
                                {pages}
                            </span>
                            <div>
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    ←
                                </button>
                                <button className="page-current">{page}</button>
                                <button
                                    disabled={page >= pages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    </section>
                    <footer>
                        Gestion de stock · Next.js + SQLite
                    </footer>
                </div>
            </section>
            {modal && (
                <div
                    className="modal-backdrop"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setModal(false);
                    }}
                >
                    <form className="modal" onSubmit={save}>
                        <div className="modal-head">
                            <div>
                                <h2>
                                    {editing
                                        ? "Modifier le produit"
                                        : "Ajouter un produit"}
                                </h2>
                                <p>Les champs marqués * sont obligatoires.</p>
                            </div>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setModal(false)}
                                aria-label="Fermer"
                            >
                                <X />
                            </button>
                        </div>
                        <div className="form-grid">
                            <Field label="Nom du produit *">
                                <input
                                    required
                                    maxLength={100}
                                    value={draft.name}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            name: e.target.value,
                                        })
                                    }
                                    placeholder="Clavier mécanique"
                                />
                            </Field>
                            <Field label="Référence SKU *">
                                <input
                                    required
                                    maxLength={32}
                                    value={draft.sku}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            sku: e.target.value,
                                        })
                                    }
                                    placeholder="ACC-005"
                                />
                            </Field>
                            <Field label="Catégorie *">
                                <input
                                    required
                                    maxLength={50}
                                    value={draft.category}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            category: e.target.value,
                                        })
                                    }
                                    placeholder="Accessoires"
                                />
                            </Field>
                            <Field label="Icône">
                                <select
                                    value={draft.emoji}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            emoji: e.target.value,
                                        })
                                    }
                                >
                                    {[
                                        "📦",
                                        "💻",
                                        "🖥️",
                                        "⌨️",
                                        "🖱️",
                                        "🎧",
                                        "🔌",
                                        "📷",
                                        "🔊",
                                        "🎙️",
                                    ].map((x) => (
                                        <option key={x}>{x}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Prix d’achat (Ar) *">
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    value={draft.price}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            price: Number(e.target.value),
                                        })
                                    }
                                />
                            </Field>
                            <Field label="Quantité *">
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={draft.quantity}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            quantity: Number(e.target.value),
                                        })
                                    }
                                />
                            </Field>
                            <Field label="Seuil d’alerte *">
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={draft.min_stock}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            min_stock: Number(e.target.value),
                                        })
                                    }
                                />
                            </Field>
                        </div>
                        {error && <p className="form-error">{error}</p>}
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn"
                                onClick={() => setModal(false)}
                            >
                                Annuler
                            </button>
                            <button type="submit" className="btn primary">
                                {editing ? "Enregistrer" : "Créer le produit"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {toast && <div className="toast">✓ &nbsp;{toast}</div>}
        </main>
    );
}
function Stat({
    icon,
    label,
    value,
    note,
    tone = "purple",
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    note: string;
    tone?: string;
}) {
    return (
        <article className="stat-card">
            <div className="stat-top">
                <span>{label}</span>
                <span className={`stat-icon ${tone}`}>{icon}</span>
            </div>
            <strong className="stat-number">{value}</strong>
            <small>{note}</small>
        </article>
    );
}
function Legend({
    color,
    label,
    value,
}: {
    color: string;
    label: string;
    value: number;
}) {
    return (
        <div className="legend-row">
            <span>
                <i className={color} />
                {label}
            </span>
            <b>{value}</b>
        </div>
    );
}
function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="field">
            <span>{label}</span>
            {children}
        </label>
    );
}
