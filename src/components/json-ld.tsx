export function JsonLd() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Funoon Fiesta",
        "description": "A premier platform for students to showcase their talents and highlight the rich art forms of Islamic culture.",
        "startDate": "2025-01-01",
        "endDate": "2025-01-05",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
            "@type": "Place",
            "name": "Funoon Fiesta Venue",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Kerala",
                "addressCountry": "IN"
            }
        },
        "organizer": {
            "@type": "Organization",
            "name": "Funoon Fiesta Committee",
            "url": "https://funoonfiesta.noorululama.org"
        }
    }

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    )
}
