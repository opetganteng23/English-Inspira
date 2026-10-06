"use client";

export function LogoutButton() {
  return (
    <button
      className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-navy hover:bg-brand-tint"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/masuk";
      }}
    >
      Keluar
    </button>
  );
}
