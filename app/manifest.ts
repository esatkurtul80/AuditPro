import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'AuditPro',
        short_name: 'AuditPro',
        description: 'Profesyonel mağaza denetim ve aksiyon takip sistemi',
        start_url: '/login',
        id: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        scope: '/',
        prefer_related_applications: false,
        categories: ['productivity', 'business', 'utilities'],
        shortcuts: [
            {
                name: "Denetim Başlat",
                short_name: "Denetim",
                description: "Yeni bir mağaza denetimi başlat",
                url: "/denetmen",
                icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }]
            }
        ],
        screenshots: [
            {
                src: '/login-assets-new/welcome-image.jpg',
                sizes: '1080x1920',
                type: 'image/jpeg',
                // @ts-ignore
                form_factor: 'wide',
                label: 'AuditPro Hoşgeldiniz Ekranı'
            },
            {
                src: '/login-assets-new/welcome-image.jpg',
                sizes: '1080x1920',
                type: 'image/jpeg',
                label: 'AuditPro Mobil Ekranı'
            }
        ],
        icons: [
            {
                src: '/pwa-icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
            },
            {
                src: '/login-assets-new/logo.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
            }
        ],
    }
}
