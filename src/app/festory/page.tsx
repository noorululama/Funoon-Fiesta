import { redirect } from "next/navigation";
import { getFestorySession } from "./actions";
import { FestoryLoginForm } from "@/components/festory/login-form";

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FestoryLoginPage(props: Props) {
    const searchParams = await props.searchParams;
    const session = await getFestorySession();
    const postId = searchParams?.post;

    if (session) {
        redirect(postId ? `/festory/feed?post=${postId}` : "/festory/feed");
    }

    return <FestoryLoginForm />;
}
