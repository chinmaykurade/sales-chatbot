import React from 'react';

interface SearchInfo {
    stages: string[];
    query?: string;
    urls?: string[] | string;
    error?: string;
}

interface ToolCall {
    id: string;
    name: string;
}

interface Message {
    id: number;
    content: string;
    isUser: boolean;
    type: string;
    isLoading?: boolean;
    searchInfo?: SearchInfo;
    toolCalls?: ToolCall[];
}

interface MessageAreaProps {
    messages: Message[];
}

const PremiumTypingAnimation = () => (
    <div className="flex items-center space-x-2">
        {[0, 1, 2].map((index) => (
            <span
                key={index}
                className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse"
                style={{ animationDelay: `${index * 150}ms` }}
            />
        ))}
    </div>
);

interface StageIconProps {
    stage: string;
}

const StageIcon = ({ stage }: StageIconProps) => {
    switch (stage) {
        case "searching":
            return (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2M11 18a7 7 0 100-14 7 7 0 000 14z" />
                </svg>
            );
        case "reading":
            return (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5V6.75A2.25 2.25 0 016.25 4.5h11.5A2.25 2.25 0 0120 6.75V19.5l-4.75-2.25L10.5 19.5l-4.75-2.25L4 19.5z" />
                </svg>
            );
        case "writing":
            return (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 17.5L5.5 21l3.5-1.5 9-9a2.12 2.12 0 00-3-3l-9 9z" />
                </svg>
            );
        default:
            return (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
    }
};

interface SearchStagesProps {
    searchInfo?: SearchInfo;
}

const SearchStages = ({ searchInfo }: SearchStagesProps) => {
    if (!searchInfo?.stages?.length) return null;

    const stageDetails: Record<string, { label: string; tone: string }> = {
        searching: { label: "Searching the web", tone: "from-cyan-400/80 to-sky-500/60" },
        reading: { label: "Reading sources", tone: "from-sky-400/70 to-blue-500/60" },
        writing: { label: "Drafting insights", tone: "from-blue-400/70 to-indigo-500/60" },
        error: { label: "Search error", tone: "from-rose-500/70 to-orange-500/60" },
    };

    return (
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 shadow-inner shadow-black/20">
            <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/60">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Research Trail
            </p>
            <div className="space-y-3">
                {searchInfo.stages.map((stage) => (
                    <div
                        key={stage}
                        className={`flex flex-col gap-2 rounded-2xl bg-gradient-to-br ${(stageDetails[stage as keyof typeof stageDetails]?.tone) || 'from-slate-600/40 to-slate-700/40'} p-3 text-white shadow-md`}
                    >
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                            <StageIcon stage={stage} />
                            {stageDetails[stage as keyof typeof stageDetails]?.label || stage}
                        </div>

                        {stage === "searching" && searchInfo.query && (
                            <div className="rounded-2xl border border-white/30 bg-white/10 px-3 py-1 text-xs text-white/90">
                                {searchInfo.query}
                            </div>
                        )}

                        {stage === "reading" && searchInfo.urls && (
                            <div className="flex flex-wrap gap-2">
                                {(Array.isArray(searchInfo.urls) ? searchInfo.urls : [searchInfo.urls]).map((url, index) => (
                                    <span
                                        key={`${url}-${index}`}
                                        className="truncate rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px]"
                                    >
                                        {typeof url === 'string' ? url : JSON.stringify(url)}
                                    </span>
                                ))}
                            </div>
                        )}

                        {stage === "error" && (
                            <p className="text-xs text-rose-100/90">
                                {searchInfo.error || "An issue occurred while searching."}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ToolActivityProps {
    toolCalls?: ToolCall[];
}

const ToolActivity = ({ toolCalls }: ToolActivityProps) => {
    if (!toolCalls?.length) return null;

    return (
        <div className="w-full rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-white/80 shadow-inner shadow-black/20">
            <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-emerald-200/80">
                <svg className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tool Activity
            </p>
            <div className="space-y-2">
                {toolCalls.map((call) => (
                    <div key={call.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs shadow-inner shadow-black/10">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        <span className="font-semibold text-white">{call.name}</span>
                        <span className="text-white/60">running...</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface AvatarProps {
    isUser: boolean;
}

const Avatar = ({ isUser }: AvatarProps) => (
    <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-white shadow-lg ${isUser
            ? 'border-white/20 bg-gradient-to-br from-violet-500 to-purple-600'
            : 'border-white/15 bg-white/10'}`
        }
    >
        {isUser ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0" />
            </svg>
        ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )}
    </div>
);

const MessageArea = ({ messages }: MessageAreaProps) => {
    return (
        <div className="flex-grow overflow-y-auto bg-transparent" style={{ minHeight: 0 }}>
            <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 px-6 py-10">
                {messages.map((message) => (
                    <div key={message.id} className={`flex w-full gap-4 ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar isUser={message.isUser} />
                        <div className={`flex w-full max-w-xl flex-col gap-3 ${message.isUser ? 'items-end' : 'items-start'}`}>
                            {!message.isUser && message.toolCalls?.length && <ToolActivity toolCalls={message.toolCalls} />}
                            {!message.isUser && message.searchInfo && <SearchStages searchInfo={message.searchInfo} />}

                            <div
                                className={`w-full rounded-[28px] border px-6 py-4 text-base leading-relaxed shadow-xl shadow-black/20 ${message.isUser
                                    ? 'border-white/0 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-500 text-white'
                                    : 'border-white/10 bg-slate-900/60 text-white/90 backdrop-blur'}`
                                }
                            >
                                {message.isLoading ? (
                                    <PremiumTypingAnimation />
                                ) : (
                                    message.content || (
                                        <span className={`text-sm italic ${message.isUser ? 'text-white/70' : 'text-slate-500'}`}>Waiting for response...</span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MessageArea;

