"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Announcement, UserProfile, Store as StoreType } from "@/lib/types"
import { Mail } from "@/components/announcements/mail"
import { RecipientOption } from "@/components/announcements/recipient-selector"
import { Loader2 } from "lucide-react"

export default function AnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch Announcements (Real-time)
    useEffect(() => {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ 
                id: d.id, 
                ...d.data() 
            } as Announcement))
            setAnnouncements(data)
            setLoading(false)
        }, (error) => {
            console.error(error)
            setLoading(false)
        })

        return () => unsubscribe()
    }, [])

    // Fetch Recipient Options
    useEffect(() => {
        const fetchOptions = async () => {
             try {
                // 1. Static Groups
                const staticGroups: RecipientOption[] = [
                    { id: "group_all", label: "T├╝m Kullan─▒c─▒lar", type: "role_group", value: "all", count: 0 },
                    { id: "group_magaza", label: "T├╝m Ma─şazalar", type: "role_group", value: "magaza", count: 0 },
                    { id: "group_denetmen", label: "T├╝m Denetmenler", type: "role_group", value: "denetmen", count: 0 },
                    { id: "group_bolge_muduru", label: "T├╝m B├Âlge M├╝d├╝rleri", type: "role_group", value: "bolge-muduru", count: 0 },
                ]

                // 2. Fetch Users
                const usersRef = collection(db, "users")
                const usersSnap = await getDocs(usersRef)
                const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UserProfile))

                // Update Group Counts
                staticGroups[0].count = users.length
                staticGroups[1].count = users.filter(u => u.role === "magaza").length
                staticGroups[2].count = users.filter(u => u.role === "denetmen").length
                staticGroups[3].count = users.filter(u => u.role === "bolge-muduru").length

                // User Options
                const userOptions: RecipientOption[] = users.map(u => ({
                    id: u.uid,
                    label: u.displayName || u.email,
                    type: "user",
                    value: u.uid,
                    avatar: u.photoURL || undefined,
                    role: u.role
                }))

                // 3. Fetch Stores
                const storesRef = collection(db, "stores")
                const storesSnap = await getDocs(storesRef)
                const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StoreType))

                // Store Options
                const storeOptions: RecipientOption[] = stores.map(s => ({
                    id: s.id,
                    label: s.name,
                    type: "store",
                    value: s.id,
                    city: s.city,
                    regionalManagerId: s.regionalManagerId
                }))

                // 4. Region Groups
                // Find all unique regional managers from stores
                const regionalManagerIds = Array.from(new Set(stores.map(s => s.regionalManagerId).filter(Boolean))) as string[]
                
                const regionOptions: RecipientOption[] = regionalManagerIds.map(rmId => {
                    const rmUser = users.find(u => u.uid === rmId)
                    const storeCount = stores.filter(s => s.regionalManagerId === rmId).length
                    return {
                        id: `region_${rmId}`,
                        label: rmUser ? `B├Âlge: ${rmUser.displayName}` : "Bilinmeyen B├Âlge Y├Âneticisi",
                        type: "region_group",
                        value: rmId,
                        count: storeCount
                    }
                })
                
                // Add Cities (New requirement)
                 const cities = Array.from(new Set(stores.map(s => s.city).filter(Boolean))) as string[]
                 const cityOptions: RecipientOption[] = cities.map(city => {
                     const storeCount = stores.filter(s => s.city === city).length
                     return {
                         id: `city_${city}`,
                         label: `─░l: ${city}`,
                         type: "region_group", // Reusing region_group type logic for store selection
                         value: city,
                         count: storeCount
                     }
                 })

                setRecipientOptions([...staticGroups, ...regionOptions, ...cityOptions, ...storeOptions, ...userOptions])

            } catch (error) {
                console.error("Error fetching recipient options:", error)
            }
        }
        fetchOptions()
    }, [])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="hidden h-full min-h-[calc(100vh-64px)] flex-col overflow-hidden md:flex">
             {/* Mail Layout passing data */}
             <Mail 
                announcements={announcements}
                defaultLayout={[20, 32, 48]}
                defaultCollapsed={false}
                navCollapsedSize={4}
                recipientOptions={recipientOptions}
             />
        </div>
    )
}
