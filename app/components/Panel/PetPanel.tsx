import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { PetWithImage } from "~/services/db/pet.service";
import Input from "../Input";
import { petSpecies } from "@prisma/client";
import { Select } from "../Input/Select";
import { compressImage, petImageUrl } from "~/utils/image";

interface PetFormPanelProps {
  open: boolean;
  onClose: () => void;
  species: petSpecies[];
  pet?: PetWithImage;
  cloudName?: string;
}

interface ExistingImage {
  id: number;
  path: string;
  markedForDelete: boolean;
}

interface NewImage {
  tempId: string;
  file: File;
  previewUrl: string;
  compressing: boolean;
}

/**
 * Panel lateral (slide-over) para crear/editar una mascota. Usa un fetcher
 * en vez de navegar, así el listado y sus filtros de fondo no se pierden.
 * Envía a la acción de la ruta de listado con `intent` para diferenciar
 * crear vs actualizar en un único `action` de Remix.
 */
export function PetFormPanel({
  open,
  onClose,
  species,
  pet,
  cloudName = "",
}: PetFormPanelProps) {
  const fetcher = useFetcher();
  const isEditing = Boolean(pet);
  const wasSubmitting = useRef(false);

  // Imágenes que ya existen en la BD (solo aplica en edición)
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  // Imágenes nuevas seleccionadas por el usuario (aplica en ambos casos)
  const [newImages, setNewImages] = useState<NewImage[]>([]);

  // Reinicia el estado de imágenes cada vez que cambia la mascota/se abre el panel
  useEffect(() => {
    setExistingImages(
      pet?.pet_images?.map((img) => ({
        id: img.id,
        path: img.path,
        markedForDelete: false,
      })) ?? [],
    );
    newImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setNewImages([]);
  }, [pet?.id, open]);

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      onClose();
    }
  }, [fetcher.state]);

  // Limpieza de las URLs de previsualización al desmontar
  useEffect(() => {
    return () =>
      newImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
  }, []);

  /*------------------------------IMÁGENES------------------------------*/
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);

    // Mostramos el preview de inmediato, comprimiendo en segundo plano
    const placeholders: NewImage[] = files.map((file) => ({
      tempId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      compressing: true,
    }));
    setNewImages((prev) => [...prev, ...placeholders]);

    await Promise.all(
      placeholders.map(async (placeholder) => {
        const compressed = await compressImage(placeholder.file);
        setNewImages((prev) =>
          prev.map((img) =>
            img.tempId === placeholder.tempId
              ? { ...img, file: compressed, compressing: false }
              : img,
          ),
        );
      }),
    );
  };

  const removeNewImage = (tempId: string) => {
    setNewImages((prev) => {
      const target = prev.find((i) => i.tempId === tempId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.tempId !== tempId);
    });
  };

  const toggleDeleteExisting = (id: number) => {
    setExistingImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, markedForDelete: !img.markedForDelete } : img,
      ),
    );
  };

  /*------------------------------SUBMIT------------------------------*/
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget); // captura los inputs de texto/select

    newImages.forEach((img) => {
      if (!img.compressing) formData.append("images", img.file);
    });

    existingImages
      .filter((img) => img.markedForDelete)
      .forEach((img) => formData.append("deleted_image_ids", String(img.id)));

    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#1F1D1A]/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-y-auto bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Editar mascota" : "Nueva mascota"}
      >
        <div className="flex items-center justify-between border-b border-[#EAE6DC] px-5 py-4">
          <h2 className="font-semibold">
            {isEditing ? `Editar a ${pet?.name}` : "Nueva mascota"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A8577] hover:bg-[#F4F2EC]"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <fetcher.Form
          method="post"
          encType="multipart/form-data"
          className="flex flex-col gap-4 p-5"
          onSubmit={handleSubmit}
        >
          <input
            type="hidden"
            name="intent"
            value={isEditing ? "update" : "create"}
          />
          {isEditing ? <input type="hidden" name="id" value={pet?.id} /> : null}

          <Field label="Nombre">
            <Input
              name="name"
              defaultValue={pet?.name}
              required
              maxLength={100}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Especie">
              <Select
                name="pet_species_id"
                defaultValue={String(pet?.petSpecies?.id) || ""}
                required
                className="w-full"
              >
                <option value="" disabled>
                  Selecciona
                </option>
                {species.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Género">
              <Select
                name="gender"
                defaultValue={pet?.gender}
                required
                className="w-full"
              >
                <option value="" disabled>
                  Selecciona
                </option>
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
              </Select>
            </Field>
            <Field label="Raza">
              <Input
                name="race"
                defaultValue={pet?.race ?? ""}
                maxLength={100}
              />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input
                type="date"
                name="birthdate"
                defaultValue={
                  pet?.birthdate
                    ? new Date(pet.birthdate).toISOString().slice(0, 10)
                    : undefined
                }
                required
              />
            </Field>
            <Field label="Tamaño">
              <Select
                name="size"
                defaultValue={pet?.size}
                required
                className="w-full"
              >
                <option value="" disabled>
                  Selecciona
                </option>
                <option value="Pequeño">Pequeño</option>
                <option value="Mediano">Mediano</option>
                <option value="Grande">Grande</option>
              </Select>
            </Field>
            <Field label="Color">
              <Input
                name="color"
                defaultValue={pet?.color}
                required
                maxLength={50}
              />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea
              name="description"
              defaultValue={pet?.description ?? ""}
              rows={4}
              className="w-full py-2 px-3 border border-gray-400 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
            />
          </Field>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-[#3A362E]">
              <input
                type="checkbox"
                name="vaccinated"
                defaultChecked={pet?.vaccinated}
                className="h-4 w-4 rounded border-[#E4E0D6] text-[#1F1D1A]"
              />
              Vacunado
            </label>
            <label className="flex items-center gap-2 text-sm text-[#3A362E]">
              <input
                type="checkbox"
                name="sterilized"
                defaultChecked={pet?.sterilized}
                className="h-4 w-4 rounded border-[#E4E0D6] text-[#1F1D1A]"
              />
              Esterilizado
            </label>
          </div>
          <Field label="Fotos">
            <div className="flex flex-wrap gap-3">
              {existingImages.map((img) => (
                <div
                  key={img.id}
                  className="relative h-24 w-24 overflow-hidden rounded-xl border border-[#E4E0D6]"
                >
                  <img
                    src={petImageUrl(cloudName, img.path, "thumb")}
                    alt=""
                    className={`h-full w-full object-cover transition-opacity ${
                      img.markedForDelete ? "opacity-30" : "opacity-100"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleDeleteExisting(img.id)}
                    className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow ${
                      img.markedForDelete ? "bg-[#52C9BB]" : "bg-[#F2768C]"
                    }`}
                    aria-label={
                      img.markedForDelete
                        ? "Deshacer eliminación"
                        : "Eliminar imagen"
                    }
                  >
                    {img.markedForDelete ? "↺" : "✕"}
                  </button>
                </div>
              ))}

              {newImages.map((img) => (
                <div
                  key={img.tempId}
                  className="relative h-24 w-24 overflow-hidden rounded-xl border border-[#E4E0D6]"
                >
                  <img
                    src={img.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {img.compressing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white">
                      Optimizando...
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeNewImage(img.tempId)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#F2768C] text-xs font-bold text-white shadow"
                    aria-label="Quitar imagen"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#E4E0D6] text-[#8A8577] hover:bg-[#F4F2EC]">
                <span className="text-xl">+</span>
                <span className="text-[11px]">Agregar</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = ""; // permite reseleccionar el mismo archivo después
                  }}
                />
              </label>
            </div>
          </Field>

          <div className="mt-2 flex gap-2 border-t border-[#F0EDE5] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-medium-turquoise-meraki py-2 text-sm font-medium text-medium-turquoise-meraki hover:bg-medium-turquoise-meraki/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="flex-1 rounded-lg bg-medium-turquoise-meraki py-2 text-sm font-medium text-white hover:bg-medium-turquoise-meraki/80 disabled:opacity-60"
            >
              {fetcher.state !== "idle"
                ? "Guardando..."
                : isEditing
                ? "Guardar cambios"
                : "Crear mascota"}
            </button>
          </div>
        </fetcher.Form>
      </aside>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-[#3A362E]">{label}</span>
      {children}
    </label>
  );
}
