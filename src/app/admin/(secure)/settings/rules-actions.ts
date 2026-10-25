"use server";

import { revalidatePath } from "next/cache";
import { getFestConfig, updateFestConfig } from "@/lib/data";
import type { FestConfig } from "@/lib/types";

export async function fetchFestConfigAction(): Promise<FestConfig> {
  return await getFestConfig();
}

export async function saveFestConfigAction(formData: FormData) {
  try {
    const maxSingleOnStage = Number(formData.get("maxSingleOnStage") ?? 3);
    const maxSingleOffStage = Number(formData.get("maxSingleOffStage") ?? 4);
    const maxGeneral = Number(formData.get("maxGeneral") ?? 3);

    const enableCategories = formData.get("enableCategories") === "on";

    const categoryA1 = Number(formData.get("categoryA1") ?? 10);
    const categoryA2 = Number(formData.get("categoryA2") ?? 7);
    const categoryA3 = Number(formData.get("categoryA3") ?? 5);

    const categoryB1 = Number(formData.get("categoryB1") ?? 7);
    const categoryB2 = Number(formData.get("categoryB2") ?? 5);
    const categoryB3 = Number(formData.get("categoryB3") ?? 3);

    const categoryC1 = Number(formData.get("categoryC1") ?? 5);
    const categoryC2 = Number(formData.get("categoryC2") ?? 3);
    const categoryC3 = Number(formData.get("categoryC3") ?? 1);

    const gradeBonusA = Number(formData.get("gradeBonusA") ?? 5);
    const gradeBonusB = Number(formData.get("gradeBonusB") ?? 3);
    const gradeBonusC = Number(formData.get("gradeBonusC") ?? 1);

    const general1 = Number(formData.get("general1") ?? 20);
    const general2 = Number(formData.get("general2") ?? 15);
    const general3 = Number(formData.get("general3") ?? 10);

    const flatSingle1 = Number(formData.get("flatSingle1") ?? 10);
    const flatSingle2 = Number(formData.get("flatSingle2") ?? 7);
    const flatSingle3 = Number(formData.get("flatSingle3") ?? 5);

    const newConfig: Partial<FestConfig> = {
      limits: {
        maxSingleOnStage,
        maxSingleOffStage,
        maxGeneral,
      },
      scoring: {
        enableCategories,
        categoryScores: {
          A: { 1: categoryA1, 2: categoryA2, 3: categoryA3 },
          B: { 1: categoryB1, 2: categoryB2, 3: categoryB3 },
          C: { 1: categoryC1, 2: categoryC2, 3: categoryC3 },
        },
        gradeBonus: {
          A: gradeBonusA,
          B: gradeBonusB,
          C: gradeBonusC,
        },
        generalScores: {
          1: general1,
          2: general2,
          3: general3,
        },
        flatSingleScores: {
          1: flatSingle1,
          2: flatSingle2,
          3: flatSingle3,
        },
      },
    };

    await updateFestConfig(newConfig);

    revalidatePath("/");
    revalidatePath("/admin/settings");
    revalidatePath("/team/program-register");
    revalidatePath("/scoreboard");
    revalidatePath("/results");

    return { success: "Festival rules and point settings updated successfully!" };
  } catch (error: any) {
    return { error: error.message || "Failed to save settings." };
  }
}
