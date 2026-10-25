"use client";

import { useEffect, useState } from "react";
import { getFestoryAdminUsers, getFestoryAdminPosts, toggleFestoryUserBan, deleteFestoryPostAdmin } from "@/app/admin/festory-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Ban, CheckCircle, Search, MessageSquare, Heart, Users, FileText, AlertTriangle, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminFestoryPage() {
    return (
        <div className="space-y-8 p-1">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-transparent">
                    FESTORY ADMIN
                </h1>
                <p className="text-muted-foreground">Manage users, content moderation, and safety.</p>
            </div>

            <Tabs defaultValue="users" className="w-full">
                <TabsList className="w-full sm:w-auto grid grid-cols-2 bg-slate-900 border border-white/10 p-1 rounded-xl mb-6">
                    <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">
                        <Users className="w-4 h-4 mr-2" /> Users
                    </TabsTrigger>
                    <TabsTrigger value="posts" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">
                        <FileText className="w-4 h-4 mr-2" /> Posts
                    </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                    <TabsContent value="users" key="users" className="space-y-4">
                        <UsersManager />
                    </TabsContent>
                    <TabsContent value="posts" key="posts" className="space-y-4">
                        <PostsManager />
                    </TabsContent>
                </AnimatePresence>
            </Tabs>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
    return (
        <Card className="bg-slate-900/50 border-white/5 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-white">{value}</div>
            </CardContent>
        </Card>
    );
}

function UsersManager() {
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const data = await getFestoryAdminUsers();
        setUsers(data);
        setLoading(false);
    };

    const handleToggleBan = async (userId: string) => {
        const res = await toggleFestoryUserBan(userId);
        if (res.error) toast.error(res.error);
        else {
            toast.success(res.isBanned ? "User has been banned" : "User access restored");
            loadUsers();
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.phoneNumber?.includes(search) ||
        u.teamId?.toLowerCase().includes(search.toLowerCase())
    );

    const bannedCount = users.filter(u => u.isBanned).length;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <StatsCard title="Total Users" value={users.length} icon={Users} color="text-blue-500" />
                <StatsCard title="Active Users" value={users.length - bannedCount} icon={CheckCircle} color="text-green-500" />
                <StatsCard title="Banned Users" value={bannedCount} icon={ShieldAlert} color="text-red-500" />
            </div>

            <Card className="bg-slate-900 border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <h3 className="font-semibold text-lg text-white">User Directory</h3>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
                        <Input
                            placeholder="Search by name, email, team..."
                            className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-fuchsia-500/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-white/60">
                                <tr>
                                    <th className="p-4 font-medium">User</th>
                                    <th className="p-4 font-medium hidden md:table-cell">Contact</th>
                                    <th className="p-4 font-medium">Team</th>
                                    <th className="p-4 font-medium text-center">Posts</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredUsers.map((user) => (
                                    <motion.tr
                                        key={user.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-white/[0.02] transition-colors"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border border-white/10">
                                                    <AvatarImage src={user.image} />
                                                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium text-white">{user.name}</div>
                                                    <div className="text-xs text-white/40 md:hidden">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 hidden md:table-cell">
                                            <div className="flex flex-col">
                                                <span className="text-white/80">{user.email}</span>
                                                <span className="text-xs text-white/40">{user.phoneNumber || "No Phone"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 uppercase">
                                                {user.teamId}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="font-mono text-white/60">{user.postCount}</span>
                                        </td>
                                        <td className="p-4">
                                            <Badge className={user.isBanned
                                                ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                                                : "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"}>
                                                {user.isBanned ? "Banned" : "Active"}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button
                                                size="sm"
                                                variant={user.isBanned ? "secondary" : "destructive"}
                                                className={`h-8 w-24 ${user.isBanned ? "bg-white/10 hover:bg-white/20 text-white" : ""}`}
                                                onClick={() => handleToggleBan(user.id)}
                                            >
                                                {user.isBanned ? "Restore" : "Ban"}
                                            </Button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}

function PostsManager() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPosts();
    }, []);

    const loadPosts = async () => {
        setLoading(true);
        const data = await getFestoryAdminPosts();
        setPosts(data);
        setLoading(false);
    };

    const handleDelete = async (postId: string) => {
        if (!confirm("Are you sure you want to delete this post? This cannot be undone.")) return;

        // Optimistic UI update
        setPosts(prev => prev.filter(p => p.id !== postId));
        const res = await deleteFestoryPostAdmin(postId);
        if (res.success) {
            toast.success("Post deleted permanently");
        } else {
            toast.error("Failed to delete post");
            loadPosts(); // Revert on failure
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <StatsCard title="Total Posts" value={posts.length} icon={FileText} color="text-purple-500" />
                <StatsCard title="Flagged Posts" value="0" icon={AlertTriangle} color="text-yellow-500" />
                <StatsCard title="Media Files" value={posts.filter(p => p.mediaUrl).length} icon={FileText} color="text-blue-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full flex justify-center p-20">
                        <Loader2 className="h-10 w-10 animate-spin text-fuchsia-500" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="col-span-full text-center p-20 text-muted-foreground border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No posts visible in the feed.</p>
                    </div>
                ) : (
                    posts.map((post, i) => (
                        <motion.div
                            key={post.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="bg-zinc-950 border-white/10 overflow-hidden hover:border-white/20 transition-all flex flex-col h-full group">
                                <CardHeader className="p-4 flex-row items-center gap-3 space-y-0 border-b border-white/5">
                                    <Avatar className="h-8 w-8 border border-white/10">
                                        <AvatarImage src={post.userImage} />
                                        <AvatarFallback>{post.userName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm text-white truncate">{post.userName}</h4>
                                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                                            <span>Team {post.userTeamId}</span>
                                            <span>•</span>
                                            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <Badge className="text-[10px] h-5 border-white/10 text-white/50">{post.type}</Badge>
                                </CardHeader>

                                <CardContent className="p-4 flex-1">
                                    <p className="text-sm text-white/80 line-clamp-4 mb-4 font-light whitespace-pre-wrap">
                                        {post.content}
                                    </p>

                                    {post.mediaUrl && post.type === 'image' && (
                                        <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative group-hover:border-white/20 transition-colors">
                                            <img src={post.mediaUrl} className="w-full h-full object-cover" alt="Post media" loading="lazy" />
                                        </div>
                                    )}
                                    {post.mediaUrl && post.type === 'audio' && (
                                        <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center text-xs text-white/60 flex items-center justify-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            Audio Attachment
                                        </div>
                                    )}
                                </CardContent>

                                <CardFooter className="p-3 bg-white/[0.02] border-t border-white/5 flex gap-2">
                                    <div className="flex-1 flex gap-4 text-xs text-white/40 px-2">
                                        <div className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" />{post.likes?.length}</div>
                                        <div className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" />{post.commentsCount}</div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        size="sm"
                                        onClick={() => handleDelete(post.id)}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
