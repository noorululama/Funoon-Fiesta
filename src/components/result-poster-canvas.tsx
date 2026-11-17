"use client";

import type { PosterTemplate } from "@/lib/types";

export interface PrizeEntry {
  position: 1 | 2 | 3;
  studentName?: string;
  teamName?: string;
  chestNumber?: string;
}

export interface PosterData {
  programName: string;
  section?: string;
  category?: string;
  prizes: PrizeEntry[];
}

export type PosterStyle = 1 | 2 | 3;

// Cache for loaded images to prevent redundant network requests and decoding
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Load image from URL and return as Image element
 * Uses caching to improve performance on repeated calls
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Fallback template builder if style number (1 | 2 | 3) is provided directly
 */
function getLegacyDefaultTemplate(style: PosterStyle): PosterTemplate {
  const is2 = style === 2;
  const is3 = style === 3;

  return {
    id: `legacy-${style}`,
    name: `Style ${style}`,
    backgroundImageUrl: `/poster-template-${style}.webp`,
    width: 1080,
    height: 1350,
    isActive: true,
    order: style,
    programName: {
      enabled: true,
      x: 380,
      y: 400,
      fontSize: 74,
      fontFamily: "'Charutha', sans-serif",
      fontWeight: "normal",
      color: is2 ? "#ffffff" : is3 ? "#bd6229" : "#000000",
      align: "center",
      maxWidth: 940,
    },
    section: {
      enabled: true,
      x: 380,
      y: 460,
      fontSize: 48,
      fontFamily: "'Arial', sans-serif",
      fontWeight: "normal",
      color: is2 ? "#e7a039" : "#000000",
      align: "center",
      maxWidth: 940,
    },
    prizesLayout: "stacked",
    stackedSettings: {
      startX: 180,
      startY: 608,
      spacingY: 120,
      nameFontSize: 48,
      nameColor: is2 ? "#ffffff" : "#000000",
      nameFontFamily: "'Arial', sans-serif",
      teamFontSize: 32,
      teamColor: is2 ? "#ffffff" : "#000000",
      teamFontFamily: "'Arial', sans-serif",
      teamOffsetY: 50,
      showChestNo: false,
      align: "left",
      maxWidth: 720,
    },
    footer: {
      enabled: true,
      text: "Official Results",
      x: 540,
      y: 1290,
      fontSize: 24,
      fontFamily: "'Arial', sans-serif",
      fontWeight: "normal",
      color: "rgba(255, 255, 255, 0.5)",
      align: "center",
      maxWidth: 940,
    },
  };
}

/**
 * Truncate text to fit within a given maximum width on the canvas context
 */
function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

/** Wrap at spaces, splitting unusually long words without adding hyphens. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && ctx.measureText(line + character).width > maxWidth) {
        lines.push(line);
        line = character;
      } else line += character;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawPrizeBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  position: PrizeEntry["position"],
  radius: number
) {
  const colors: Record<PrizeEntry["position"], { main: string; light: string; dark: string }> = {
    1: { main: "#e0ad24", light: "#fff0a6", dark: "#8e5d08" },
    2: { main: "#aeb8c4", light: "#f5f8fc", dark: "#56616f" },
    3: { main: "#c47a45", light: "#ffd0a1", dark: "#713716" },
  };
  const palette = colors[position];
  ctx.save();
  // Short ribbon tails behind the medal.
  ctx.fillStyle = palette.dark;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.56, y + radius * 0.5);
  ctx.lineTo(x - radius * 0.95, y + radius * 1.55);
  ctx.lineTo(x - radius * 0.18, y + radius * 1.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.main;
  ctx.beginPath();
  ctx.moveTo(x + radius * 0.56, y + radius * 0.5);
  ctx.lineTo(x + radius * 0.95, y + radius * 1.55);
  ctx.lineTo(x + radius * 0.18, y + radius * 1.28);
  ctx.closePath();
  ctx.fill();

  // Layered medal rim and center.
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.86, 0, Math.PI * 2);
  ctx.fillStyle = palette.main;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radius * 0.07);
  ctx.strokeStyle = palette.light;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - radius * 0.22, y - radius * 0.25, radius * 0.48, Math.PI, Math.PI * 1.62);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = Math.max(1, radius * 0.09);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${radius * 1.08}px Arial, sans-serif`;
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = radius * 0.12;
  ctx.shadowOffsetY = radius * 0.05;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(position), x, y - radius * 0.03);
  ctx.restore();
}

function textLineStartX(ctx: CanvasRenderingContext2D, anchorX: number, line: string): number {
  const width = ctx.measureText(line).width;
  if (ctx.textAlign === "center") return anchorX - width / 2;
  if (ctx.textAlign === "right" || ctx.textAlign === "end") return anchorX - width;
  return anchorX;
}

/**
 * Generate a high-quality poster canvas image for the result
 * @param data Poster data (program, section, prizes)
 * @param styleOrTemplate Poster style variant (1, 2, 3) or full dynamic PosterTemplate
 * @returns Promise that resolves to Data URL of the generated PNG image
 */
export async function generateResultPoster(
  data: PosterData,
  styleOrTemplate: PosterStyle | PosterTemplate = 1
): Promise<string> {
  const template: PosterTemplate =
    typeof styleOrTemplate === "number"
      ? getLegacyDefaultTemplate(styleOrTemplate)
      : styleOrTemplate;

  const baseWidth = template.width || 1080;
  const baseHeight = template.height || 1350;

  // 1. Attempt to load template background image
  let templateImage: HTMLImageElement | null = null;
  let imageWidth = baseWidth;
  let imageHeight = baseHeight;

  if (template.backgroundImageUrl) {
    try {
      templateImage = await loadImage(template.backgroundImageUrl);
      imageWidth = templateImage.width;
      imageHeight = templateImage.height;
    } catch (error) {
      console.warn("Failed to load poster template background image, using fallback:", error);
    }
  }

  // Create canvas with exact dimensions
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Set high quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 2. Draw background
  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, imageWidth, imageHeight);
  } else {
    // Elegant fallback gradient if image is missing
    const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
    gradient.addColorStop(0, "#1e1b4b");
    gradient.addColorStop(0.5, "#312e81");
    gradient.addColorStop(1, "#4c1d95");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, imageWidth, imageHeight);
  }

  // Scale factors based on base template dimensions
  const scaleX = imageWidth / baseWidth;
  const scaleY = imageHeight / baseHeight;

  // 3. Program Name
  if (template.programName && template.programName.enabled !== false) {
    const pConfig = template.programName;
    const posX = pConfig.x * scaleX;
    const posY = pConfig.y * scaleY;
    const fontSize = pConfig.fontSize * scaleY;

    ctx.fillStyle = pConfig.color || "#000000";
    ctx.textAlign = pConfig.align || "center";
    ctx.textBaseline = "middle";
    ctx.font = `${pConfig.fontWeight || "normal"} ${fontSize}px ${pConfig.fontFamily || "sans-serif"}`;

    const maxWidth = (pConfig.maxWidth || 940) * scaleX;
    const displayProgram = truncateText(ctx, (data.programName || "Program Name").toLocaleUpperCase(), maxWidth);
    ctx.fillText(displayProgram, posX, posY);
  }

  // 4. Section / Category
  if (template.section && template.section.enabled !== false) {
    const sConfig = template.section;
    const posX = sConfig.x * scaleX;
    const posY = sConfig.y * scaleY;
    const fontSize = sConfig.fontSize * scaleY;

    ctx.fillStyle = sConfig.color || "#000000";
    ctx.textAlign = sConfig.align || "center";
    ctx.textBaseline = "middle";
    ctx.font = `${sConfig.fontWeight || "normal"} ${fontSize}px ${sConfig.fontFamily || "sans-serif"}`;

    const sectionLabel = data.section
      ? data.category && data.category !== "none"
        ? `${data.section} • Cat ${data.category}`
        : data.section
      : "General";

    const maxWidth = (sConfig.maxWidth || 940) * scaleX;
    const displaySection = truncateText(ctx, sectionLabel, maxWidth);
    ctx.fillText(displaySection, posX, posY);
  }

  // 5. Prizes Section
  const sortedPrizes = [...data.prizes].sort((a, b) => a.position - b.position);

  if (template.prizesLayout === "slots" && template.slotsSettings) {
    // Custom individual position slots
    const slots = template.slotsSettings;
    const slotMap: Record<number, typeof slots.slot1> = {
      1: slots.slot1,
      2: slots.slot2,
      3: slots.slot3,
    };

    sortedPrizes.forEach((prize) => {
      const slot = slotMap[prize.position];
      if (!slot) return;

      const name = (prize.studentName || prize.teamName || "—").toLocaleUpperCase();
      const posX = slot.x * scaleX;
      const posY = slot.y * scaleY;
      // Draw winner name
      const nameFontSize = (slots.nameFontSize || 48) * scaleY;
      ctx.fillStyle = slots.nameColor || "#000000";
      ctx.textAlign = slots.align || "left";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${nameFontSize}px ${slots.nameFontFamily || "'Arial', sans-serif"}`;

      let displayName = name;
      if (slot.showChestNo && prize.chestNumber) {
        displayName += ` (#${prize.chestNumber})`;
      }
      const slotMaxWidth = Math.max(1, imageWidth - posX - 80 * scaleX);
      const nameLines = wrapText(ctx, displayName, slotMaxWidth);
      const lineHeight = nameFontSize * 1.15;
      const firstLineY = posY - (nameLines.length - 1) * lineHeight / 2;
      const badgeRadius = 38 * scaleY;
      const badgeX = textLineStartX(ctx, posX, nameLines[0]) - (badgeRadius + 36 * scaleX);
      drawPrizeBadge(ctx, badgeX, firstLineY, prize.position, badgeRadius);
      nameLines.forEach((line, index) => ctx.fillText(line, posX, posY + (index - (nameLines.length - 1) / 2) * lineHeight));

      // Draw team name
      if (prize.teamName && prize.studentName) {
        const teamFontSize = (slots.teamFontSize || 32) * scaleY;
        ctx.fillStyle = slots.teamColor || "#555555";
        ctx.font = `${teamFontSize}px ${slots.teamFontFamily || "'Arial', sans-serif"}`;
        const teamY = posY + Math.max((slots.teamOffsetY || 50) * scaleY, nameLines.length * lineHeight / 2 + 8 * scaleY);
        ctx.fillText(prize.teamName.toLocaleUpperCase(), posX, teamY);
      }
    });
  } else {
    // Default Stacked List layout
    const stacked = template.stackedSettings || {
      startX: 180,
      startY: 608,
      spacingY: 120,
      nameFontSize: 48,
      nameColor: "#000000",
      nameFontFamily: "'Arial', sans-serif",
      teamFontSize: 32,
      teamColor: "#000000",
      teamFontFamily: "'Arial', sans-serif",
      teamOffsetY: 50,
      showChestNo: false,
      align: "left",
      maxWidth: 720,
    };

    let nextPrizeY = stacked.startY * scaleY;
    sortedPrizes.forEach((prize) => {
      const name = (prize.studentName || prize.teamName || "—").toLocaleUpperCase();
      const nameX = stacked.startX * scaleX;
      const nameY = nextPrizeY;

      // Draw student / winner name
      const nameFontSize = (stacked.nameFontSize || 48) * scaleY;
      ctx.fillStyle = stacked.nameColor || "#000000";
      ctx.textAlign = stacked.align || "left";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${nameFontSize}px ${stacked.nameFontFamily || "'Arial', sans-serif"}`;

      const maxNameWidth = (stacked.maxWidth || 720) * scaleX;
      let displayName = name;
      if (stacked.showChestNo && prize.chestNumber) {
        displayName += ` (#${prize.chestNumber})`;
      }
      const nameLines = wrapText(ctx, displayName, maxNameWidth);
      const lineHeight = nameFontSize * 1.15;
      const firstLineY = nameY - (nameLines.length - 1) * lineHeight / 2;
      const badgeRadius = 38 * scaleY;
      const badgeX = textLineStartX(ctx, nameX, nameLines[0]) - (badgeRadius + 36 * scaleX);
      drawPrizeBadge(ctx, badgeX, firstLineY, prize.position, badgeRadius);
      nameLines.forEach((line, lineIndex) => ctx.fillText(line, nameX, nameY + (lineIndex - (nameLines.length - 1) / 2) * lineHeight));

      // Draw team name if available
      const team = prize.teamName;
      if (team && (prize.studentName || prize.teamName)) {
        const teamFontSize = (stacked.teamFontSize || 32) * scaleY;
        ctx.fillStyle = stacked.teamColor || "#555555";
        ctx.font = `${teamFontSize}px ${stacked.teamFontFamily || "'Arial', sans-serif"}`;
        const displayTeam = truncateText(ctx, team.toLocaleUpperCase(), maxNameWidth);
        const teamY = nameY + nameLines.length * lineHeight / 2 + (stacked.teamOffsetY || 50) * scaleY;
        ctx.fillText(displayTeam, nameX, teamY);
      }
      const teamHeight = prize.teamName && prize.studentName
        ? (stacked.teamOffsetY || 50) * scaleY + (stacked.teamFontSize || 32) * scaleY
        : 0;
      nextPrizeY += Math.max((stacked.spacingY || 120) * scaleY, nameLines.length * lineHeight + teamHeight);
    });
  }

  // 6. Footer Decoration / Branding
  if (template.footer && template.footer.enabled !== false) {
    const fConfig = template.footer;
    const posX = fConfig.x * scaleX;
    const posY = fConfig.y * scaleY;
    const fontSize = fConfig.fontSize * scaleY;

    ctx.fillStyle = fConfig.color || "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = fConfig.align || "center";
    ctx.textBaseline = "middle";
    ctx.font = `${fConfig.fontWeight || "normal"} ${fontSize}px ${fConfig.fontFamily || "sans-serif"}`;

    const maxFooterWidth = (fConfig.maxWidth || 940) * scaleX;
    const text = truncateText(ctx, fConfig.text || "Official Results", maxFooterWidth);
    ctx.fillText(text, posX, posY);
  }

  // 7. Add subtle shadow depth
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;

  return canvas.toDataURL("image/png", 1.0);
}
