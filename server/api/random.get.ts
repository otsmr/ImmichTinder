import { defineEventHandler, createError } from 'h3'

const IMMICH_URL = process.env.IMMICH_URL
const IMMICH_TOKEN = process.env.IMMICH_TOKEN

// Global set to keep track of seen asset IDs during the server lifetime
const seenIds = new Set<string>()

export default defineEventHandler(async () => {
    let a: any = null
    let attempts = 0
    const maxAttempts = 30

    while (attempts < maxAttempts) {
        attempts++
        try {
            const response = await $fetch(`${IMMICH_URL}/api/search/random`, {
                method: "POST",
                headers: {
                    "x-api-key": IMMICH_TOKEN
                },
                body: {
                    size: 1,
                    type: 'IMAGE'
                }
            })
            const candidate = Array.isArray(response) ? response[0] : response
            if (candidate && candidate.id) {
                if (!seenIds.has(candidate.id)) {
                    a = candidate
                    seenIds.add(candidate.id)
                    break
                }
            }
        } catch (err) {
            console.error('Fetch random asset error:', err)
        }
    }

    // Fallback if all matches are seen (e.g. user swiped all items in their library)
    if (!a) {
        seenIds.clear()
        const response = await $fetch(`${IMMICH_URL}/api/search/random`, {
            method: "POST",
            headers: {
                "x-api-key": IMMICH_TOKEN
            },
            body: {
                size: 1,
                type: 'IMAGE'
            }
        })
        a = Array.isArray(response) ? response[0] : response
        if (a && a.id) {
            seenIds.add(a.id)
        }
    }

    const id = a?.id
    if (!id) {
        throw createError({ statusCode: 404, message: 'No random asset available' })
    }

    const asset2 = await $fetch(`${IMMICH_URL}/api/assets/${id}`, {
        method: "GET",
        headers: {
            "x-api-key": IMMICH_TOKEN
        }
    });

    console.log('Load asset details:')
    console.log(asset2)



    const exif = asset2.exifInfo || {}

    const takenAt = exif.dateTimeOriginal || a?.localDateTime || null

    // Compose a human-friendly location string if available
    const parts = [exif.city, exif.state, exif.country].filter(Boolean)
    const locationText = parts.length ? parts.join(", ") : null

    return {
        id: a?.id,
        localDateTime: a?.localDateTime || null,
        takenAt,
        location: {
            text: locationText,
            city: exif.city || null,
            state: exif.state || null,
            country: exif.country || null,
            latitude: exif.latitude ?? null,
            longitude: exif.longitude ?? null,
        }
    }
})