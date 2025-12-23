"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile, UserRole, Store } from "@/lib/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, UserCheck, Store as StoreIcon, Trash2, Briefcase, Pencil, ArrowUpDown, MoreHorizontal, Check, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";

export default function AdminUsersPage() {
    return <AdminUsersContent />;
}

interface StoreAssignmentCellProps {
    user: UserProfile;
    stores: Store[];
    onAssign: (userId: string, storeId: string) => void;
}

const StoreAssignmentCell = ({ user, stores, onAssign }: StoreAssignmentCellProps) => {
    const [open, setOpen] = useState(false);

    if (user.role !== "magaza") return <span className="text-muted-foreground">-</span>;

    const selectedStore = stores.find(s => s.id === user.storeId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between"
                >
                    {selectedStore ? selectedStore.name : "Mağaza seçin"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Mağaza ara..." />
                    <CommandList>
                        <CommandEmpty>Mağaza bulunamadı.</CommandEmpty>
                        <CommandGroup>
                            {stores.map((store) => (
                                <CommandItem
                                    key={store.id}
                                    value={store.name}
                                    onSelect={() => {
                                        onAssign(user.uid, store.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            user.storeId === store.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {store.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

interface RoleAssignmentCellProps {
    user: UserProfile;
    onRoleSelect: (userId: string, role: UserRole) => void;
}

const RoleAssignmentCell = ({ user, onRoleSelect }: RoleAssignmentCellProps) => {
    const [open, setOpen] = useState(false);

    const roles: { value: UserRole; label: string }[] = [
        { value: "pending", label: "Onay Bekliyor" },
        { value: "admin", label: "Admin" },
        { value: "denetmen", label: "Denetmen" },
        { value: "bolge-muduru", label: "Bölge Müdürü" },
        { value: "magaza", label: "Mağaza" },
    ];

    const selectedRole = roles.find(r => r.value === user.role);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[140px] justify-between"
                >
                    {selectedRole ? selectedRole.label : user.role}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[140px] p-0">
                <Command>
                    <CommandInput placeholder="Rol ara..." />
                    <CommandList>
                        <CommandEmpty>Rol bulunamadı.</CommandEmpty>
                        <CommandGroup>
                            {roles.map((role) => (
                                <CommandItem
                                    key={role.value}
                                    value={role.label}
                                    onSelect={() => {
                                        onRoleSelect(user.uid, role.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            user.role === role.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {role.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

function AdminUsersContent() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("admin");

    // Delete Dialog State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

    // Store Assignment Dialog State
    const [storeDialogOpen, setStoreDialogOpen] = useState(false);
    const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{ userId: string; role: UserRole } | null>(null);
    const [selectedStoreId, setSelectedStoreId] = useState<string>("");
    const [openStoreCombobox, setOpenStoreCombobox] = useState(false);

    useEffect(() => {
        if (!authLoading && userProfile?.role !== "admin") {
            router.push("/");
            return;
        }

        if (!authLoading && userProfile?.role === "admin") {
            loadData();
        }
    }, [authLoading, userProfile, router]);

    useEffect(() => {
        const filter = searchParams.get("filter");
        if (filter === "pending") {
            setActiveTab("pending");
        }
    }, [searchParams]);

    const loadData = async () => {
        try {
            // Kullanıcıları yükle
            const usersSnapshot = await getDocs(collection(db, "users"));
            const usersData = usersSnapshot.docs.map(
                (doc) => doc.data() as UserProfile
            );
            setUsers(usersData);

            // Mağazaları yükle
            const storesSnapshot = await getDocs(collection(db, "stores"));
            const storesData = storesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Store[];
            setStores(storesData);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const performRoleUpdate = async (userId: string, newRole: UserRole, storeId?: string) => {
        try {
            const userRef = doc(db, "users", userId);
            const updateData: any = { role: newRole };

            if (newRole === "magaza" && storeId) {
                updateData.storeId = storeId;
            } else if (newRole !== "magaza") {
                updateData.storeId = null;
            }

            await updateDoc(userRef, updateData);

            setUsers((prev) =>
                prev.map((user) =>
                    user.uid === userId
                        ? { ...user, role: newRole, ...(newRole === "magaza" ? { storeId } : { storeId: undefined }) }
                        : user
                )
            );

            toast.success("Kullanıcı güncellendi");
        } catch (error) {
            console.error("Error updating role:", error);
            toast.error("Güncelleme sırasında hata oluştu");
        }
    };

    const handleRoleSelect = (userId: string, newRole: UserRole) => {
        if (newRole === "magaza") {
            setPendingRoleUpdate({ userId, role: newRole });
            setSelectedStoreId(""); // Reset selection
            setStoreDialogOpen(true);
        } else {
            performRoleUpdate(userId, newRole);
        }
    };

    const confirmStoreAssignment = () => {
        if (pendingRoleUpdate && selectedStoreId) {
            performRoleUpdate(pendingRoleUpdate.userId, pendingRoleUpdate.role, selectedStoreId);
            setStoreDialogOpen(false);
            setPendingRoleUpdate(null);
            setSelectedStoreId("");
        } else {
            toast.error("Lütfen bir mağaza seçin");
        }
    };

    const assignStore = async (userId: string, storeId: string) => {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, { storeId });

            setUsers((prev) =>
                prev.map((user) =>
                    user.uid === userId ? { ...user, storeId } : user
                )
            );

            toast.success("Mağaza başarıyla atandı");
        } catch (error) {
            console.error("Error assigning store:", error);
            toast.error("Mağaza atanırken hata oluştu");
        }
    };

    const handleDeleteClick = (userId: string, userName: string) => {
        setUserToDelete({ id: userId, name: userName });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;

        try {
            const userRef = doc(db, "users", userToDelete.id);
            await deleteDoc(userRef);

            setUsers((prev) => prev.filter((user) => user.uid !== userToDelete.id));

            toast.success("Kullanıcı başarıyla silindi");
            setDeleteDialogOpen(false);
            setUserToDelete(null);
        } catch (error) {
            console.error("Error deleting user:", error);
            toast.error("Kullanıcı silinirken hata oluştu");
        }
    };

    const getRoleBadge = (role: UserRole) => {
        switch (role) {
            case "admin":
                return (
                    <Badge className="bg-purple-500">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Admin
                    </Badge>
                );
            case "denetmen":
                return (
                    <Badge className="bg-blue-500">
                        <UserCheck className="mr-1 h-3 w-3" />
                        Denetmen
                    </Badge>
                );
            case "magaza":
                return (
                    <Badge className="bg-green-500">
                        <StoreIcon className="mr-1 h-3 w-3" />
                        Mağaza
                    </Badge>
                );
            case "bolge-muduru":
                return (
                    <Badge className="bg-orange-500">
                        <Briefcase className="mr-1 h-3 w-3" />
                        Bölge Müdürü
                    </Badge>
                );
            case "pending":
                return (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Onay Bekliyor
                    </Badge>
                );
        }
    };

    const filteredUsers = users.filter(user => {
        if (activeTab === "pending") {
            return user.role === "pending";
        } else if (activeTab === "magaza") {
            return user.role === "magaza";
        } else if (activeTab === "denetmen") {
            return user.role === "denetmen";
        } else if (activeTab === "bolge-muduru") {
            return user.role === "bolge-muduru";
        } else if (activeTab === "admin") {
            return user.role === "admin";
        }
        return false;
    });

    const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [editFormData, setEditFormData] = useState({ firstName: "", lastName: "" });

    const openEditUserDialog = (user: UserProfile) => {
        setEditingUser(user);
        setEditFormData({
            firstName: user.firstName || "",
            lastName: user.lastName || ""
        });
        setEditUserDialogOpen(true);
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;

        try {
            const userRef = doc(db, "users", editingUser.uid);
            await updateDoc(userRef, {
                firstName: editFormData.firstName,
                lastName: editFormData.lastName
            });

            setUsers(prev => prev.map(u =>
                u.uid === editingUser.uid
                    ? { ...u, firstName: editFormData.firstName, lastName: editFormData.lastName }
                    : u
            ));

            toast.success("Kullanıcı bilgileri güncellendi");
            setEditUserDialogOpen(false);
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Güncelleme sırasında hata oluştu");
        }
    };

    const columns = useMemo<ColumnDef<UserProfile>[]>(() => {
        const cols: ColumnDef<UserProfile>[] = [
            {
                accessorKey: "email",
                id: "Kullanıcı",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        >
                            Kullanıcı
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    )
                },
                cell: ({ row }) => {
                    const user = row.original;
                    return (
                        <div className="flex items-center gap-2">
                            {user.photoURL && (
                                <img
                                    src={user.photoURL}
                                    alt={user.displayName || "User"}
                                    className="h-8 w-8 rounded-full"
                                />
                            )}
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">
                                    {user.displayName || "İsimsiz"}
                                </span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                        </div>
                    );
                }
            }
        ];

        // Ad ve Soyad kolonları - Mağaza sekmesinde gösterilmez
        if (activeTab !== "magaza") {
            cols.push(
                {
                    accessorKey: "firstName",
                    header: "Ad",
                    cell: ({ row }) => row.original.firstName || "-"
                },
                {
                    accessorKey: "lastName",
                    header: "Soyad",
                    cell: ({ row }) => row.original.lastName || "-"
                }
            );
        }

        // Rol kolonu
        cols.push({
            accessorKey: "role",
            header: "Rol",
            cell: ({ row }) => getRoleBadge(row.original.role)
        });

        // Mağaza Atama kolonu - Sadece mağaza sekmesinde gösterilir (veya onay bekleyenlerde opsiyonel olabilir ama talep mağaza atamasını kaldırmak yönündeydi diğerlerinden)
        // Talep: "sadece mağazada mağaza ataması kalabilir"
        if (activeTab === "magaza") {
            cols.push({
                id: "storeAssignment",
                header: "Mağaza",
                cell: ({ row }) => (
                    <StoreAssignmentCell
                        user={row.original}
                        stores={stores}
                        onAssign={assignStore}
                    />
                )
            });
        }

        // Rol Değiştirme ve İşlemler her zaman gösterilir
        cols.push(
            {
                id: "roleAssignment",
                header: "Rol Değiştir",
                cell: ({ row }) => (
                    <RoleAssignmentCell
                        user={row.original}
                        onRoleSelect={handleRoleSelect}
                    />
                )
            },
            {
                id: "actions",
                enableHiding: false,
                cell: ({ row }) => {
                    const user = row.original;
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Menüyü aç</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openEditUserDialog(user)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => handleDeleteClick(user.uid, user.displayName || user.email)}
                                    className="text-red-600 focus:text-red-600"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Sil
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                }
            }
        );

        return cols;
    }, [activeTab, stores, assignStore, handleRoleSelect, handleDeleteClick, openEditUserDialog]);

    return (
        <div className="container mx-auto py-4 md:py-8 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-3xl">Kullanıcı Yönetimi</CardTitle>
                            <CardDescription>
                                Kullanıcılara rol atayın ve mağaza kullanıcılarını mağazalarla
                                eşleştirin
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="mb-4 w-full flex-wrap h-auto justify-center">
                            <TabsTrigger value="admin" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-purple-600 font-semibold">
                                Admin
                            </TabsTrigger>
                            <TabsTrigger value="magaza">Mağaza</TabsTrigger>
                            <TabsTrigger value="denetmen">Denetmenler</TabsTrigger>
                            <TabsTrigger value="bolge-muduru">Bölge Müdürü</TabsTrigger>
                            <TabsTrigger value="pending" className="relative">
                                Onay Bekleyenler
                                {users.filter(u => u.role === "pending").length > 0 && (
                                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                        {users.filter(u => u.role === "pending").length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="magaza" className="mt-0">
                            {loading ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-gray-50">
                                    <StoreIcon className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Mağaza kullanıcısı yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Şu anda sistemde mağaza kullanıcısı bulunmuyor.
                                    </p>
                                </div>
                            ) : (
                                <DataTable columns={columns} data={filteredUsers} searchKey="Kullanıcı" searchPlaceholder="Email ara..." mobileHiddenColumns={["role"]} />
                            )}
                        </TabsContent>

                        <TabsContent value="denetmen" className="mt-0">
                            {loading ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-gray-50">
                                    <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Denetmen yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Şu anda sistemde denetmen bulunmuyor.
                                    </p>
                                </div>
                            ) : (
                                <DataTable columns={columns} data={filteredUsers} searchKey="Kullanıcı" searchPlaceholder="Email ara..." mobileHiddenColumns={["role"]} />
                            )}
                        </TabsContent>

                        <TabsContent value="bolge-muduru" className="mt-0">
                            {loading ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-gray-50">
                                    <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Bölge müdürü yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Şu anda sistemde bölge müdürü bulunmuyor.
                                    </p>
                                </div>
                            ) : (
                                <DataTable columns={columns} data={filteredUsers} searchKey="Kullanıcı" searchPlaceholder="Email ara..." mobileHiddenColumns={["role"]} />
                            )}
                        </TabsContent>

                        <TabsContent value="admin" className="mt-0">
                            {loading ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-gray-50">
                                    <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Admin yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Şu anda sistemde admin bulunmuyor.
                                    </p>
                                </div>
                            ) : (
                                <DataTable columns={columns} data={filteredUsers} searchKey="Kullanıcı" searchPlaceholder="Email ara..." mobileHiddenColumns={["role"]} />
                            )}
                        </TabsContent>

                        <TabsContent value="pending" className="mt-0">
                            {loading ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-gray-50">
                                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold">Bekleyen kullanıcı yok</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Şu anda onay bekleyen yeni kullanıcı bulunmuyor.
                                    </p>
                                </div>
                            ) : (
                                <DataTable columns={columns} data={filteredUsers} searchKey="Kullanıcı" searchPlaceholder="Email ara..." mobileHiddenColumns={["role"]} />
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kullanıcıyı silmek istediğinize emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. <strong>{userToDelete?.name}</strong> adlı kullanıcı kalıcı olarak silinecek ve sisteme erişimini kaybedecek.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mağaza Seçimi</DialogTitle>
                        <DialogDescription>
                            Lütfen bu kullanıcıya atamak istediğiniz mağazayı seçin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="store">Mağaza</Label>
                            <Popover open={openStoreCombobox} onOpenChange={setOpenStoreCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openStoreCombobox}
                                        className="w-full justify-between"
                                    >
                                        {selectedStoreId
                                            ? stores.find((store) => store.id === selectedStoreId)?.name
                                            : "Mağaza seçin..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Mağaza ara..." />
                                        <CommandList>
                                            <CommandEmpty>Mağaza bulunamadı.</CommandEmpty>
                                            <CommandGroup>
                                                {stores.map((store) => (
                                                    <CommandItem
                                                        key={store.id}
                                                        value={store.name}
                                                        onSelect={() => {
                                                            setSelectedStoreId(store.id)
                                                            setOpenStoreCombobox(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedStoreId === store.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {store.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={confirmStoreAssignment}>
                            Kaydet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kullanıcı Düzenle</DialogTitle>
                        <DialogDescription>
                            Kullanıcının ad ve soyad bilgilerini güncelleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="firstName">Ad</Label>
                            <Input
                                id="firstName"
                                value={editFormData.firstName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="lastName">Soyad</Label>
                            <Input
                                id="lastName"
                                value={editFormData.lastName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={handleUpdateUser}>
                            Kaydet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
