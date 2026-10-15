import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
    title: "StockFlow — Gestion de stock",
    description:
        "Application locale de gestion de stock construite avec Next.js et SQLite.",
};
export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="fr">
            <body>{children}</body>
        </html>
    );
}
