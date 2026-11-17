import { redirect } from "next/navigation";
import Link from "next/link";
import { getFestorySession, getFestoryPosts } from "../actions";
import { CreatePost } from "@/components/festory/create-post";
import { FeedList } from "@/components/festory/feed-list";
import { GlobalAudio } from "@/components/festory/global-audio";
import { ProfileSettings } from "@/components/festory/profile-settings";
import { Home } from "lucide-react";

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FestoryFeedPage(props: Props) {
    const searchParams = await props.searchParams;
    const session = await getFestorySession();

    if (!session) {
        redirect("/festory");
    }

    const initialPosts = await getFestoryPosts();
    const scrollToPostId = typeof searchParams.post === 'string' ? searchParams.post : undefined;

    return (
        <div className="min-h-screen bg-white text-neutral-900 px-0 md:px-4 pt-2 md:pt-6">
            <div className="max-w-md mx-auto min-h-screen flex flex-col relative">
                <GlobalAudio />
                {/* Header */}
                <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md flex items-center justify-between p-4 border-b border-orange-900/10">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-orange-50 transition-colors" title="Back to Home">
                            <Home className="w-5 h-5 text-neutral-900/70" />
                        </Link>
                        <h1 className="text-xl font-black tracking-tighter bg-[linear-gradient(135deg,#EC8230,#DB3C3F)] bg-clip-text text-transparent">
                            FESTORY
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-900/10 text-[10px] font-medium text-neutral-900/60">
                            LIVE
                        </div>
                        <ProfileSettings
                            currentName={session.name}
                            currentImage={session.image}
                            initial={session.name[0]}
                        />
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 p-4 pb-24">
                    <CreatePost userImage={session.image} userName={session.name} />
                    <FeedList
                        initialPosts={initialPosts}
                        currentUserId={session.id}
                        initialScrollToPostId={scrollToPostId}
                    />
                </main>
            </div>
        </div>
    );
}
