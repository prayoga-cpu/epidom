"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Inbox,
  Clock,
  CheckCircle2,
  Archive,
  Copy,
  Check,
  Eye,
  Pencil,
  Search,
  X,
  Maximize2,
  Table2,
  Kanban,
  Rss,
  ArrowUpDown,
  type LucideIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type FeedbackType = "BUG" | "FEATURE_SUGGESTION" | "GENERAL_FEEDBACK";
type FeedbackStatus = "OPEN" | "IN_PROGRESS" | "NEEDS_REVIEW" | "RESOLVED" | "ARCHIVED";
type FeedbackPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type FeedbackView = "table" | "board" | "feed";

interface FeedbackRow {
  id: string;
  userName: string;
  userEmail: string;
  storeId: string | null;
  type: FeedbackType;
  page: string;
  description: string;
  screenshotUrl: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  devNote: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

const typeBadges: Record<
  FeedbackType,
  { label: string; variant: "destructive" | "default" | "secondary" }
> = {
  BUG: { label: "Bug", variant: "destructive" },
  FEATURE_SUGGESTION: { label: "Feature", variant: "default" },
  GENERAL_FEEDBACK: { label: "General", variant: "secondary" },
};

const STATUS_OPTIONS: FeedbackStatus[] = ["OPEN", "IN_PROGRESS", "NEEDS_REVIEW", "RESOLVED", "ARCHIVED"];

const statusLabels: Record<FeedbackStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  NEEDS_REVIEW: "Review",
  RESOLVED: "Resolved",
  ARCHIVED: "Archived",
};

// Grouping priority: active items surface first, archived sink to the bottom.
const STATUS_ORDER: Record<FeedbackStatus, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  NEEDS_REVIEW: 2,
  RESOLVED: 3,
  ARCHIVED: 4,
};

const statusColors: Record<FeedbackStatus, { row: string; select: string; ring: string }> = {
  OPEN: {
    row: "border-l-2 border-l-blue-500 bg-blue-500/[0.03]",
    select: "border-blue-500/40 text-blue-400",
    ring: "ring-blue-500/50",
  },
  IN_PROGRESS: {
    row: "border-l-2 border-l-amber-500 bg-amber-500/[0.03]",
    select: "border-amber-500/40 text-amber-400",
    ring: "ring-amber-500/50",
  },
  NEEDS_REVIEW: {
    row: "border-l-2 border-l-violet-500 bg-violet-500/[0.03]",
    select: "border-violet-500/40 text-violet-400",
    ring: "ring-violet-500/50",
  },
  RESOLVED: {
    row: "border-l-2 border-l-emerald-500 bg-emerald-500/[0.03]",
    select: "border-emerald-500/40 text-emerald-400",
    ring: "ring-emerald-500/50",
  },
  ARCHIVED: {
    row: "border-l-2 border-l-slate-500 bg-slate-500/[0.03]",
    select: "border-slate-500/40 text-slate-400",
    ring: "ring-slate-500/50",
  },
};

const PRIORITY_OPTIONS: FeedbackPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const priorityLabels: Record<FeedbackPriority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

// Higher-priority items sort first within a status group.
const PRIORITY_ORDER: Record<FeedbackPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const priorityColors: Record<FeedbackPriority, string> = {
  URGENT: "border-red-500/40 text-red-400",
  HIGH: "border-orange-500/40 text-orange-400",
  MEDIUM: "border-blue-500/40 text-blue-400",
  LOW: "border-slate-500/40 text-slate-400",
};

const VIEW_OPTIONS: { key: FeedbackView; label: string; icon: LucideIcon }[] = [
  { key: "table", label: "Table", icon: Table2 },
  { key: "board", label: "Board", icon: Kanban },
  { key: "feed", label: "Feed", icon: Rss },
];

type SortOption = "status" | "newest" | "oldest" | "priority";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "status", label: "Status (grouped)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Priority" },
];

const VIEW_STORAGE_KEY = "epidom-admin-feedback-view";
const FILTERS_STORAGE_KEY = "epidom-admin-feedback-filters";

interface StoredFilters {
  statusFilter: FeedbackStatus | "ALL";
  typeFilter: FeedbackType | "ALL";
  priorityFilter: FeedbackPriority | "ALL";
  sortBy: SortOption;
  search: string;
}

const DEFAULT_FILTERS: StoredFilters = {
  statusFilter: "ALL",
  typeFilter: "ALL",
  priorityFilter: "ALL",
  sortBy: "status",
  search: "",
};

// Called from a post-mount effect, not a lazy useState initializer — `window`
// is already defined by the client's first render (before hydration), so
// reading storage there would return real saved values while the server
// rendered the `typeof window === "undefined"` defaults, breaking hydration.
function readStoredView(): FeedbackView {
  if (typeof window === "undefined") return "table";
  const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return saved === "table" || saved === "board" || saved === "feed" ? saved : "table";
}

function readStoredFilters(): StoredFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const saved = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!saved) return DEFAULT_FILTERS;
    const parsed = JSON.parse(saved) as Partial<StoredFilters>;
    return {
      statusFilter:
        parsed.statusFilter === "ALL" || STATUS_OPTIONS.includes(parsed.statusFilter as FeedbackStatus)
          ? (parsed.statusFilter as FeedbackStatus | "ALL")
          : DEFAULT_FILTERS.statusFilter,
      typeFilter:
        parsed.typeFilter === "ALL" ||
        ["BUG", "FEATURE_SUGGESTION", "GENERAL_FEEDBACK"].includes(parsed.typeFilter as string)
          ? (parsed.typeFilter as FeedbackType | "ALL")
          : DEFAULT_FILTERS.typeFilter,
      priorityFilter:
        parsed.priorityFilter === "ALL" || PRIORITY_OPTIONS.includes(parsed.priorityFilter as FeedbackPriority)
          ? (parsed.priorityFilter as FeedbackPriority | "ALL")
          : DEFAULT_FILTERS.priorityFilter,
      sortBy: SORT_OPTIONS.some((o) => o.value === parsed.sortBy)
        ? (parsed.sortBy as SortOption)
        : DEFAULT_FILTERS.sortBy,
      search: typeof parsed.search === "string" ? parsed.search : DEFAULT_FILTERS.search,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

const DESCRIPTION_PREVIEW_LENGTH = 80;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface CopyableDescriptionProps {
  description: string;
  isLong: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function CopyableDescription({
  description,
  isLong,
  isExpanded,
  onToggleExpand,
}: CopyableDescriptionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(description);
      setCopied(true);
      toast.success("Description copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
      toast.error("Failed to copy description");
    }
  };

  const displayText =
    isLong && !isExpanded
      ? `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}…`
      : description;

  return (
    <div className="group relative flex flex-col items-start gap-1 w-full">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className="text-foreground relative w-full cursor-pointer rounded-lg border border-transparent px-2 py-1.5 -mx-2 text-left text-sm transition-all duration-150 hover:bg-muted/40 hover:border-border/30 active:scale-[0.99] group/text select-text"
          >
            <span className="break-words whitespace-pre-wrap">{displayText}</span>
            <div className="absolute right-2 top-2 opacity-40 transition-opacity duration-150 group-hover/text:opacity-100 flex items-center justify-center rounded-md border border-border/40 bg-card p-1 shadow-sm size-6 shrink-0 md:opacity-0">
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="z-[100]">
          <span className="flex items-center gap-1.5">
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-muted-foreground" />
                <span>Click to copy description</span>
              </>
            )}
          </span>
        </TooltipContent>
      </Tooltip>

      {isLong && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline transition-colors py-1 mt-0.5"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// Inline dev-note editor state
interface DevNoteEditorProps {
  feedbackId: string;
  currentNote: string | null;
  onSave: (id: string, note: string) => void;
  isSaving: boolean;
}

function DevNoteEditor({ feedbackId, currentNote, onSave, isSaving }: DevNoteEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentNote ?? "");

  const handleOpen = () => {
    setDraft(currentNote ?? "");
    setEditing(true);
  };
  const handleCancel = () => setEditing(false);
  const handleSave = () => {
    onSave(feedbackId, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-2 space-y-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a private dev note..."
          rows={3}
          className="text-xs resize-none"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-violet-500/20 px-2.5 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
          >
            Save note
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/note mt-2 flex items-start gap-1.5">
      {currentNote ? (
        <div className="flex flex-1 items-start gap-1.5 rounded-md bg-violet-500/10 border border-violet-500/20 px-2 py-1.5">
          <Eye className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
          <p className="flex-1 text-[11px] leading-relaxed text-violet-300 break-words whitespace-pre-wrap">{currentNote}</p>
          <button
            type="button"
            onClick={handleOpen}
            title="Edit note"
            className="shrink-0 rounded p-0.5 text-violet-400 opacity-0 transition-opacity hover:text-violet-200 group-hover/note:opacity-100"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-violet-400 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Add dev note
        </button>
      )}
    </div>
  );
}

interface FeedbackCardProps {
  row: FeedbackRow;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCopyId: (id: string) => void;
  onViewScreenshot: (url: string) => void;
  onPriorityChange: (id: string, priority: FeedbackPriority) => void;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  onSaveDevNote: (id: string, note: string) => void;
  onOpenDetail: (id: string) => void;
  isSaving: boolean;
}

function FeedbackCard({
  row,
  isExpanded,
  onToggleExpand,
  onCopyId,
  onViewScreenshot,
  onPriorityChange,
  onStatusChange,
  onSaveDevNote,
  onOpenDetail,
  isSaving,
}: FeedbackCardProps) {
  const isLong = row.description.length > DESCRIPTION_PREVIEW_LENGTH;

  return (
    <div
      className={`bg-card sm:border-border space-y-2 border-b p-2 sm:space-y-3 sm:rounded-xl sm:border sm:p-4 ${statusColors[row.status].row}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">{row.user?.name ?? row.userName}</p>
          <p className="text-muted-foreground truncate text-[8px] sm:text-xs">
            {row.user?.email ?? row.userEmail}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground text-[8px] whitespace-nowrap sm:text-xs">
            {formatDate(row.createdAt)}
          </span>
          <button
            type="button"
            onClick={() => onOpenDetail(row.id)}
            title="Open details"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={typeBadges[row.type].variant}>{typeBadges[row.type].label}</Badge>
        <span className="text-muted-foreground text-xs break-all">{row.page}</span>
        <button
          type="button"
          onClick={() => onCopyId(row.id)}
          className="text-muted-foreground font-mono text-[11px] hover:underline"
          title={row.id}
        >
          #{row.id.slice(0, 8)}
        </button>
      </div>

      <CopyableDescription
        description={row.description}
        isLong={isLong}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
      <DevNoteEditor
        feedbackId={row.id}
        currentNote={row.devNote}
        onSave={onSaveDevNote}
        isSaving={isSaving}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {row.screenshotUrl ? (
          <button
            type="button"
            onClick={() => onViewScreenshot(row.screenshotUrl!)}
            className="text-xs text-blue-400 hover:underline"
          >
            View
          </button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
        <div className="flex gap-2">
          <Select
            value={row.priority}
            onValueChange={(v) => onPriorityChange(row.id, v as FeedbackPriority)}
            disabled={isSaving}
          >
            <SelectTrigger size="sm" className={`w-[110px] font-medium ${priorityColors[row.priority]}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {priorityLabels[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={row.status}
            onValueChange={(v) => onStatusChange(row.id, v as FeedbackStatus)}
            disabled={isSaving}
          >
            <SelectTrigger size="sm" className={`w-[140px] font-medium ${statusColors[row.status].select}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function FeedbackBoardCard({ row, onOpen }: { row: FeedbackRow; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      className="border-border bg-card hover:border-foreground/30 hover:shadow-sm w-full space-y-2 rounded-lg border p-3 text-left transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant={typeBadges[row.type].variant} className="text-[10px]">
          {typeBadges[row.type].label}
        </Badge>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${priorityColors[row.priority]}`}>
          {priorityLabels[row.priority]}
        </span>
      </div>
      <p className="text-foreground line-clamp-2 text-xs leading-relaxed break-words">{row.description}</p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-muted-foreground truncate text-[11px]">
          {row.user?.name ?? row.userName}
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px]">{formatDate(row.createdAt)}</span>
      </div>
    </button>
  );
}

interface FeedbackDetailDialogProps {
  row: FeedbackRow | null;
  onClose: () => void;
  onCopyId: (id: string) => void;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  onPriorityChange: (id: string, priority: FeedbackPriority) => void;
  onSaveDevNote: (id: string, note: string) => void;
  onViewScreenshot: (url: string) => void;
  isSaving: boolean;
}

function FeedbackDetailDialog({
  row,
  onClose,
  onCopyId,
  onStatusChange,
  onPriorityChange,
  onSaveDevNote,
  onViewScreenshot,
  isSaving,
}: FeedbackDetailDialogProps) {
  return (
    <Dialog
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        {row && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <Badge variant={typeBadges[row.type].variant}>{typeBadges[row.type].label}</Badge>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColors[row.status].select}`}
                >
                  {statusLabels[row.status]}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyId(row.id)}
                  className="text-muted-foreground ml-auto font-mono text-[11px] hover:underline"
                  title={row.id}
                >
                  #{row.id.slice(0, 8)}
                </button>
              </div>
              <DialogTitle className="text-left text-base">
                {row.user?.name ?? row.userName}
              </DialogTitle>
              <p className="text-muted-foreground text-left text-xs">
                {row.user?.email ?? row.userEmail}
              </p>
            </DialogHeader>

            <div className="space-y-4">
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span>
                  Page: <span className="text-foreground">{row.page}</span>
                </span>
                <span>
                  {new Date(row.createdAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="border-border bg-muted/20 rounded-lg border p-3">
                <p className="text-foreground text-sm break-words whitespace-pre-wrap">
                  {row.description}
                </p>
              </div>

              {row.screenshotUrl && (
                <button
                  type="button"
                  onClick={() => onViewScreenshot(row.screenshotUrl!)}
                  className="block"
                >
                  <img
                    src={row.screenshotUrl}
                    alt="Feedback screenshot"
                    className="border-border max-h-64 rounded-md border object-contain"
                  />
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">Priority</p>
                  <Select
                    value={row.priority}
                    onValueChange={(v) => onPriorityChange(row.id, v as FeedbackPriority)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`w-full font-medium ${priorityColors[row.priority]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {priorityLabels[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">Status</p>
                  <Select
                    value={row.status}
                    onValueChange={(v) => onStatusChange(row.id, v as FeedbackStatus)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`w-full font-medium ${statusColors[row.status].select}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium">Dev note</p>
                <DevNoteEditor
                  feedbackId={row.id}
                  currentNote={row.devNote}
                  onSave={onSaveDevNote}
                  isSaving={isSaving}
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminFeedbackTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Initial values are the SSR-safe defaults — reading localStorage straight
  // in the initializer looked appealing (no flash-of-default) but `window` is
  // already defined by the time the client's first render runs, so it read
  // the real stored values before hydration and diverged from the
  // `typeof window === "undefined"` defaults the server rendered, breaking
  // hydration. The saved habit is applied a moment later, once mounted below.
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "ALL">(
    DEFAULT_FILTERS.statusFilter
  );
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "ALL">(DEFAULT_FILTERS.typeFilter);
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | "ALL">(
    DEFAULT_FILTERS.priorityFilter
  );
  const [search, setSearch] = useState(DEFAULT_FILTERS.search);
  const [view, setView] = useState<FeedbackView>("table");
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_FILTERS.sortBy);
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Apply the saved habit once mounted (client-only, post-hydration).
  useEffect(() => {
    const stored = readStoredFilters();
    setStatusFilter(stored.statusFilter);
    setTypeFilter(stored.typeFilter);
    setPriorityFilter(stored.priorityFilter);
    setSearch(stored.search);
    setSortBy(stored.sortBy);
    setView(readStoredView());
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [storageLoaded, view]);

  // Persist the last-used sort + filters (including which status stat-card
  // is active) so a reload or a closed tab picks up right where the admin
  // left off — the initial values above are read straight from storage.
  useEffect(() => {
    if (!storageLoaded) return;
    window.localStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({ statusFilter, typeFilter, priorityFilter, sortBy, search })
    );
  }, [storageLoaded, statusFilter, typeFilter, priorityFilter, sortBy, search]);

  const { data, isLoading, isError } = useQuery<{ feedback: FeedbackRow[] }>({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const res = await fetch("/api/admin/feedback");
      if (!res.ok) {
        throw new Error("Failed to load feedback");
      }
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: (body: {
      id: string;
      status?: FeedbackStatus;
      priority?: FeedbackPriority;
      devNote?: string;
    }) =>
      fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? "Request failed");
        }
        return r.json();
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      if (variables.devNote !== undefined) toast.success("Dev note saved");
      else if (variables.priority) toast.success("Priority updated");
      else toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const saveDevNote = (id: string, note: string) => {
    mutation.mutate({ id, devNote: note });
  };
  const updateStatus = (id: string, status: FeedbackStatus) => mutation.mutate({ id, status });
  const updatePriority = (id: string, priority: FeedbackPriority) => mutation.mutate({ id, priority });

  const rawRows = data?.feedback ?? [];

  // The API already returns createdAt desc, and Array#sort is stable, so
  // newest-first ordering is preserved within any tied group below.
  const rows = useMemo(() => {
    const sorted = [...rawRows];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "priority":
        sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        break;
      case "status":
      default:
        // Group by status (Open → In Progress → Resolved → Archived), then
        // by priority (Urgent → ... → Low) within each status group.
        sorted.sort(
          (a, b) =>
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        );
        break;
    }
    return sorted;
  }, [rawRows, sortBy]);

  const matchesBaseFilters = (r: FeedbackRow) => {
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack =
        `${r.user?.name ?? r.userName} ${r.user?.email ?? r.userEmail} ${r.description} ${r.page} ${r.id}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  // Table/feed views: fully filtered including the status badge filter.
  const filteredRows = useMemo(
    () => rows.filter((r) => matchesBaseFilters(r) && (statusFilter === "ALL" || r.status === statusFilter)),
    [rows, statusFilter, typeFilter, priorityFilter, search]
  );

  // Board view keeps all status columns visible; the status filter only
  // highlights the matching column instead of hiding the others.
  const boardBaseRows = useMemo(
    () => rows.filter(matchesBaseFilters),
    [rows, typeFilter, priorityFilter, search]
  );

  const feedRows = useMemo(
    () => [...filteredRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredRows]
  );

  const copyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    toast.success("ID copied");
  };

  const stats = {
    open: rows.filter((f) => f.status === "OPEN").length,
    inProgress: rows.filter((f) => f.status === "IN_PROGRESS").length,
    needsReview: rows.filter((f) => f.status === "NEEDS_REVIEW").length,
    resolved: rows.filter((f) => f.status === "RESOLVED").length,
    archived: rows.filter((f) => f.status === "ARCHIVED").length,
  };

  const statItems: { status: FeedbackStatus; label: string; value: number; icon: LucideIcon; color: string }[] = [
    { status: "OPEN", label: "Open", value: stats.open, icon: Inbox, color: "text-blue-400" },
    { status: "IN_PROGRESS", label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-amber-400" },
    { status: "NEEDS_REVIEW", label: "Review", value: stats.needsReview, icon: Eye, color: "text-violet-400" },
    { status: "RESOLVED", label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "text-emerald-400" },
    { status: "ARCHIVED", label: "Archived", value: stats.archived, icon: Archive, color: "text-slate-400" },
  ];

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    search.trim().length > 0;
  const clearFilters = () => {
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setPriorityFilter("ALL");
    setSearch("");
  };

  const detailRow = rows.find((r) => r.id === detailId) ?? null;

  const emptyLabel = hasActiveFilters ? "No feedback matches your filters" : "No feedback yet";

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-border bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
              <MessageSquare className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-foreground text-lg font-bold">Feedback</h1>
              <p className="text-muted-foreground text-xs">
                Bug reports and suggestions from users
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stats — click a card to filter the list to that status */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {statItems.map(({ status, label, value, icon: Icon, color }) => {
            const active = statusFilter === status;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStatusFilter(active ? "ALL" : status)}
                className={`border-border bg-card rounded-xl border p-4 text-left transition-all hover:border-foreground/20 ${
                  active ? `ring-2 ring-offset-2 ring-offset-background ${statusColors[status].ring}` : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-foreground text-2xl font-bold">{value}</p>
              </button>
            );
          })}
        </div>

        {/* Filter bar + view switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] max-w-xs flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search feedback..."
                className="border-border bg-card placeholder:text-muted-foreground text-foreground focus:border-ring w-full rounded-md border py-1.5 pr-2 pl-8 text-xs outline-none"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FeedbackType | "ALL")}>
              <SelectTrigger size="sm" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="BUG">Bug</SelectItem>
                <SelectItem value="FEATURE_SUGGESTION">Feature</SelectItem>
                <SelectItem value="GENERAL_FEEDBACK">General</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={(v) => setPriorityFilter(v as FeedbackPriority | "ALL")}
            >
              <SelectTrigger size="sm" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All priorities</SelectItem>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityLabels[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger size="sm" className="w-[160px]">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>

          <div className="bg-muted flex items-center gap-1 self-start rounded-lg p-1 sm:self-auto">
            {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table view */}
        {view === "table" && (
          <>
            <div className="space-y-3 lg:hidden">
              {isLoading && (
                <p className="text-muted-foreground py-12 text-center text-sm">Loading feedback...</p>
              )}
              {isError && (
                <p className="text-destructive py-12 text-center text-sm">
                  Failed to load feedback. Refresh the page or sign in again.
                </p>
              )}
              {!isLoading && !isError && filteredRows.length === 0 && (
                <p className="text-muted-foreground py-12 text-center text-sm">{emptyLabel}</p>
              )}
              {filteredRows.map((row) => (
                <FeedbackCard
                  key={row.id}
                  row={row}
                  isExpanded={expanded.has(row.id)}
                  onToggleExpand={() => toggleExpanded(row.id)}
                  onCopyId={copyId}
                  onViewScreenshot={setSelectedScreenshot}
                  onPriorityChange={updatePriority}
                  onStatusChange={updateStatus}
                  onSaveDevNote={saveDevNote}
                  onOpenDetail={setDetailId}
                  isSaving={mutation.isPending}
                />
              ))}
            </div>

            <div className="border-border bg-card hidden overflow-hidden rounded-xl border lg:block">
              <div className="overflow-x-auto">
                <div className="min-w-[1020px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">ID</TableHead>
                        <TableHead className="text-muted-foreground">Date</TableHead>
                        <TableHead className="text-muted-foreground">User</TableHead>
                        <TableHead className="text-muted-foreground">Type</TableHead>
                        <TableHead className="text-muted-foreground">Page</TableHead>
                        <TableHead className="text-muted-foreground">Description / Dev Note</TableHead>
                        <TableHead className="text-muted-foreground">Screenshot</TableHead>
                        <TableHead className="text-muted-foreground">Priority</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-muted-foreground py-12 text-center">
                            Loading feedback...
                          </TableCell>
                        </TableRow>
                      )}
                      {isError && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-destructive py-12 text-center">
                            Failed to load feedback. Refresh the page or sign in again.
                          </TableCell>
                        </TableRow>
                      )}
                      {!isLoading && !isError && filteredRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-muted-foreground py-12 text-center">
                            {emptyLabel}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredRows.map((row) => {
                        const isExpanded = expanded.has(row.id);
                        const isLong = row.description.length > DESCRIPTION_PREVIEW_LENGTH;

                        return (
                          <TableRow
                            key={row.id}
                            className={`border-border ${statusColors[row.status].row}`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => copyId(row.id)}
                                  className="text-muted-foreground font-mono text-xs hover:underline"
                                  title={row.id}
                                >
                                  #{row.id.slice(0, 8)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDetailId(row.id)}
                                  title="Open details"
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Maximize2 className="h-3 w-3" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                              {formatDate(row.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-foreground text-sm font-medium">
                                  {row.user?.name ?? row.userName}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {row.user?.email ?? row.userEmail}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={typeBadges[row.type].variant}>
                                {typeBadges[row.type].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[160px] truncate text-xs">
                              {row.page}
                            </TableCell>
                            <TableCell className="max-w-[360px]">
                              <CopyableDescription
                                description={row.description}
                                isLong={isLong}
                                isExpanded={isExpanded}
                                onToggleExpand={() => toggleExpanded(row.id)}
                              />
                              <DevNoteEditor
                                feedbackId={row.id}
                                currentNote={row.devNote}
                                onSave={saveDevNote}
                                isSaving={mutation.isPending}
                              />
                            </TableCell>
                            <TableCell>
                              {row.screenshotUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedScreenshot(row.screenshotUrl)}
                                  className="text-xs text-blue-400 hover:underline"
                                >
                                  View
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.priority}
                                onValueChange={(v) => updatePriority(row.id, v as FeedbackPriority)}
                                disabled={mutation.isPending}
                              >
                                <SelectTrigger
                                  size="sm"
                                  className={`w-[110px] font-medium ${priorityColors[row.priority]}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRIORITY_OPTIONS.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {priorityLabels[p]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.status}
                                onValueChange={(v) => updateStatus(row.id, v as FeedbackStatus)}
                                disabled={mutation.isPending}
                              >
                                <SelectTrigger
                                  size="sm"
                                  className={`w-[140px] font-medium ${statusColors[row.status].select}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {statusLabels[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Feed view — flat, newest-first card stream */}
        {view === "feed" && (
          <div className="mx-auto max-w-2xl space-y-3">
            {isLoading && (
              <p className="text-muted-foreground py-12 text-center text-sm">Loading feedback...</p>
            )}
            {isError && (
              <p className="text-destructive py-12 text-center text-sm">
                Failed to load feedback. Refresh the page or sign in again.
              </p>
            )}
            {!isLoading && !isError && feedRows.length === 0 && (
              <p className="text-muted-foreground py-12 text-center text-sm">{emptyLabel}</p>
            )}
            {feedRows.map((row) => (
              <div key={row.id} className="border-border overflow-hidden rounded-xl border">
                <FeedbackCard
                  row={row}
                  isExpanded={expanded.has(row.id)}
                  onToggleExpand={() => toggleExpanded(row.id)}
                  onCopyId={copyId}
                  onViewScreenshot={setSelectedScreenshot}
                  onPriorityChange={updatePriority}
                  onStatusChange={updateStatus}
                  onSaveDevNote={saveDevNote}
                  onOpenDetail={setDetailId}
                  isSaving={mutation.isPending}
                />
              </div>
            ))}
          </div>
        )}

        {/* Board view — Notion-style status columns */}
        {view === "board" && (
          <div>
            {isLoading && (
              <p className="text-muted-foreground py-12 text-center text-sm">Loading feedback...</p>
            )}
            {isError && (
              <p className="text-destructive py-12 text-center text-sm">
                Failed to load feedback. Refresh the page or sign in again.
              </p>
            )}
            {!isLoading && !isError && boardBaseRows.length === 0 && (
              <p className="text-muted-foreground py-12 text-center text-sm">{emptyLabel}</p>
            )}
            {!isLoading && !isError && boardBaseRows.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {STATUS_OPTIONS.map((status) => {
                  const columnRows = boardBaseRows.filter((r) => r.status === status);
                  const dimmed = statusFilter !== "ALL" && statusFilter !== status;
                  return (
                    <div
                      key={status}
                      className={`w-72 shrink-0 space-y-2 transition-opacity ${dimmed ? "opacity-40" : ""}`}
                    >
                      <div
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 ${statusColors[status].row}`}
                      >
                        <span className="text-foreground text-sm font-semibold">{statusLabels[status]}</span>
                        <span className="text-muted-foreground text-xs">{columnRows.length}</span>
                      </div>
                      <div className="min-h-[60px] space-y-2">
                        {columnRows.length === 0 && (
                          <p className="text-muted-foreground py-6 text-center text-xs">No items</p>
                        )}
                        {columnRows.map((row) => (
                          <FeedbackBoardCard key={row.id} row={row} onOpen={setDetailId} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-muted-foreground pb-4 text-center text-xs">
          {hasActiveFilters
            ? `${filteredRows.length} of ${rows.length} feedback ${rows.length === 1 ? "entry" : "entries"}`
            : `${rows.length} feedback ${rows.length === 1 ? "entry" : "entries"}`}
        </p>
      </div>

      {/* Ticket detail modal */}
      <FeedbackDetailDialog
        row={detailRow}
        onClose={() => setDetailId(null)}
        onCopyId={copyId}
        onStatusChange={updateStatus}
        onPriorityChange={updatePriority}
        onSaveDevNote={saveDevNote}
        onViewScreenshot={setSelectedScreenshot}
        isSaving={mutation.isPending}
      />

      {/* Screenshot preview dialog */}
      <Dialog
        open={!!selectedScreenshot}
        onOpenChange={(open) => {
          if (!open) setSelectedScreenshot(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {selectedScreenshot && (
            <>
              <img
                src={selectedScreenshot}
                alt="Feedback screenshot"
                className="max-h-[80vh] w-full rounded-md object-contain"
              />
              <a
                href={selectedScreenshot}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-400 hover:underline"
              >
                Open in new tab
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
