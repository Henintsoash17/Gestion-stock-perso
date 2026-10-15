# StockFlow — Gestion de stock

Application portfolio construite avec **Next.js App Router, React, TypeScript et SQLite**. Les données sont conservées dans `data/stockflow.db` sur la machine qui exécute le serveur. Aucun compte externe ni service cloud n'est nécessaire.

## Fonctionnalités
- Tableau de bord : nombre de références, valorisation du stock, stock faible et ruptures.
- Catalogue : recherche, filtres, création, modification et suppression protégée si le produit possède un historique de mouvements.
- Mouvements : entrées/sorties avec contrôle du stock disponible et enregistrement transactionnel.
- Seuils d'alerte par produit.
- Export CSV de l'inventaire filtré.
- Données fictives de démonstration initialisées au premier lancement : 24 produits, 5 catégories et 8 mouvements récents.
- SQLite local via `sql.js` (SQLite compilé en WebAssembly, sans module natif à compiler) ; API REST sous `app/api`.

## Prérequis
- Node.js 24.x recommandé (compatible aussi avec Node.js 22.13+)
- npm 10 ou plus récent

## Lancer en local
Dans le dossier du projet :
```bash
npm install
npm run dev
```

Si tu remplaces une ancienne version du projet sous Windows, supprime d’abord les dépendances installées et l’ancien fichier de verrouillage pour éviter de réutiliser `better-sqlite3` :
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```
Ouvrir http://localhost:3000. La base SQLite est créée automatiquement dans `data/stockflow.db`. Les données restent après redémarrage du serveur. Le projet utilise `sql.js` en WebAssembly pour éviter les erreurs de compilation native de `better-sqlite3` sous Node.js 24 sur Windows.

## Vérifier la compilation
```bash
npm run build
npm start
```

## Structure
```text
app/
  api/products/route.ts       # GET liste, POST création
  api/products/[id]/route.ts  # PATCH modification/mouvement, DELETE
  api/movements/route.ts      # historique des mouvements
  globals.css
  layout.tsx
  page.tsx
components/InventoryApp.tsx   # interface React interactive
lib/db.ts                    # initialisation et persistance SQLite locale
```

## Architecture / bonnes pratiques
- Les composants React utilisent des props et de l'état local ; la page délègue l'interface à `InventoryApp`.
- L'accès à SQLite est isolé côté serveur dans `lib/db.ts` et les routes API utilisent le runtime Node.js.
- Les saisies sont validées côté API ; les SKU sont uniques ; les sorties ne peuvent pas dépasser le stock disponible.
- Une transaction SQLite met à jour la quantité et journalise le mouvement ensemble.
- Le navigateur ne se connecte jamais directement à SQLite : il appelle l'API Next.js.

## À améliorer pour un déploiement réel
Ajouter authentification/autorisation, tests automatisés, migrations versionnées, pagination côté serveur, audit plus complet et sauvegardes. SQLite convient à une démo portfolio et à une instance locale ; pour plusieurs instances serveur ou une forte concurrence, envisager PostgreSQL.
