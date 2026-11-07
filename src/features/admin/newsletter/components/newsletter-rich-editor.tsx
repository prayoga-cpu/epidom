"use client";

import { useI18n } from "@/components/lang/i18n-provider";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { compressImage, isValidImage } from "@/lib/utils/image-compression";
import { cn } from "@/lib/utils";

/**
 * A link that can render as a button: `data-variant="button"`, which the
 * email renderer (src/lib/newsletter/render.ts) styles as a call to action.
 */
const NewsletterLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      variant: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-variant"),
        renderHTML: (attributes) =>
          attributes.variant ? { "data-variant": attributes.variant } : {},
      },
    };
  },
});

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="size-10"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function LinkPopover({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [asButton, setAsButton] = useState(false);

  function openWithCurrent(next: boolean) {
    if (next) {
      const attrs = editor.getAttributes("link");
      setHref(attrs.href ?? "");
      setAsButton(attrs.variant === "button");
    }
    setOpen(next);
  }

  function apply() {
    const url = href.trim();
    if (!url) return;
    const withScheme = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: insert the address as the link text.
      chain.insertContent({
        type: "text",
        text: withScheme.replace(/^https?:\/\//, ""),
        marks: [{ type: "link", attrs: { href: withScheme, variant: asButton ? "button" : null } }],
      });
    } else {
      chain
        .setLink({ href: withScheme })
        .updateAttributes("link", { variant: asButton ? "button" : null });
    }
    chain.run();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={openWithCurrent}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          size="icon"
          className="size-10"
          aria-label={t("adminPages.newsletter.rich.link")}
          title={t("adminPages.newsletter.rich.link")}
          disabled={disabled}
        >
          <Link2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="space-y-1.5">
          <Label htmlFor="newsletter-link-url">{t("adminPages.newsletter.rich.linkAddress")}</Label>
          <Input
            id="newsletter-link-url"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://epidom.fr/pricing"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
          />
        </div>
        <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm">
          <span>
            {t("adminPages.newsletter.rich.asButton")}
            <span className="text-muted-foreground block text-xs">
              {t("adminPages.newsletter.rich.asButtonHint")}
            </span>
          </span>
          <Switch checked={asButton} onCheckedChange={setAsButton} />
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={apply}
            disabled={!href.trim()}
          >
            {t("adminPages.newsletter.rich.apply")}
          </Button>
          {editor.isActive("link") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setOpen(false);
              }}
            >
              {t("adminPages.newsletter.rich.removeLink")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  async function uploadImage(file: File) {
    if (!isValidImage(file)) {
      toast.error(t("adminPages.newsletter.toasts.badImage"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", await compressImage(file));
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data?.url) throw new Error(json?.error?.message || t("adminPages.newsletter.toasts.uploadFailed"));
      editor.chain().focus().setImage({ src: json.data.url, alt: "" }).run();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("adminPages.newsletter.toasts.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const chain = () => editor.chain().focus();

  return (
    <div className="border-border flex flex-wrap items-center gap-0.5 border-b p-1">
      <ToolbarButton
        label={t("adminPages.newsletter.rich.bold")}
        active={state.bold}
        disabled={disabled}
        onClick={() => chain().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.italic")}
        active={state.italic}
        disabled={disabled}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.underline")}
        active={state.underline}
        disabled={disabled}
        onClick={() => chain().toggleUnderline().run()}
      >
        <Underline className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.heading")}
        active={state.h2}
        disabled={disabled}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.subheading")}
        active={state.h3}
        disabled={disabled}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.bulleted")}
        active={state.bullet}
        disabled={disabled}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.numbered")}
        active={state.ordered}
        disabled={disabled}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.quote")}
        active={state.quote}
        disabled={disabled}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </ToolbarButton>
      <LinkPopover editor={editor} disabled={disabled} />
      <ToolbarButton
        label={t("adminPages.newsletter.rich.image")}
        disabled={disabled || uploading}
        onClick={() => fileInput.current?.click()}
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.divider")}
        disabled={disabled}
        onClick={() => chain().setHorizontalRule().run()}
      >
        <Minus className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.undo")}
        disabled={disabled || !state.canUndo}
        onClick={() => chain().undo().run()}
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={t("adminPages.newsletter.rich.redo")}
        disabled={disabled || !state.canRedo}
        onClick={() => chain().redo().run()}
      >
        <Redo2 className="size-4" />
      </ToolbarButton>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadImage(file);
        }}
      />
    </div>
  );
}

/**
 * The newsletter body editor. Emits HTML; the email renderer adds the inline
 * styles mail apps need, so what's stored stays plain.
 */
export function NewsletterRichEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      NewsletterLink.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Image,
      Placeholder.configure({ placeholder: t("adminPages.newsletter.rich.placeholder") }),
    ],
    content: value,
    // Pasted HTML switched to the editor comes back as what the editor kept.
    onCreate: ({ editor: e }) => {
      const html = e.isEmpty ? "" : e.getHTML();
      if (html !== value) onChange(html);
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // A campaign loaded after mount (or switched from pasted HTML) replaces the content.
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(value === "" && editor.isEmpty)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className={cn("border-input rounded-md border", disabled && "opacity-80")}>
      {editor && <Toolbar editor={editor} disabled={disabled} />}
      <EditorContent
        editor={editor}
        className={cn(
          "px-4 py-3 text-base",
          "[&_.ProseMirror]:min-h-72 [&_.ProseMirror]:outline-none",
          "[&_.ProseMirror_p]:my-3 [&_.ProseMirror_p]:leading-relaxed",
          "[&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold",
          "[&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold",
          "[&_.ProseMirror_ul]:my-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6",
          "[&_.ProseMirror_ol]:my-3 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6",
          "[&_.ProseMirror_li_p]:my-1",
          "[&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:pl-4",
          "[&_.ProseMirror_hr]:my-6",
          "[&_.ProseMirror_img]:mx-auto [&_.ProseMirror_img]:my-3 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg",
          "[&_.ProseMirror_img.ProseMirror-selectednode]:ring-primary [&_.ProseMirror_img.ProseMirror-selectednode]:ring-2",
          "[&_.ProseMirror_a]:underline",
          "[&_.ProseMirror_a[data-variant=button]]:inline-block [&_.ProseMirror_a[data-variant=button]]:rounded-md [&_.ProseMirror_a[data-variant=button]]:bg-neutral-700 [&_.ProseMirror_a[data-variant=button]]:px-6 [&_.ProseMirror_a[data-variant=button]]:py-2.5 [&_.ProseMirror_a[data-variant=button]]:text-sm [&_.ProseMirror_a[data-variant=button]]:font-bold [&_.ProseMirror_a[data-variant=button]]:tracking-wide [&_.ProseMirror_a[data-variant=button]]:text-white [&_.ProseMirror_a[data-variant=button]]:uppercase [&_.ProseMirror_a[data-variant=button]]:no-underline",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
        )}
      />
    </div>
  );
}
