import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Label Check",
  description: "Checks an alcohol beverage label against its application.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-2xl font-semibold tracking-tight">
              Label Check
            </Link>
            <nav className="flex gap-2 text-lg">
              <Link href="/" className="rounded-md px-3 py-2 hover:bg-stone-100">
                One label
              </Link>
              <Link href="/batch" className="rounded-md px-3 py-2 hover:bg-stone-100">
                Batch
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
