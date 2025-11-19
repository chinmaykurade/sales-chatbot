import { useState } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000"

const Header = () => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isClearing, setIsClearing] = useState(false)
    const [confirmError, setConfirmError] = useState("")
    const [successMessage, setSuccessMessage] = useState("")

    const triggerSuccess = (message: string) => {
        setSuccessMessage(message)
        setTimeout(() => setSuccessMessage(""), 3000)
    }

    const handleClearTables = async () => {
        setIsClearing(true)
        setConfirmError("")
        try {
            const response = await fetch(`${API_BASE_URL}/tables`, {
                method: "DELETE"
            })

            if (!response.ok) {
                throw new Error("Failed to clear tables")
            }

            triggerSuccess("PostgreSQL tables cleared.")
            setIsConfirmOpen(false)
        } catch (error) {
            console.error("Clear tables failed:", error)
            setConfirmError("Unable to clear tables. Please try again.")
        } finally {
            setIsClearing(false)
        }
    }

    return (
        <>
            <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 px-8 py-7 shadow-2xl shadow-black/30 backdrop-blur-2xl text-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(76,201,240,0.25),_transparent_50%)]" />
                <div className="pointer-events-none absolute -left-32 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />

                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative h-14 w-14 overflow-hidden rounded-[24px] border border-white/20 bg-white/10">
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/80 via-sky-500/70 to-indigo-500/80" />
                                <div className="relative flex h-full items-center justify-center text-white">
                                    <svg className="h-8 w-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path
                                            d="M6 14a10 10 0 0110-10 10 10 0 0110 10v0c0 5.523-4.477 10-10 10h-1.5L10 28v-5.5C7.238 22.5 6 18.627 6 14z"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M19 8.5h.01M13 8.5h.01M21 12a5 5 0 01-10 0"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M22.5 19.5l1.5 2 2-3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>
                            </div>
                            <div>
                                <p className="mb-1 text-xs uppercase tracking-[0.35em] text-white/70">Blend360</p>
                                <p className="text-2xl font-semibold tracking-tight">Retail Insights Assistant</p>
                                <p className="text-sm text-white/70">AI-powered insights for modern merchandising and customer journeys</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsConfirmOpen(true)}
                            className="rounded-2xl border border-white/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:text-white"
                        >
                            Clear Tables
                        </button>
                    </div>
                </div>
            </header>

            {isConfirmOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) setIsConfirmOpen(false)
                    }}
                >
                    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-2xl">
                        <p className="text-base font-semibold">Clear all tables?</p>
                        <p className="mt-1 text-sm text-white/60">This will drop every table stored in PostgreSQL. This action cannot be undone.</p>

                        {confirmError && <p className="mt-3 text-sm text-rose-300">{confirmError}</p>}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white hover:text-white"
                                onClick={() => setIsConfirmOpen(false)}
                                disabled={isClearing}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleClearTables}
                                disabled={isClearing}
                                className="rounded-full bg-gradient-to-r from-rose-500 via-red-600 to-red-700 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-rose-500/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isClearing ? "Clearing..." : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-emerald-300/20 bg-emerald-500/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-emerald-500/40">
                    {successMessage}
                </div>
            )}
        </>
    )
}

export default Header
