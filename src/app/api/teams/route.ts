import { NextResponse } from "next/server";
import { getTeams } from "@/lib/data";

export async function GET() {
    try {
        const teams = await getTeams();
        // Return only necessary fields for public/admin UI (id, name, color)
        const teamColors = teams.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color
        }));
        return NextResponse.json(teamColors);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
    }
}
