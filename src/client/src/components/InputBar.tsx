import { useRef, useState } from "react"

const ACCEPTED_EXTENSIONS = ['xls', 'xlsx', 'csv', 'json', 'txt']
const API_BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000"

interface InputBarProps {
    currentMessage: string;
    setCurrentMessage: (value: string) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void;
}

const InputBar = ({ currentMessage, setCurrentMessage, onSubmit }: InputBarProps) => {
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [uploadError, setUploadError] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentMessage(e.target.value)
    }

    const toggleUploadModal = (open: boolean) => {
        setIsUploadOpen(open)
        if (!open) {
            setSelectedFiles([])
            setUploadError("")
        }
    }

    const handleFilesSelected = (fileList: FileList | null) => {
        if (!fileList) return
        const filesArray = Array.from(fileList)
        const validFiles = filesArray.filter(file => {
            const ext = file.name.split(".").pop()?.toLowerCase() || ""
            return ACCEPTED_EXTENSIONS.includes(ext)
        })
        const skipped = filesArray.length - validFiles.length
        if (skipped > 0) {
            setUploadError(`Skipped ${skipped} unsupported file${skipped > 1 ? 's' : ''}.`)
        } else {
            setUploadError("")
        }
        setSelectedFiles(prev => [...prev, ...validFiles])
    }

    const removeFile = (name: string) => {
        setSelectedFiles(prev => prev.filter(file => file.name !== name))
    }

    const triggerFilePicker = () => {
        fileInputRef.current?.click()
    }

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            setUploadError("Please select at least one file to upload.")
            return
        }

        setIsUploading(true)
        setUploadError("")
        try {
            const formData = new FormData()
            selectedFiles.forEach(file => formData.append("files", file))

            const response = await fetch(`${API_BASE_URL}/files`, {
                method: "POST",
                body: formData
            })

            if (!response.ok) {
                throw new Error("Upload failed")
            }

            const stored = localStorage.getItem("uploadedFiles")
            let existingEntries: any[] = []
            try {
                existingEntries = stored ? JSON.parse(stored) : []
            } catch {
                existingEntries = []
            }

            const newEntries = selectedFiles.map(file => ({
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString()
            }))

            localStorage.setItem("uploadedFiles", JSON.stringify([...existingEntries, ...newEntries]))
            setSelectedFiles([])
            setIsUploadOpen(false)
        } catch (error) {
            console.error("File upload failed:", error)
            setUploadError("Unable to upload files. Please try again.")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <>
            <form onSubmit={onSubmit} className="border-t border-white/10 bg-slate-950/30 px-6 py-5 backdrop-blur">
                <div className="flex flex-col gap-3 text-white/70 md:flex-row md:items-center">
                    <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 shadow-lg shadow-black/30 transition-colors focus-within:border-white/30">
                        <button
                            type="button"
                            aria-label="Add attachment"
                            onClick={() => toggleUploadModal(true)}
                            className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:border-white/40 hover:text-white"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <input
                            type="text"
                            placeholder="Ask anything about your deals, pipeline, or accounts..."
                            value={currentMessage}
                            onChange={handleChange}
                            className="flex-grow bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
                        />
                        <button
                            type="button"
                            aria-label="Insert template"
                            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:border-white/30 hover:text-white"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5h14M5 12h14M5 16.5h8" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            aria-label="Record voice"
                            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:border-white/30 hover:text-white"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a3 3 0 003-3V7a3 3 0 10-6 0v7a3 3 0 003 3z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11v2a7 7 0 01-14 0v-2m7 7v3" />
                            </svg>
                        </button>
                    </div>
                </div>
            </form>

            {isUploadOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) toggleUploadModal(false)
                    }}
                >
                    <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-2xl">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-base font-semibold">Upload supporting files</p>
                                <p className="text-sm text-white/60">Excel, CSV, JSON, or TXT (multiple files supported)</p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close upload dialog"
                                className="rounded-full border border-white/10 p-1 text-white/60 transition hover:border-white/40 hover:text-white"
                                onClick={() => toggleUploadModal(false)}
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                                </svg>
                            </button>
                        </div>

                        <div
                            className="mt-4 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-6 text-center text-white/70"
                            onClick={triggerFilePicker}
                        >
                            <p className="text-sm">Drag & drop files here or</p>
                            <button
                                type="button"
                                className="mt-3 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
                            >
                                Browse files
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".xls,.xlsx,.csv,.json,.txt"
                                multiple
                                onChange={(event) => {
                                    handleFilesSelected(event.target.files)
                                    if (event.target.value) {
                                        event.target.value = ''
                                    }
                                }}
                            />
                        </div>

                        <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
                            {selectedFiles.length === 0 && (
                                <p className="text-sm text-white/50">No files selected yet.</p>
                            )}
                            {selectedFiles.map(file => (
                                <div key={file.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                    <div className="flex flex-col text-sm">
                                        <span className="font-medium text-white">{file.name}</span>
                                        <span className="text-white/60">{(file.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(file.name)}
                                        className="rounded-full border border-white/15 p-1 text-white/60 hover:border-white/40 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {uploadError && (
                            <p className="mt-3 text-sm text-rose-300">{uploadError}</p>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white hover:text-white"
                                onClick={() => toggleUploadModal(false)}
                                disabled={isUploading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={isUploading || selectedFiles.length === 0}
                                className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-cyan-500/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isUploading ? "Uploading..." : "Upload files"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    )
}

export default InputBar
