"use server";

import { revalidatePath } from "next/cache";
import {
  getPosterTemplates,
  getActivePosterTemplates,
  getPosterTemplateById,
  createPosterTemplate,
  updatePosterTemplate,
  deletePosterTemplate,
} from "@/lib/data";
import { uploadPosterTemplateImage, deletePosterTemplateFile } from "@/lib/upload";
import type { PosterTemplate } from "@/lib/types";

export async function getAllTemplatesAction() {
  try {
    return await getPosterTemplates();
  } catch (error: any) {
    console.error("Failed to fetch poster templates:", error);
    return [];
  }
}

export async function uploadBackgroundAction(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return { error: "No file selected or invalid file" };
    }

    const { url, width, height } = await uploadPosterTemplateImage(file);
    return { success: true, url, width, height };
  } catch (error: any) {
    console.error("Failed to upload background image:", error);
    return { error: error.message || "Failed to upload image" };
  }
}

export async function savePosterTemplateAction(template: PosterTemplate) {
  try {
    const existing = await getPosterTemplateById(template.id);
    let result: PosterTemplate | null;

    if (existing) {
      result = await updatePosterTemplate(template.id, template);
    } else {
      const { id, ...dataWithoutId } = template;
      result = await createPosterTemplate(dataWithoutId);
    }

    revalidatePath("/admin/poster-templates");
    revalidatePath("/results/[program_id]", "page");
    return { success: true, template: result };
  } catch (error: any) {
    console.error("Failed to save poster template:", error);
    return { error: error.message || "Failed to save template" };
  }
}

export async function deletePosterTemplateAction(id: string) {
  try {
    const template = await getPosterTemplateById(id);
    if (!template) {
      return { error: "Template not found" };
    }

    // Clean up uploaded image if it was in the uploads directory
    if (template.backgroundImageUrl) {
      await deletePosterTemplateFile(template.backgroundImageUrl);
    }

    const success = await deletePosterTemplate(id);
    if (!success) {
      return { error: "Failed to delete template from database" };
    }

    revalidatePath("/admin/poster-templates");
    revalidatePath("/results/[program_id]", "page");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete poster template:", error);
    return { error: error.message || "Failed to delete template" };
  }
}

export async function toggleTemplateActiveAction(id: string, isActive: boolean) {
  try {
    const updated = await updatePosterTemplate(id, { isActive });
    if (!updated) {
      return { error: "Template not found" };
    }

    revalidatePath("/admin/poster-templates");
    revalidatePath("/results/[program_id]", "page");
    return { success: true, isActive: updated.isActive };
  } catch (error: any) {
    console.error("Failed to toggle template active status:", error);
    return { error: error.message || "Failed to toggle status" };
  }
}

export async function duplicateTemplateAction(id: string) {
  try {
    const original = await getPosterTemplateById(id);
    if (!original) {
      return { error: "Original template not found" };
    }

    const { id: _, ...rest } = original;
    const duplicated = await createPosterTemplate({
      ...rest,
      name: `${original.name} (Copy)`,
      order: (original.order || 0) + 1,
    });

    revalidatePath("/admin/poster-templates");
    revalidatePath("/results/[program_id]", "page");
    return { success: true, template: duplicated };
  } catch (error: any) {
    console.error("Failed to duplicate poster template:", error);
    return { error: error.message || "Failed to duplicate template" };
  }
}

export async function reorderTemplatesAction(templateIds: string[]) {
  try {
    for (let index = 0; index < templateIds.length; index++) {
      await updatePosterTemplate(templateIds[index], { order: index + 1 });
    }

    revalidatePath("/admin/poster-templates");
    revalidatePath("/results/[program_id]", "page");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to reorder poster templates:", error);
    return { error: error.message || "Failed to reorder templates" };
  }
}
