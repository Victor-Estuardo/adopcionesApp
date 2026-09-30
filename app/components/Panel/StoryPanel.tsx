import type { status_pet, story_category, story_status } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  LuArrowDown,
  LuArrowUp,
  LuImagePlus,
  LuStar,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import { Select } from "~/components/Input/Select";
import { Textarea } from "~/components/Input/Textarea";
import { Modal } from "~/components/Modal/Modal";
import { useFocusTrap } from "~/hooks/useFocusTrap";
import type { StoryActionData } from "~/routes/__admin/historias/index";
import {
  STORY_IMAGE_MAX_MB,
  STORY_IMAGE_MIME_TYPES,
  STORY_MAX_IMAGES,
} from "~/services/cloudinary/fileConstraints";
import type {
  AdminStory,
  StoryFieldErrors,
  StoryStatusAction,
} from "~/services/db/story.service";
import { compressImage, storyImageUrl } from "~/utils/image";
import { PET_STATUS_CONFIG } from "~/utils/pet-helpers";
import {
  formatStoryDate,
  STORY_ALT_MAX,
  STORY_BODY_MAX,
  STORY_CATEGORY_CONFIG,
  STORY_CATEGORY_OPTIONS,
  STORY_STATUS_CONFIG,
  STORY_SUMMARY_MAX,
  STORY_TITLE_MAX,
} from "~/utils/story-helpers";

/*==============================| Tipos |==============================*/
type PanelStory = SerializeFrom<AdminStory>;
export type StoryPetOption = { id: number; name: string; status: status_pet };

interface StoryPanelProps {
  /** `null` = crear; si no, la historia a editar (del loader). */
  story: PanelStory | null;
  pets: StoryPetOption[];
  cloudName: string;
  /** Sin permiso Actualizar no se gestionan fotos al crear. */
  allowedToUpdate: boolean;
  onClose: () => void;
  /** Tras crear (y subir las fotos pendientes): abrir la historia en edición. */
  onCreated: (storyId: number) => void;
}

type FormValues = {
  category: story_category | "";
  title: string;
  slug: string;
  summary: string;
  body: string;
  event_date: string;
  pet_id: number | null;
};

type FieldKey = keyof FormValues;

/** Foto elegida localmente, aún no subida. */
type PendingImage = {
  tempId: string;
  file: File;
  previewUrl: string;
  alt: string;
  compressing: boolean;
};

type Confirm =
  | { kind: "status"; action: StoryStatusAction }
  | { kind: "remove-image"; imageId: number; index: number }
  | { kind: "discard" };

const FIELD_ORDER: FieldKey[] = [
  "category",
  "title",
  "slug",
  "summary",
  "body",
  "event_date",
  "pet_id",
];

const STATUS_ACTIONS: Record<
  StoryStatusAction,
  {
    label: string;
    title: string;
    message: string;
    confirm: string;
    success: string;
    tone: "primary" | "neutral";
  }
> = {
  publish: {
    label: "Publicar",
    title: "Publicar historia",
    message:
      "La historia será visible para todo el público y se podrá compartir. Una vez publicada, su enlace ya no podrá cambiar.",
    confirm: "Publicar",
    success: "Historia publicada.",
    tone: "primary",
  },
  unpublish: {
    label: "Despublicar",
    title: "Despublicar historia",
    message:
      "La historia dejará de ser visible para el público y volverá a Borrador. Los enlaces ya compartidos mostrarán «no encontrada».",
    confirm: "Despublicar",
    success: "La historia volvió a Borrador.",
    tone: "neutral",
  },
  archive: {
    label: "Archivar",
    title: "Archivar historia",
    message:
      "La historia se ocultará del público y quedará archivada. Podrás restaurarla como borrador cuando quieras.",
    confirm: "Archivar",
    success: "Historia archivada.",
    tone: "neutral",
  },
  restore: {
    label: "Restaurar",
    title: "Restaurar historia",
    message: "La historia volverá a Borrador para que puedas editarla y publicarla de nuevo.",
    confirm: "Restaurar",
    success: "Historia restaurada como borrador.",
    tone: "primary",
  },
};

const AVAILABLE_ACTIONS: Record<story_status, StoryStatusAction[]> = {
  Borrador: ["publish", "archive"],
  Publicada: ["unpublish", "archive"],
  Archivada: ["restore"],
};

/** Mascota sugerida por categoría (RF-A08): solo ordena, no restringe. */
const SUGGESTED_PET_STATUS: Record<story_category, status_pet> = {
  Finales_felices: "Adoptado",
  Camino_arcoiris: "Fallecido",
};

const ACCEPT = STORY_IMAGE_MIME_TYPES.join(",");
const MAX_BYTES = STORY_IMAGE_MAX_MB * 1024 * 1024;

// Clases compartidas (objetivo táctil ≥ 44 px en móvil + foco visible).
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/60 focus-visible:ring-offset-1";
const INPUT_CLASS = `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-medium-turquoise-meraki focus:outline-none focus:ring-2 focus:ring-medium-turquoise-meraki/30 aria-[invalid=true]:border-[#B42318]`;
const ICON_BUTTON = `flex h-11 w-11 items-center justify-center rounded-lg border border-[#E4E0D6] bg-white text-[#3A362E] transition-colors hover:bg-[#F4F2EC] disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ${FOCUS}`;

function initialValues(story: PanelStory | null): FormValues {
  return {
    category: story?.category ?? "",
    title: story?.title ?? "",
    slug: story?.slug ?? "",
    summary: story?.summary ?? "",
    body: story?.body ?? "",
    event_date: story?.event_date ? story.event_date.slice(0, 10) : "",
    pet_id: story?.pet_id ?? null,
  };
}

function initialAlts(story: PanelStory | null): Record<number, string> {
  return Object.fromEntries(
    (story?.images ?? []).map((img) => [img.id, img.alt_text ?? ""]),
  );
}

/** Validación de cliente: mismas reglas que `parseStoryInput` en el servidor. */
function validate(values: FormValues, isEditing: boolean): StoryFieldErrors {
  const errors: StoryFieldErrors = {};
  if (!values.category) errors.category = "Selecciona una categoría.";
  if (!values.title.trim()) errors.title = "Escribe un título.";
  else if (values.title.length > STORY_TITLE_MAX)
    errors.title = `El título no puede superar ${STORY_TITLE_MAX} caracteres.`;
  if (values.summary.length > STORY_SUMMARY_MAX)
    errors.summary = `El resumen no puede superar ${STORY_SUMMARY_MAX} caracteres.`;
  if (values.body.length > STORY_BODY_MAX)
    errors.body = `El texto no puede superar ${STORY_BODY_MAX} caracteres.`;
  if (isEditing && values.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
    errors.slug =
      "El enlace solo puede tener minúsculas, números y guiones (sin tildes ni espacios).";
  return errors;
}

/*==============================| Insignia de estado |==============================*/
export function StoryStatusBadge({ status }: { status: story_status }) {
  const cfg = STORY_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

/*==============================| Panel |==============================*/
/**
 * Panel lateral para crear/editar una historia (patrón PetPanel + foco
 * atrapado). Los campos de texto se guardan con "Guardar"; las operaciones de
 * fotos de una historia ya creada (subir, quitar, ordenar, portada) se
 * aplican al momento, una petición por foto para no superar el límite de
 * tamaño del cuerpo en Vercel. Al crear, las fotos elegidas se suben justo
 * después de guardar el borrador.
 */
export function StoryPanel({
  story,
  pets,
  cloudName,
  allowedToUpdate,
  onClose,
  onCreated,
}: StoryPanelProps) {
  const isEditing = story !== null;
  const titleId = useId();
  const baseId = useId();
  const fid = (key: string) => `${baseId}-${key}`;

  const saveFetcher = useFetcher<StoryActionData>();
  const statusFetcher = useFetcher<StoryActionData>();
  const imageFetcher = useFetcher<StoryActionData>();
  const uploadFetcher = useFetcher<StoryActionData>();

  /*------------------------------ESTADO------------------------------*/
  const [values, setValues] = useState<FormValues>(() => initialValues(story));
  const [savedValues, setSavedValues] = useState<FormValues>(() =>
    initialValues(story),
  );
  const [alts, setAlts] = useState<Record<number, string>>(() =>
    initialAlts(story),
  );
  const [savedAlts, setSavedAlts] = useState<Record<number, string>>(() =>
    initialAlts(story),
  );
  const [errors, setErrors] = useState<StoryFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [focusErrorTick, setFocusErrorTick] = useState(0);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  // Fotos locales: al crear se acumulan aquí; al editar pasan directo a la cola.
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [queue, setQueue] = useState<PendingImage[]>([]);
  const [uploadStoryId, setUploadStoryId] = useState<number | null>(
    story?.id ?? null,
  );
  const [createdId, setCreatedId] = useState<number | null>(null);
  const inFlight = useRef<string | null>(null);
  const uploadFailures = useRef(0);

  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});
  const comboboxEscape = useRef<(() => boolean) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = story?.images ?? [];
  const isSaving = saveFetcher.state !== "idle";
  const isUploading = queue.length > 0 || uploadFetcher.state !== "idle";
  const imageBusy = imageFetcher.state !== "idle" || isUploading;
  const slugLocked = Boolean(story?.published_at);

  const isDirty = useMemo(() => {
    const keys = Object.keys(values) as FieldKey[];
    const fieldsChanged = keys.some((k) => values[k] !== savedValues[k]);
    const altsChanged = Object.keys(alts).some(
      (id) => alts[Number(id)] !== savedAlts[Number(id)],
    );
    return fieldsChanged || altsChanged || pending.length > 0;
  }, [values, savedValues, alts, savedAlts, pending.length]);

  const photoCount = images.length + pending.length + queue.length;
  const remainingSlots = Math.max(0, STORY_MAX_IMAGES - photoCount);

  /*------------------------------FOCO Y CIERRE------------------------------*/
  const requestClose = () => {
    if (isSaving || isUploading) {
      toast.info("Espera a que termine de guardarse.");
      return;
    }
    if (isDirty) {
      setConfirm({ kind: "discard" });
      return;
    }
    onClose();
  };

  const handleEscape = () => {
    // Con un modal de confirmación abierto, Escape solo cierra el modal.
    if (confirm) return;
    // Si la lista de mascotas está abierta, Escape la cierra a ella.
    if (comboboxEscape.current?.()) return;
    requestClose();
  };

  const containerRef = useFocusTrap<HTMLDivElement>(true, handleEscape);

  // Aviso del navegador si hay cambios sin guardar y se sale de la página.
  useEffect(() => {
    if (!isDirty && !isUploading) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, isUploading]);

  // El servidor puede regenerar el slug al cambiar el título (borradores):
  // se refleja en el campo sin marcarlo como cambio pendiente.
  useEffect(() => {
    if (!story) return;
    setValues((prev) => ({ ...prev, slug: story.slug }));
    setSavedValues((prev) => ({ ...prev, slug: story.slug }));
  }, [story?.slug]);

  // Foco al primer campo con error.
  useEffect(() => {
    if (!focusErrorTick) return;
    const first = FIELD_ORDER.find((key) => errors[key]);
    if (first) fieldRefs.current[first]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusErrorTick]);

  // Libera las vistas previas al desmontar.
  const previewsRef = useRef<string[]>([]);
  useEffect(() => {
    previewsRef.current = [...pending, ...queue].map((p) => p.previewUrl);
  }, [pending, queue]);
  useEffect(
    () => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  /*------------------------------GUARDAR------------------------------*/
  const setField = <K extends FieldKey>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    const nextErrors = validate(values, isEditing);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFocusErrorTick((t) => t + 1);
      return;
    }
    if (pending.some((p) => p.compressing)) {
      toast.info("Espera a que terminen de optimizarse las fotos.");
      return;
    }

    const fd = new FormData();
    fd.set("intent", isEditing ? "update" : "create");
    if (story) fd.set("story_id", String(story.id));
    fd.set("category", values.category);
    fd.set("title", values.title);
    fd.set("summary", values.summary);
    fd.set("body", values.body);
    fd.set("event_date", values.event_date);
    fd.set("pet_id", values.pet_id ? String(values.pet_id) : "");
    if (isEditing && !slugLocked && values.slug !== savedValues.slug) {
      fd.set("slug", values.slug);
    }
    for (const img of images) {
      if ((alts[img.id] ?? "") !== (savedAlts[img.id] ?? "")) {
        fd.append("image_id", String(img.id));
        fd.append("image_alt", alts[img.id] ?? "");
      }
    }
    saveFetcher.submit(fd, { method: "post" });
  };

  // Resultado de crear/guardar.
  const wasSaving = useRef(false);
  useEffect(() => {
    if (saveFetcher.state !== "idle") {
      wasSaving.current = true;
      return;
    }
    if (!wasSaving.current) return;
    wasSaving.current = false;
    const data = saveFetcher.data;
    if (!data) return;

    if (!data.ok) {
      setServerError(data.errorMsg);
      if (data.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
        setErrors(data.fieldErrors);
        setFocusErrorTick((t) => t + 1);
      }
      return;
    }

    if (data.intent === "create" && data.storyId) {
      setSavedValues(values);
      if (pending.length > 0) {
        // Se suben ahora las fotos elegidas al crear.
        setCreatedId(data.storyId);
        setUploadStoryId(data.storyId);
        uploadFailures.current = 0;
        setQueue(pending);
        setPending([]);
      } else {
        toast.success("Borrador creado.");
        onCreated(data.storyId);
      }
      return;
    }

    toast.success("Cambios guardados.");
    setSavedValues(values);
    setSavedAlts(alts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveFetcher.state, saveFetcher.data]);

  /*------------------------------COLA DE SUBIDA------------------------------*/
  // Una foto por petición: procesa la cola en orden.
  useEffect(() => {
    if (uploadFetcher.state !== "idle") return;

    if (inFlight.current) {
      const finished = inFlight.current;
      inFlight.current = null;
      const data = uploadFetcher.data;
      if (!data?.ok) {
        uploadFailures.current += 1;
        toast.error(data?.errorMsg ?? "No se pudo subir una foto.");
      }
      setQueue((prev) => {
        const item = prev.find((p) => p.tempId === finished);
        if (item) URL.revokeObjectURL(item.previewUrl);
        return prev.filter((p) => p.tempId !== finished);
      });
      return;
    }

    const next = queue[0];
    if (next && uploadStoryId) {
      const fd = new FormData();
      fd.set("intent", "add-images");
      fd.set("story_id", String(uploadStoryId));
      fd.append("images", next.file);
      fd.append("alt_text", next.alt);
      inFlight.current = next.tempId;
      uploadFetcher.submit(fd, {
        method: "post",
        encType: "multipart/form-data",
      });
      return;
    }

    // Cola vacía tras crear: abrir la historia en modo edición.
    if (!next && createdId) {
      const failed = uploadFailures.current;
      toast.success(
        failed
          ? `Borrador creado. ${failed} ${failed === 1 ? "foto no se pudo subir" : "fotos no se pudieron subir"}.`
          : "Borrador creado con sus fotos.",
      );
      setCreatedId(null);
      onCreated(createdId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadFetcher.state, queue, uploadStoryId, createdId]);

  /*------------------------------FOTOS------------------------------*/
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const rejected = files.filter((f) => !STORY_IMAGE_MIME_TYPES.includes(f.type));
    if (rejected.length > 0) {
      toast.error(
        `Formato no permitido (${rejected.map((f) => f.name).join(", ")}). Usa JPG, PNG o WEBP.`,
      );
    }
    let accepted = files.filter((f) => STORY_IMAGE_MIME_TYPES.includes(f.type));
    if (accepted.length > remainingSlots) {
      toast.error(
        `Máximo ${STORY_MAX_IMAGES} fotos por historia: solo se agregarán ${remainingSlots}.`,
      );
      accepted = accepted.slice(0, remainingSlots);
    }
    if (accepted.length === 0) return;

    const items: PendingImage[] = accepted.map((file) => ({
      tempId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      alt: "",
      compressing: true,
    }));

    const compressAll = () =>
      Promise.all(
        items.map(async (item) => {
          let file = item.file;
          try {
            file = await compressImage(item.file);
          } catch {
            // Si el navegador no puede procesarla, se envía la original.
          }
          return { ...item, file, compressing: false };
        }),
      );

    if (!isEditing) {
      // Al crear: vista previa inmediata y compresión en segundo plano.
      setPending((prev) => [...prev, ...items]);
      const done = await compressAll();
      const tooBig = done.filter((i) => i.file.size > MAX_BYTES);
      setPending((prev) =>
        prev
          .filter((p) => !tooBig.some((t) => t.tempId === p.tempId))
          .map((p) => done.find((d) => d.tempId === p.tempId) ?? p),
      );
      tooBig.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      if (tooBig.length) {
        toast.error(
          `Estas fotos superan ${STORY_IMAGE_MAX_MB} MB: ${tooBig.map((i) => i.file.name).join(", ")}.`,
        );
      }
      return;
    }

    // Al editar: se comprimen y se suben de inmediato (una por petición).
    const done = await compressAll();
    const tooBig = done.filter((i) => i.file.size > MAX_BYTES);
    tooBig.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    if (tooBig.length) {
      toast.error(
        `Estas fotos superan ${STORY_IMAGE_MAX_MB} MB: ${tooBig.map((i) => i.file.name).join(", ")}.`,
      );
    }
    const ok = done.filter((i) => i.file.size <= MAX_BYTES);
    if (ok.length) {
      uploadFailures.current = 0;
      setQueue((prev) => [...prev, ...ok]);
    }
  };

  const submitImageIntent = (fields: Record<string, string | string[]>) => {
    if (!story) return;
    const fd = new FormData();
    fd.set("story_id", String(story.id));
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) value.forEach((v) => fd.append(key, v));
      else fd.set(key, value);
    }
    imageFetcher.submit(fd, { method: "post" });
  };

  const moveSaved = (index: number, delta: -1 | 1) => {
    const ids = images.map((img) => String(img.id));
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    submitImageIntent({ intent: "reorder-images", image_ids: ids });
  };

  const movePending = (index: number, delta: -1 | 1) => {
    setPending((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // Al crear, la portada es la primera foto: "hacer portada" la pasa al frente.
  const movePendingToFront = (index: number) => {
    setPending((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      return [item, ...next];
    });
  };

  const removePending = (tempId: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.tempId === tempId);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.tempId !== tempId);
    });
  };

  // Errores de las operaciones inmediatas de fotos.
  const wasImageBusy = useRef(false);
  useEffect(() => {
    if (imageFetcher.state !== "idle") {
      wasImageBusy.current = true;
      return;
    }
    if (!wasImageBusy.current) return;
    wasImageBusy.current = false;
    const data = imageFetcher.data;
    if (data && !data.ok) toast.error(data.errorMsg);
    else if (data?.ok && data.intent === "remove-image") toast.success("Foto eliminada.");
  }, [imageFetcher.state, imageFetcher.data]);

  /*------------------------------ESTADO DE LA HISTORIA------------------------------*/
  const wasStatusBusy = useRef<StoryStatusAction | null>(null);
  const runStatus = (action: StoryStatusAction) => {
    if (!story) return;
    wasStatusBusy.current = action;
    statusFetcher.submit(
      { intent: action, story_id: String(story.id) },
      { method: "post" },
    );
  };
  useEffect(() => {
    if (statusFetcher.state !== "idle" || !wasStatusBusy.current) return;
    const action = wasStatusBusy.current;
    wasStatusBusy.current = null;
    const data = statusFetcher.data;
    if (data?.ok) toast.success(STATUS_ACTIONS[action].success);
    else if (data) toast.error(data.errorMsg);
  }, [statusFetcher.state, statusFetcher.data]);

  /*------------------------------CONFIRMACIONES------------------------------*/
  const onConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "status") runStatus(confirm.action);
    if (confirm.kind === "remove-image") {
      submitImageIntent({
        intent: "remove-image",
        image_id: String(confirm.imageId),
      });
    }
    if (confirm.kind === "discard") {
      setConfirm(null);
      onClose();
      return;
    }
    setConfirm(null);
  };

  /*------------------------------RENDER------------------------------*/
  const category = values.category || null;
  const errorProps = (key: FieldKey, describedBy: string[] = []) => {
    const ids = [...describedBy, errors[key] ? `${fid(key)}-error` : null].filter(
      Boolean,
    );
    return {
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": ids.length ? ids.join(" ") : undefined,
    } as const;
  };

  const statusActions = story ? AVAILABLE_ACTIONS[story.status] : [];
  const busyStatus = statusFetcher.state !== "idle";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#1F1D1A]/30"
        onClick={requestClose}
        aria-hidden
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-xl animate-slide-in-right focus:outline-none motion-reduce:animate-none"
      >
        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between gap-3 border-b border-[#EAE6DC] px-5 py-4">
          <h2 id={titleId} className="truncate text-base font-bold text-[#1F1D1A]">
            {isEditing ? "Editar historia" : "Nueva historia"}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar panel"
            className={`flex h-11 w-11 items-center justify-center rounded-lg text-[#57534E] hover:bg-[#F4F2EC] md:h-9 md:w-9 ${FOCUS}`}
          >
            <LuX className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
            {/* ── Estado y acciones (solo edición) ── */}
            {story && (
              <section
                aria-label="Estado de la historia"
                className="flex flex-col gap-3 rounded-2xl border border-[#EAE6DC] bg-[#F4F2EC] p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#3A362E]">
                  <StoryStatusBadge status={story.status} />
                  {story.published_at ? (
                    <span>
                      Publicada por primera vez el{" "}
                      <time dateTime={story.published_at}>
                        {formatStoryDate(story.published_at)}
                      </time>
                    </span>
                  ) : (
                    <span>Aún no se ha publicado</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusActions.map((action) => {
                    const cfg = STATUS_ACTIONS[action];
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={busyStatus || isDirty || isUploading}
                        onClick={() => setConfirm({ kind: "status", action })}
                        className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[36px] ${FOCUS} ${
                          cfg.tone === "primary"
                            ? "bg-[#1F1D1A] text-white hover:bg-[#3A362E]"
                            : "border border-[#D6D1C4] bg-white text-[#3A362E] hover:bg-[#EDEAE3]"
                        }`}
                      >
                        {busyStatus && wasStatusBusy.current === action
                          ? "Aplicando…"
                          : cfg.label}
                      </button>
                    );
                  })}
                </div>
                {isDirty && (
                  <p className="text-xs text-[#57534E]">
                    Guarda los cambios antes de cambiar el estado.
                  </p>
                )}
              </section>
            )}

            {serverError && (
              <p
                role="alert"
                className="rounded-lg border border-[#F3C4C0] bg-[#FDECEA] px-3 py-2 text-sm text-[#8A1C12]"
              >
                {serverError}
              </p>
            )}

            {/* ── Categoría + guía ── */}
            <StoryField id={fid("category")} label="Categoría" error={errors.category}>
              <Select
                id={fid("category")}
                ref={(el) => (fieldRefs.current.category = el)}
                value={values.category}
                onChange={(e) =>
                  setField("category", e.target.value as story_category | "")
                }
                className="w-full"
                {...errorProps("category", [fid("guide")])}
              >
                <option value="" disabled>
                  Selecciona una categoría
                </option>
                {STORY_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </StoryField>
            <div
              id={fid("guide")}
              className="flex flex-col gap-2 rounded-xl border border-[#EAE6DC] bg-[#FBFAF7] p-3 text-xs leading-relaxed text-[#3A362E]"
            >
              <p>
                <strong>Privacidad:</strong> no incluyas datos personales de
                adoptantes ni de terceros (nombres completos, teléfonos,
                direcciones o fotos donde se les reconozca).
              </p>
              {values.category === "Camino_arcoiris" && (
                <p>
                  <strong>Camino al arcoíris:</strong> revisa cada historia
                  antes de publicarla. Sin imágenes gráficas ni acusaciones a
                  personas concretas; el tono es de memoria y respeto.
                </p>
              )}
            </div>

            {/* ── Título ── */}
            <StoryField
              id={fid("title")}
              label="Título"
              error={errors.title}
              counter={{ value: values.title.length, max: STORY_TITLE_MAX }}
            >
              <input
                id={fid("title")}
                ref={(el) => (fieldRefs.current.title = el)}
                type="text"
                value={values.title}
                maxLength={STORY_TITLE_MAX}
                onChange={(e) => setField("title", e.target.value)}
                className={INPUT_CLASS}
                {...errorProps("title", [`${fid("title")}-counter`])}
              />
            </StoryField>

            {/* ── Enlace (solo edición; fijo tras publicar) ── */}
            {story && category && (
              <StoryField
                id={fid("slug")}
                label="Enlace"
                error={errors.slug}
                hint={
                  slugLocked
                    ? "Fijo: la historia ya se publicó y su enlace pudo haberse compartido."
                    : "Se genera del título. Puedes ajustarlo hasta la primera publicación."
                }
              >
                <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300 focus-within:border-medium-turquoise-meraki focus-within:ring-2 focus-within:ring-medium-turquoise-meraki/30">
                  <span className="flex items-center bg-[#F4F2EC] px-2 text-xs text-[#57534E]">
                    {STORY_CATEGORY_CONFIG[category].route}/
                  </span>
                  <input
                    id={fid("slug")}
                    ref={(el) => (fieldRefs.current.slug = el)}
                    type="text"
                    value={values.slug}
                    readOnly={slugLocked}
                    maxLength={180}
                    onChange={(e) => setField("slug", e.target.value.toLowerCase())}
                    className="min-w-0 flex-1 px-2 py-2 text-sm text-gray-800 read-only:bg-[#FBFAF7] read-only:text-[#57534E] focus:outline-none"
                    {...errorProps("slug", [`${fid("slug")}-hint`])}
                  />
                </div>
              </StoryField>
            )}

            {/* ── Resumen ── */}
            <StoryField
              id={fid("summary")}
              label="Resumen"
              optional
              error={errors.summary}
              hint="Se usa en las tarjetas y al compartir. Si lo dejas vacío, se toma el inicio del texto."
              counter={{ value: values.summary.length, max: STORY_SUMMARY_MAX }}
            >
              <Textarea
                id={fid("summary")}
                ref={(el) => (fieldRefs.current.summary = el)}
                rows={2}
                value={values.summary}
                maxLength={STORY_SUMMARY_MAX}
                onChange={(e) => setField("summary", e.target.value)}
                {...errorProps("summary", [
                  `${fid("summary")}-hint`,
                  `${fid("summary")}-counter`,
                ])}
              />
            </StoryField>

            {/* ── Cuerpo ── */}
            <StoryField
              id={fid("body")}
              label="Historia"
              error={errors.body}
              hint="Texto sin formato. Deja una línea en blanco entre párrafos. Es obligatorio para publicar."
              counter={{ value: values.body.length, max: STORY_BODY_MAX }}
            >
              <Textarea
                id={fid("body")}
                ref={(el) => (fieldRefs.current.body = el)}
                rows={10}
                value={values.body}
                maxLength={STORY_BODY_MAX}
                onChange={(e) => setField("body", e.target.value)}
                className="resize-y"
                {...errorProps("body", [`${fid("body")}-hint`, `${fid("body")}-counter`])}
              />
            </StoryField>

            {/* ── Fotos ── */}
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium text-[#3A362E]">
                Fotos{" "}
                <span className="font-normal text-[#6B665C]">
                  ({photoCount}/{STORY_MAX_IMAGES})
                </span>
              </legend>

              {!isEditing && !allowedToUpdate ? (
                <p className="text-xs text-[#57534E]">
                  Tu rol puede crear borradores, pero agregar fotos requiere
                  permiso de actualizar historias.
                </p>
              ) : (
                <>
                  <p id={fid("photos-hint")} className="text-xs text-[#57534E]">
                    JPG, PNG o WEBP de hasta {STORY_IMAGE_MAX_MB} MB. Se
                    necesita al menos una foto y una portada para publicar.
                    {isEditing
                      ? " Los cambios en las fotos se guardan al momento."
                      : " La primera foto será la portada."}
                  </p>

                  <ul className="flex flex-col gap-3" aria-describedby={fid("photos-hint")}>
                    {images.map((img, index) => (
                      <PhotoRow
                        key={img.id}
                        index={index}
                        total={images.length}
                        src={storyImageUrl(cloudName, img.path, "storyThumb")}
                        isCover={img.is_cover}
                        alt={alts[img.id] ?? ""}
                        altId={`${fid("alt")}-${img.id}`}
                        busy={imageBusy}
                        onAlt={(value) =>
                          setAlts((prev) => ({ ...prev, [img.id]: value }))
                        }
                        onUp={() => moveSaved(index, -1)}
                        onDown={() => moveSaved(index, 1)}
                        onCover={() =>
                          submitImageIntent({
                            intent: "set-cover",
                            image_id: String(img.id),
                          })
                        }
                        onRemove={() =>
                          setConfirm({ kind: "remove-image", imageId: img.id, index })
                        }
                      />
                    ))}

                    {pending.map((img, index) => (
                      <PhotoRow
                        key={img.tempId}
                        index={index}
                        total={pending.length}
                        src={img.previewUrl}
                        isCover={index === 0}
                        alt={img.alt}
                        altId={`${fid("alt")}-${img.tempId}`}
                        busy={img.compressing || isSaving}
                        note={img.compressing ? "Optimizando…" : undefined}
                        onAlt={(value) =>
                          setPending((prev) =>
                            prev.map((p) =>
                              p.tempId === img.tempId ? { ...p, alt: value } : p,
                            ),
                          )
                        }
                        onUp={() => movePending(index, -1)}
                        onDown={() => movePending(index, 1)}
                        onCover={() => movePendingToFront(index)}
                        onRemove={() => removePending(img.tempId)}
                      />
                    ))}

                    {queue.map((img) => (
                      <li
                        key={img.tempId}
                        className="flex items-center gap-3 rounded-xl border border-dashed border-[#E4E0D6] p-2"
                      >
                        <img
                          src={img.previewUrl}
                          alt=""
                          className="h-16 w-16 rounded-lg object-cover opacity-60"
                        />
                        <span className="text-sm text-[#57534E]">
                          {img.compressing ? "Optimizando…" : "Subiendo…"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {isUploading && (
                    <p role="status" className="text-sm text-[#57534E]">
                      Subiendo fotos… quedan {queue.length}.
                    </p>
                  )}

                  <div>
                    <input
                      ref={fileInputRef}
                      id={fid("files")}
                      type="file"
                      accept={ACCEPT}
                      multiple
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={remainingSlots === 0 || isSaving}
                      aria-describedby={fid("photos-hint")}
                      className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#C9C3B5] px-4 text-sm font-medium text-[#3A362E] hover:bg-[#F4F2EC] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
                    >
                      <LuImagePlus className="h-5 w-5" aria-hidden />
                      {remainingSlots === 0
                        ? `Límite de ${STORY_MAX_IMAGES} fotos alcanzado`
                        : "Agregar fotos"}
                    </button>
                  </div>
                </>
              )}
            </fieldset>

            {/* ── Fecha del suceso ── */}
            <StoryField
              id={fid("event_date")}
              label="Fecha del suceso"
              optional
              error={errors.event_date}
            >
              <input
                id={fid("event_date")}
                ref={(el) => (fieldRefs.current.event_date = el)}
                type="date"
                value={values.event_date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setField("event_date", e.target.value)}
                className={INPUT_CLASS}
                {...errorProps("event_date")}
              />
            </StoryField>

            {/* ── Mascota vinculada ── */}
            <PetCombobox
              id={fid("pet_id")}
              pets={pets}
              value={values.pet_id}
              category={category}
              error={errors.pet_id}
              inputRef={(el) => (fieldRefs.current.pet_id = el)}
              escapeRef={comboboxEscape}
              onChange={(id) => setField("pet_id", id)}
            />
          </div>

          {/* ── Pie ── */}
          <div className="flex gap-3 border-t border-[#EAE6DC] px-5 py-4">
            <button
              type="button"
              onClick={requestClose}
              className={`min-h-[44px] flex-1 rounded-lg border border-[#D6D1C4] text-sm font-medium text-[#3A362E] hover:bg-[#F4F2EC] ${FOCUS}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              aria-busy={isSaving}
              className={`min-h-[44px] flex-1 rounded-lg bg-[#1F1D1A] text-sm font-semibold text-white hover:bg-[#3A362E] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
            >
              {isSaving
                ? "Guardando…"
                : isUploading
                ? "Subiendo fotos…"
                : isEditing
                ? "Guardar cambios"
                : "Crear borrador"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Confirmaciones (fuera del panel para no mezclar su foco) ── */}
      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={
            confirm.kind === "status"
              ? STATUS_ACTIONS[confirm.action].title
              : confirm.kind === "remove-image"
              ? "Eliminar foto"
              : "Descartar cambios"
          }
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className={`min-h-[44px] flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS}`}
              >
                {confirm.kind === "discard" ? "Seguir editando" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold text-white ${FOCUS} ${
                  confirm.kind === "status" && STATUS_ACTIONS[confirm.action].tone === "primary"
                    ? "bg-[#1F1D1A] hover:bg-[#3A362E]"
                    : "bg-[#B42318] hover:bg-[#912018]"
                }`}
              >
                {confirm.kind === "status"
                  ? STATUS_ACTIONS[confirm.action].confirm
                  : confirm.kind === "remove-image"
                  ? "Eliminar foto"
                  : "Descartar"}
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-700">
            {confirm.kind === "status"
              ? STATUS_ACTIONS[confirm.action].message
              : confirm.kind === "remove-image"
              ? `Se eliminará la foto ${confirm.index + 1} de forma permanente.${
                  images[confirm.index]?.is_cover
                    ? " Es la portada: la siguiente foto pasará a serlo."
                    : ""
                }`
              : "Tienes cambios sin guardar. Si cierras el panel se perderán."}
          </p>
        </Modal>
      )}
    </>
  );
}

/*==============================| Campo |==============================*/
/**
 * Envoltura de campo del panel: label asociado, ayuda, contador y error con
 * `role="alert"`. Colores con contraste AA (el `Field` compartido usa texto
 * pink-meraki/gray-400 que no llega a 4.5:1).
 */
function StoryField({
  id,
  label,
  optional,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  counter?: { value: number; max: number };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-[#3A362E]">
          {label}
          {optional && (
            <span className="ml-1 font-normal text-[#6B665C]">(opcional)</span>
          )}
        </label>
        {counter && (
          <span
            id={`${id}-counter`}
            className={`text-xs tabular-nums ${
              counter.value > counter.max * 0.9 ? "text-[#8A1C12]" : "text-[#6B665C]"
            }`}
          >
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-[#6B665C]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
}

/*==============================| Fila de foto |==============================*/
function PhotoRow({
  index,
  total,
  src,
  isCover,
  alt,
  altId,
  busy,
  note,
  onAlt,
  onUp,
  onDown,
  onCover,
  onRemove,
}: {
  index: number;
  total: number;
  src: string;
  isCover: boolean;
  alt: string;
  altId: string;
  busy: boolean;
  note?: string;
  onAlt: (value: string) => void;
  onUp: () => void;
  onDown: () => void;
  onCover: () => void;
  onRemove: () => void;
}) {
  const position = `foto ${index + 1} de ${total}`;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[#EAE6DC] p-2 sm:flex-row sm:items-start">
      <div className="relative h-20 w-20 flex-shrink-0">
        <img
          src={src}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 rounded-lg object-cover"
        />
        {isCover && (
          <span className="absolute left-1 top-1 rounded-full bg-[#1F1D1A] px-2 py-0.5 text-[10px] font-semibold text-white">
            Portada
          </span>
        )}
        {note && (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-[10px] text-white">
            {note}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <label htmlFor={altId} className="text-xs font-medium text-[#3A362E]">
          Texto alternativo ({position})
        </label>
        <input
          id={altId}
          type="text"
          value={alt}
          maxLength={STORY_ALT_MAX}
          placeholder="Describe la foto para quien no puede verla"
          onChange={(e) => onAlt(e.target.value)}
          className={INPUT_CLASS}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onUp}
            disabled={busy || index === 0}
            aria-label={`Subir ${position}`}
            className={ICON_BUTTON}
          >
            <LuArrowUp className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDown}
            disabled={busy || index === total - 1}
            aria-label={`Bajar ${position}`}
            className={ICON_BUTTON}
          >
            <LuArrowDown className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onCover}
            disabled={busy || isCover}
            aria-pressed={isCover}
            aria-label={isCover ? `${position}: es la portada` : `Usar ${position} como portada`}
            className={`${ICON_BUTTON} w-auto gap-1.5 px-3 text-xs font-medium md:w-auto`}
          >
            <LuStar className="h-4 w-4" aria-hidden />
            {isCover ? "Portada" : "Hacer portada"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Eliminar ${position}`}
            className={`${ICON_BUTTON} text-[#B42318]`}
          >
            <LuTrash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/*==============================| Combobox de mascota |==============================*/
/**
 * Selector de mascota vinculada (opcional, referencia interna). Patrón
 * WAI-ARIA combobox como `PatrocinadorCombobox`. Ordena primero las mascotas
 * con el estado sugerido para la categoría, sin restringir.
 */
function PetCombobox({
  id,
  pets,
  value,
  category,
  error,
  inputRef,
  escapeRef,
  onChange,
}: {
  id: string;
  pets: StoryPetOption[];
  value: number | null;
  category: story_category | null;
  error?: string;
  inputRef: (el: HTMLInputElement | null) => void;
  escapeRef: React.MutableRefObject<(() => boolean) | null>;
  onChange: (id: number | null) => void;
}) {
  const listId = `${id}-list`;
  const selected = pets.find((p) => p.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const suggested = category ? SUGGESTED_PET_STATUS[category] : null;
  const term = query.trim().toLowerCase();
  const matches = pets
    .filter((p) => !term || p.name.toLowerCase().includes(term))
    .sort((a, b) => {
      const sa = a.status === suggested ? 0 : 1;
      const sb = b.status === suggested ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name, "es");
    })
    .slice(0, 30);

  // Escape del panel: si la lista está abierta, se cierra solo la lista.
  useEffect(() => {
    escapeRef.current = open
      ? () => {
          setOpen(false);
          return true;
        }
      : null;
    return () => {
      escapeRef.current = null;
    };
  }, [open, escapeRef]);

  useEffect(() => () => clearTimeout(blurTimeout.current), []);

  const choose = (pet: StoryPetOption) => {
    onChange(pet.id);
    setQuery(pet.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[#3A362E]">
        Mascota vinculada
        <span className="ml-1 font-normal text-[#6B665C]">(opcional)</span>
      </label>
      <div className="relative flex gap-2">
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[active] ? `${id}-opt-${matches[active].id}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${id}-hint`, error ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ")}
          value={query}
          placeholder="Buscar por nombre…"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (value !== null) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => {
              setOpen(false);
              // Si no se eligió ninguna, se limpia el texto suelto.
              if (!pets.some((p) => p.id === value)) setQuery("");
            }, 150);
          }}
          onKeyDown={onKeyDown}
          className={INPUT_CLASS}
        />
        {value !== null && (
          <button
            type="button"
            onClick={clear}
            aria-label="Quitar mascota vinculada"
            className={ICON_BUTTON}
          >
            <LuX className="h-4 w-4" aria-hidden />
          </button>
        )}
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Mascotas"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#EAE6DC] bg-white py-1 shadow-lg"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#57534E]">Sin resultados</li>
            ) : (
              matches.map((pet, index) => (
                <li
                  key={pet.id}
                  id={`${id}-opt-${pet.id}`}
                  role="option"
                  aria-selected={pet.id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(pet)}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 text-sm ${
                    index === active ? "bg-[#F4F2EC]" : ""
                  }`}
                >
                  <span className="text-[#1F1D1A]">{pet.name}</span>
                  <span className="text-xs text-[#57534E]">
                    {PET_STATUS_CONFIG[pet.status].label}
                    {pet.status === suggested ? " · sugerida" : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <p id={`${id}-hint`} className="text-xs text-[#6B665C]">
        Solo es una referencia interna: el público no ve la mascota vinculada.
        {suggested
          ? ` Se sugieren primero las mascotas con estado «${PET_STATUS_CONFIG[suggested].label}».`
          : ""}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
}
