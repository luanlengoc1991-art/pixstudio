import React, { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { ImageInput, OptionCards, Section, Segmented, ToolLayout, usePendingToolImage } from "../common";
import { useChatGptJob } from "../common/chatgpt-job";
import { ChatGptResults } from "../common/chatgpt-results";
import { PromptPreview } from "../chatgpt-tool";
import {
  AD_PALETTES,
  AD_STEPS,
  AD_STYLE_CHIPS,
  DECOR_STYLES,
  DIMENSIONS,
  EVENT_PALETTES,
  EVENT_STYLE_CHIPS,
  EVENT_TYPES,
  Palette,
  PUBLICATIONS,
  RATIOS,
  SETUP_SCALES,
  SETUP_TYPES,
  TEXT_POSITIONS,
  VENUES,
} from "./data";
import { AdForm, AdReferences, advertisingPrompt, DEFAULT_FORM, DesignMode, eventPrompt, refineDesignPrompt } from "./prompts";
import { ImageList } from "./image-list";

const TOOL_ID = "ad-designer";

/** Small selectable pill. */
function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active ? "border-primary bg-primary/15 text-primary" : "border-base-content/15 bg-base-100 hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

/** Main and accent colour with preset palettes; empty means "AI chooses". */
function ColorsPicker({ form, set, palettes }: { form: AdForm; set: (patch: Partial<AdForm>) => void; palettes: Palette[] }) {
  const swatch = (key: "primary" | "accent", label: string) => (
    <label className="flex flex-1 items-center gap-2 rounded-xl border border-base-content/10 bg-base-100 px-2 py-1.5 text-[11px] font-semibold">
      <input
        type="color"
        className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
        value={form[key] || "#888888"}
        onChange={(e) => set({ [key]: e.target.value })}
      />
      <span className="flex-1">{form[key] ? `${label} ${form[key]}` : `${label}: AI tự chọn`}</span>
      {form[key] && (
        <button type="button" onClick={(e) => { e.preventDefault(); set({ [key]: "" }); }} aria-label={`Bỏ ${label}`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </label>
  );
  return (
    <>
      <div className="flex gap-2">
        {swatch("primary", "Màu chủ đạo")}
        {swatch("accent", "Màu nhấn")}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {palettes.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => set({ primary: p.primary, accent: p.accent })}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[10.5px] font-medium",
              form.primary === p.primary && form.accent === p.accent ? "border-primary bg-primary/10" : "border-base-content/10 bg-base-100 hover:border-primary/40",
            )}
          >
            <span className="flex shrink-0">
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.primary }} />
              <span className="-ml-1 h-3.5 w-3.5 rounded-full ring-1 ring-base-100" style={{ background: p.accent }} />
            </span>
            <span className="leading-tight">{p.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Text field with a label, single or multi line. */
function Field({ label, value, onChange, placeholder, rows }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-base-content/80">
      {label}
      {rows ? (
        <textarea className="textarea textarea-bordered textarea-sm w-full font-normal leading-5" rows={rows} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input input-bordered input-sm w-full font-normal" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
      <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export default function AdDesignerTool() {
  const { toast } = useToast();
  const job = useChatGptJob(TOOL_ID);
  const [form, setForm] = useState<AdForm>(DEFAULT_FORM);
  const set = (patch: Partial<AdForm>) => setForm((f) => ({ ...f, ...patch }));

  // Advertising references
  const [documents, setDocuments] = useState<string[]>([]);
  const [documentNotes, setDocumentNotes] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [fontRef, setFontRef] = useState("");
  const [fontLearn, setFontLearn] = useState({ font: true, effect: false, color: false });
  const [fontText, setFontText] = useState("");
  // Event references
  const [subjects, setSubjects] = useState<string[]>([]);
  const [setups, setSetups] = useState<string[]>([]);
  const [logos, setLogos] = useState<string[]>([]);

  // An image sent from another tool becomes a reference of the current mode
  usePendingToolImage(TOOL_ID, (path) => (form.mode === "event" ? setSubjects((p) => [...p, path]) : setDocuments((p) => [...p, path])));

  const event = EVENT_TYPES.find((e) => e.id === form.eventType) ?? EVENT_TYPES[0];
  const isEvent = form.mode === "event";

  const references: AdReferences = {
    documents: documents.map((path, i) => ({ path, note: documentNotes[i] ?? "" })),
    styles,
    font: fontRef ? { path: fontRef, learnFont: fontLearn.font, learnEffect: fontLearn.effect, learnColor: fontLearn.color, text: fontText } : null,
  };
  const imagePaths = isEvent ? [...subjects, ...setups, ...logos] : [...documents, ...styles, ...(fontRef ? [fontRef] : [])];

  const prompt = useMemo(
    () => (isEvent ? eventPrompt(form, { subjects, setups, logos }) : advertisingPrompt(form, references)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, subjects, setups, logos, documents, documentNotes, styles, fontRef, fontLearn, fontText],
  );

  const switchMode = (mode: DesignMode) => {
    if (mode === form.mode) return;
    if (mode === "event") {
      const setup = SETUP_TYPES.find((s) => s.id === event.defaultSetup) ?? SETUP_TYPES[0];
      set({ mode, setupType: setup.id, eventStyle: event.defaultStyleId, primary: event.palette.primary, accent: event.palette.accent, title: "", subtitle: "", details: "", direction: "" });
    } else {
      set({ mode, publication: "banner", ratio: "16:6", title: "", subtitle: "", details: "", primary: "", accent: "", direction: "" });
    }
  };

  const chooseEvent = (id: string) => {
    const next = EVENT_TYPES.find((e) => e.id === id)!;
    set({ eventType: id, setupType: next.defaultSetup, eventStyle: next.defaultStyleId, primary: next.palette.primary, accent: next.palette.accent });
  };

  const addChip = (chip: string) => {
    if (form.direction.toLowerCase().includes(chip.toLowerCase())) return;
    set({ direction: form.direction ? `${form.direction}, ${chip}` : chip });
  };

  const run = () => {
    if (!isEvent && !form.title.trim() && !documents.length && !styles.length) {
      toast({ title: "Còn thiếu thông tin", description: "Hãy nhập tiêu đề hoặc thêm ít nhất một ảnh tham chiếu." });
      return;
    }
    job.submit({ prompt, imagePaths, steps: AD_STEPS });
  };

  const advertisingAside = (
    <>
      <Section step="01" title="Loại ấn phẩm">
        <div className="grid grid-cols-3 gap-1.5">
          {PUBLICATIONS.map((p) => {
            const Icon = p.icon;
            const active = form.publication === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => set({ publication: p.id, ratio: p.ratio })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center text-[10.5px] font-bold leading-tight",
                  active ? "border-primary bg-primary/10 text-primary" : "border-base-content/10 bg-base-100 hover:border-primary/40",
                )}
                data-tooltip-id="tooltip"
                data-tooltip-content={p.description}
              >
                <Icon className="h-4 w-4" />
                {p.label}
                <span className="font-light text-base-content/60">{p.ratio}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1">
          {RATIOS.map((r) => (
            <Chip key={r} active={form.ratio === r} onClick={() => set({ ratio: r })}>
              {r}
            </Chip>
          ))}
        </div>
        {form.ratio === "Tùy chỉnh" && (
          <div className="flex items-center gap-2 text-xs">
            <input className="input input-bordered input-sm w-24" value={form.width} onChange={(e) => set({ width: e.target.value })} />×
            <input className="input input-bordered input-sm w-24" value={form.height} onChange={(e) => set({ height: e.target.value })} />
            px
          </div>
        )}
      </Section>

      <Section step="02" title="Nội dung chữ">
        <Field label="Tiêu đề chính" value={form.title} onChange={(v) => set({ title: v })} placeholder="VD: SALE 50% – Mừng khai trương" />
        <Field label="Nội dung phụ" value={form.subtitle} onChange={(v) => set({ subtitle: v })} placeholder="VD: Ưu đãi duy nhất 3 ngày" />
        <Field label="Thông tin chi tiết" value={form.details} onChange={(v) => set({ details: v })} placeholder="Thời gian, địa chỉ, số điện thoại, website..." rows={2} />
      </Section>

      <Section step="03" title="Màu sắc">
        <ColorsPicker form={form} set={set} palettes={AD_PALETTES} />
      </Section>

      <Section step="04" title="Phong cách & bối cảnh">
        <div className="flex flex-wrap gap-1">
          {AD_STYLE_CHIPS.map((chip) => (
            <Chip key={chip} active={form.direction.includes(chip)} onClick={() => addChip(chip)}>
              + {chip}
            </Chip>
          ))}
        </div>
        <Field label="Mô tả phong cách" value={form.direction} onChange={(v) => set({ direction: v })} placeholder="Hiện đại, chuyên nghiệp, thu hút..." rows={2} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Chữ tiêu đề" value={form.titleFont} onChange={(v) => set({ titleFont: v })} placeholder="Sans serif đậm 3D" />
          <Field label="Chữ nội dung" value={form.bodyFont} onChange={(v) => set({ bodyFont: v })} placeholder="Sans serif dễ đọc" />
        </div>
      </Section>

      <Section step="05" title="Ảnh tham chiếu" hint="Không bắt buộc. Ảnh được đánh số theo thứ tự gửi cho ChatGPT.">
        <ImageList
          label="Ảnh tài liệu"
          hint="Sản phẩm, logo, nội dung cần thể hiện. Ghi chú ngắn cho từng ảnh."
          paths={documents}
          onChange={setDocuments}
          notes={documentNotes}
          onNotesChange={setDocumentNotes}
          max={20}
          numberFrom={1}
          acceptPaste
        />
        <ImageList label="Ảnh phong cách" hint="Mẫu bố cục, màu sắc, ánh sáng muốn học theo." paths={styles} onChange={setStyles} max={10} numberFrom={documents.length + 1} />
        <div className="rounded-2xl border border-base-content/10 bg-base-100 p-2.5">
          <p className="mb-2 text-xs font-bold">Ảnh mẫu chữ (font)</p>
          <ImageInput toolId={TOOL_ID} compact acceptPaste={false} imagePath={fontRef} onChange={setFontRef} label="Ảnh có kiểu chữ muốn học theo" />
          {fontRef && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                <Chip active={fontLearn.font} onClick={() => setFontLearn((f) => ({ ...f, font: !f.font }))}>Font chữ</Chip>
                <Chip active={fontLearn.effect} onClick={() => setFontLearn((f) => ({ ...f, effect: !f.effect }))}>Hiệu ứng chữ</Chip>
                <Chip active={fontLearn.color} onClick={() => setFontLearn((f) => ({ ...f, color: !f.color }))}>Màu sắc</Chip>
                <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setFontRef("")}>Bỏ ảnh</button>
              </div>
              <Field label="Áp dụng cho chữ" value={fontText} onChange={setFontText} placeholder="VD: tiêu đề SALE 50%" />
            </div>
          )}
        </div>
      </Section>
    </>
  );

  const dimension = DIMENSIONS.find((d) => d.id === form.dimensionId);
  const eventAside = (
    <>
      <Section step="01" title="Loại sự kiện">
        <div className="grid grid-cols-5 gap-1.5">
          {EVENT_TYPES.map((e) => {
            const Icon = e.icon;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => chooseEvent(e.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-bold leading-tight",
                  form.eventType === e.id ? "border-primary bg-primary/10 text-primary" : "border-base-content/10 bg-base-100 hover:border-primary/40",
                )}
              >
                <Icon className="h-4 w-4" />
                {e.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section step="02" title="Kiểu dựng tấm formex">
        <OptionCards
          value={form.setupType}
          onChange={(id: string) => set({ setupType: id })}
          options={SETUP_TYPES.map((s) => ({ value: s.id, label: s.label, hint: s.description }))}
        />
      </Section>

      <Section step="03" title="Quy mô setup">
        <OptionCards
          value={form.setupScale}
          onChange={(id: string) => set({ setupScale: id })}
          options={SETUP_SCALES.map((s) => ({ value: s.id, label: `${s.label}${s.badge ? ` · ${s.badge}` : ""}`, hint: s.tagline }))}
        />
        <p className="text-[11px] font-light leading-4 text-base-content/60">{SETUP_SCALES.find((s) => s.id === form.setupScale)?.description}</p>
      </Section>

      <Section step="04" title="Kích thước">
        <div className="flex flex-wrap gap-1">
          {DIMENSIONS.map((d) => (
            <Chip key={d.id} active={form.dimensionId === d.id} onClick={() => set({ dimensionId: d.id, width: d.width ?? form.width, height: d.height ?? form.height })}>
              {d.label}
            </Chip>
          ))}
        </div>
        <p className="text-[11px] font-light text-base-content/60">{dimension?.desc}</p>
        {form.dimensionId === "custom" && (
          <div className="flex items-center gap-2 text-xs">
            <input className="input input-bordered input-sm w-24" value={form.width} onChange={(e) => set({ width: e.target.value })} />×
            <input className="input input-bordered input-sm w-24" value={form.height} onChange={(e) => set({ height: e.target.value })} />
            mm
          </div>
        )}
      </Section>

      <Section step="05" title="Nội dung chữ trên setup">
        <Field label="Tiêu đề chính" value={form.title} onChange={(v) => set({ title: v })} placeholder={event.content.headline} />
        <Field label="Tên nhân vật / chủ tiệc" value={form.subtitle} onChange={(v) => set({ subtitle: v })} placeholder={event.content.namesPlaceholder} />
        {(event.content.nicknamePlaceholder || event.content.agePlaceholder) && (
          <div className="grid grid-cols-2 gap-2">
            {event.content.nicknamePlaceholder && (
              <Field label="Tên ở nhà" value={form.nickname} onChange={(v) => set({ nickname: v })} placeholder={event.content.nicknamePlaceholder} />
            )}
            {event.content.agePlaceholder && (
              <Field label="Tuổi / Mốc" value={form.eventAge} onChange={(v) => set({ eventAge: v })} placeholder={event.content.agePlaceholder} />
            )}
          </div>
        )}
        <Field label="Ngày tổ chức" value={form.eventDate} onChange={(v) => set({ eventDate: v })} placeholder={event.content.datePlaceholder} />
        <Field label="Thông tin thêm" value={form.details} onChange={(v) => set({ details: v })} placeholder={event.content.extraPlaceholder} rows={2} />
      </Section>

      <Section step="06" title="Vị trí chữ nổi trên vách">
        <OptionCards
          columns={3}
          value={form.textPosition}
          onChange={(id: string) => set({ textPosition: id })}
          options={TEXT_POSITIONS.map((p) => ({ value: p.id, label: p.label, hint: p.tagline }))}
        />
        {form.textPosition === "custom" && (
          <Field
            label="Vị trí chữ mong muốn"
            value={form.customTextPosition}
            onChange={(v) => set({ customTextPosition: v })}
            placeholder="VD: Tiêu đề ở đỉnh vòm vách lớn, tên bé ở giữa vách tròn bên phải, số 1 gắn bục đôn..."
            rows={2}
          />
        )}
      </Section>

      <Section step="07" title="Phụ kiện & standee">
        <div className="grid grid-cols-1 gap-2">
          <Toggle label="Bục đôn" checked={form.includePedestals} onChange={(v) => set({ includePedestals: v })} />
          <Toggle label="Bóng bay / hoa" checked={form.includeBalloons} onChange={(v) => set({ includeBalloons: v })} />
          <Toggle label="Standee nhân vật" checked={form.includeStandee} onChange={(v) => set({ includeStandee: v })} />
        </div>
        {(form.includeStandee || subjects.length > 0) && (
          <Segmented
            value={form.characterStyle}
            onChange={(v: AdForm["characterStyle"]) => set({ characterStyle: v })}
            options={[
              { value: "original", label: "Giữ nguyên ảnh gốc" },
              { value: "chibi", label: "Chuyển sang Chibi 3D" },
            ]}
          />
        )}
      </Section>

      <Section step="08" title="Phong cách decor" hint="Bấm lại để bỏ chọn, AI sẽ tự chọn.">
        <OptionCards
          value={form.eventStyle}
          onChange={(id: string) => set({ eventStyle: form.eventStyle === id ? "" : id })}
          options={[...DECOR_STYLES.map((s) => ({ value: s.id, label: s.label, hint: s.desc })), { value: "custom", label: "Tự mô tả", hint: "Gõ phong cách riêng" }]}
        />
        {form.eventStyle === "custom" && (
          <Field label="Phong cách mong muốn" value={form.customEventStyle} onChange={(v) => set({ customEventStyle: v })} rows={2} />
        )}
      </Section>

      <Section step="09" title="Bối cảnh phía sau" hint="Bấm lại để bỏ chọn, AI sẽ tự chọn.">
        <OptionCards
          value={form.venue}
          onChange={(id: string) => set({ venue: form.venue === id ? "" : id })}
          options={[...VENUES.map((v) => ({ value: v.id, label: v.label, hint: v.desc })), { value: "custom", label: "Tự mô tả", hint: "Gõ bối cảnh riêng" }]}
        />
        {form.venue === "custom" && <Field label="Bối cảnh mong muốn" value={form.customVenue} onChange={(v) => set({ customVenue: v })} rows={2} />}
      </Section>

      <Section step="10" title="Màu sắc">
        <ColorsPicker form={form} set={set} palettes={EVENT_PALETTES} />
      </Section>

      <Section step="11" title="Ảnh tham chiếu" hint="Không bắt buộc. Ảnh được đánh số theo thứ tự gửi cho ChatGPT.">
        <ImageList label="Ảnh nhân vật (làm standee)" paths={subjects} onChange={setSubjects} max={10} numberFrom={1} acceptPaste />
        <ImageList label="Ảnh mẫu setup thực tế" paths={setups} onChange={setSetups} max={10} numberFrom={subjects.length + 1} />
        <ImageList label="Logo / biểu tượng" paths={logos} onChange={setLogos} max={5} numberFrom={subjects.length + setups.length + 1} />
      </Section>

      <Section step="12" title="Mô tả thêm">
        <div className="flex flex-wrap gap-1">
          {EVENT_STYLE_CHIPS.map((chip) => (
            <Chip key={chip} active={form.direction.includes(chip)} onClick={() => addChip(chip)}>
              + {chip}
            </Chip>
          ))}
        </div>
        <Field
          label="Yêu cầu riêng về bố cục, hoa bóng, đèn LED, bục đôn..."
          value={form.direction}
          onChange={(v) => set({ direction: v })}
          placeholder="VD: Tone pastel nhẹ nhàng, hoa hồng trắng kết hợp vòm cong, 2 bục đôn đặt bánh kem, standee bé cao 80cm..."
          rows={3}
        />
      </Section>
    </>
  );

  const aside = (
    <>
      <Segmented
        value={form.mode}
        onChange={switchMode}
        options={[
          { value: "advertising", label: "Ấn phẩm quảng cáo" },
          { value: "event", label: "Setup sự kiện" },
        ]}
      />
      {isEvent ? eventAside : advertisingAside}
      <PromptPreview prompt={prompt} />
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={job.running} onClick={run}>
      <Sparkles className="h-4 w-4" />
      {job.running ? "Đang xử lý..." : isEvent ? "Thiết kế setup bằng ChatGPT" : "Thiết kế bằng ChatGPT"}
    </button>
  );

  return (
    <ToolLayout toolId={TOOL_ID} aside={aside} footer={footer}>
      <ChatGptResults
        toolId={TOOL_ID}
        steps={AD_STEPS}
        resultLabel="Thiết kế"
        inputPaths={imagePaths}
        refinePrompt={refineDesignPrompt}
        sendToLayers
        emptyText={
          isEvent
            ? "Chọn loại sự kiện, kiểu dựng, quy mô và nội dung chữ rồi bấm \"Thiết kế setup bằng ChatGPT\". Kết quả sẵn sàng để bóc tách layer cắt CNC."
            : "Chọn loại ấn phẩm, nhập nội dung chữ và màu sắc rồi bấm \"Thiết kế bằng ChatGPT\". App tự gửi sang ChatGPT và lấy ảnh về đây."
        }
      />
    </ToolLayout>
  );
}
