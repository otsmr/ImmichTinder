<template>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <a v-if="immichAssetUrl" class="icon-btn external-link" :href="immichAssetUrl" target="_blank" rel="noopener" title="Open in Immich">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
      <div class="header-center">
        <img class="logo" src="/logo.png" alt="ImmichSwipe" draggable="false" />
      </div>
      <div class="header-right">
        <button class="refresh icon-btn" @click="showNextCard" :disabled="initialLoading" title="Refresh">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 16h5v5"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item"><span class="icon">💚</span> <span class="val">{{ stats.liked }}</span></div>
      <div class="stat-item"><span class="icon">❌</span> <span class="val">{{ stats.disliked }}</span></div>
      <div class="stat-item"><span class="icon">⭐</span> <span class="val">{{ stats.superliked }}</span></div>
      <div class="stat-item"><span class="icon">🗑️</span> <span class="val">{{ stats.deleted }}</span></div>
    </div>

    <div class="card-area">
      <div v-if="error && !currentId" class="state error">
        <p>{{ error }}</p>
        <button @click="retryInitial">Try again</button>
      </div>

      <div v-else-if="!currentId && initialLoading" class="state loading">Loading...</div>

      <SwipeCard ref="swipe" v-else class="card" @like="onLikeCommit" @dislike="onDislikeCommit" @superlike="onSuperlikeCommit" @delete="onDeleteCommit" @cancel="onCancel">
        <img :src="imageUrl" :key="currentId" alt="Random from Immich" class="photo" draggable="false" @load="onImgLoad" />
        
        <div class="whole-preview-container">
          <img :src="imageUrl" alt="Whole preview" class="whole-preview" draggable="false" />
        </div>

        <div class="meta" v-if="formattedTakenAt || locationWithFlag">
          <div class="line time" v-if="formattedTakenAt">{{ formattedTakenAt }}</div>
          <div class="line location" v-if="locationWithFlag">{{ locationWithFlag }}</div>
        </div>
      </SwipeCard>
    </div>

  </div>
</template>

<script setup lang="ts">
import SwipeCard from '~/components/SwipeCard.vue'
import { ref, computed, onMounted } from 'vue'

// Exposed methods from SwipeCard
type SwipeCardExposed = { flingRight: () => Promise<void>; flingLeft: () => Promise<void>; flingUp: () => Promise<void>; flingDown: () => Promise<void> }
const swipe = ref<SwipeCardExposed | null>(null)

const currentId = ref<string | null>(null)
const error = ref<string | null>(null)

const stats = ref({
  liked: 0,
  disliked: 0,
  superliked: 0,
  deleted: 0
})

function saveStats() {
  try {
    localStorage.setItem('immich_tinder_stats', JSON.stringify(stats.value))
  } catch (e) {
    console.error('Failed to save stats', e)
  }
}

// Metadata for display
const takenAt = ref<string | null>(null)
const location = ref<{
  text: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
} | null>(null)

const formattedTakenAt = computed(() => {
  if (!takenAt.value) return ''
  const d = new Date(takenAt.value)
  if (isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    } as Intl.DateTimeFormatOptions).format(d)
  } catch {
    return d.toLocaleString()
  }
})

const locationText = computed(() => {
  const loc = location.value
  if (!loc) return ''
  if (loc.text) return loc.text
  const parts = [loc.city, loc.state, loc.country].filter(Boolean)
  return parts.join(', ')
})

function toFlagEmojiFromCountry(countryRaw?: string | null): string {
  if (!countryRaw) return ''
  const map: Record<string, string> = {
    'UNITED STATES': 'US', 'USA': 'US', 'US': 'US', 'U.S.A.': 'US',
    'UNITED KINGDOM': 'GB', 'UK': 'GB', 'ENGLAND': 'GB', 'SCOTLAND': 'GB', 'WALES': 'GB', 'GB': 'GB',
    'GERMANY': 'DE', 'DEUTSCHLAND': 'DE', 'DE': 'DE',
    'FRANCE': 'FR', 'FR': 'FR',
    'SPAIN': 'ES', 'ESPAÑA': 'ES', 'ES': 'ES',
    'ITALY': 'IT', 'ITALIA': 'IT', 'IT': 'IT',
    'AUSTRIA': 'AT', 'ÖSTERREICH': 'AT', 'AT': 'AT',
    'SWITZERLAND': 'CH', 'SCHWEIZ': 'CH', 'SUISSE': 'CH', 'SVIZZERA': 'CH', 'CH': 'CH',
    'PORTUGAL': 'PT', 'PT': 'PT',
    'NETHERLANDS': 'NL', 'HOLLAND': 'NL', 'NL': 'NL',
    'POLAND': 'PL', 'POLSKA': 'PL', 'PL': 'PL',
    'CZECHIA': 'CZ', 'CZECH REPUBLIC': 'CZ', 'CZ': 'CZ',
    'BELGIUM': 'BE', 'BE': 'BE',
    'SWEDEN': 'SE', 'SE': 'SE',
    'NORWAY': 'NO', 'NO': 'NO',
    'DENMARK': 'DK', 'DK': 'DK',
    'FINLAND': 'FI', 'FI': 'FI',
    'IRELAND': 'IE', 'IE': 'IE',
    'CANADA': 'CA', 'CA': 'CA',
    'AUSTRALIA': 'AU', 'AU': 'AU',
    'NEW ZEALAND': 'NZ', 'NZ': 'NZ',
    'JAPAN': 'JP', 'JP': 'JP',
    'CHINA': 'CN', 'CN': 'CN',
    'INDIA': 'IN', 'IN': 'IN'
  }
  const key = countryRaw.trim().toUpperCase()
  let code = map[key]
  if (!code) {
    // If already looks like a 2-letter alpha code
    if (/^[A-Z]{2}$/.test(key)) code = key
  }
  if (!code) return ''
  return isoToFlagEmoji(code)
}

function isoToFlagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return ''
  const base = 0x1F1E6
  const chars = code.split('').map(c => String.fromCodePoint(base + (c.charCodeAt(0) - 65)))
  return chars.join('')
}

const locationWithFlag = computed(() => {
  const text = locationText.value
  const flag = toFlagEmojiFromCountry(location.value?.country || null)
  if (flag && text) return `${flag} ${text}`
  if (text) return text
  return ''
})

const natural = ref<{ w: number; h: number } | null>(null)
const cardAspectStyle = computed(() => {
  const n = natural.value
  if (n && n.w > 0 && n.h > 0) {
    return { aspectRatio: `${n.w} / ${n.h}` }
  }
  // Fallback until the image loads
  return { aspectRatio: '3 / 4' }
})

const imageUrl = computed(() => (currentId.value ? `/api/image?id=${encodeURIComponent(currentId.value)}` : ''))

// Immich deep link for opening the current asset in Immich Web
const runtime = useRuntimeConfig()
const immichAssetUrl = computed(() => {
  const base = (runtime as any)?.public?.immichUrl as string | undefined
  const id = currentId.value
  if (!base || !id) return ''
  const clean = base.endsWith('/') ? base.slice(0, -1) : base
  return `${clean}/photos/${encodeURIComponent(id)}`
})

// Two-card pipeline: keep next card preloaded for instant swap
const initialLoading = ref(true)
const preloading = ref(false)
const nextCard = ref<{
  id: string
  takenAt: string | null
  location: {
    text: string | null
    city: string | null
    state: string | null
    country: string | null
    latitude: number | null
    longitude: number | null
  } | null
  natural: { w: number; h: number } | null
} | null>(null)

async function fetchRandomMeta() {
  return await $fetch<{
    id: string
    localDateTime?: string | null
    takenAt?: string | null
    location?: {
      text: string | null
      city: string | null
      state: string | null
      country: string | null
      latitude: number | null
      longitude: number | null
    } | null
  }>(`/api/random`)
}

function preloadImage(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height })
    img.onerror = (e) => reject(e)
    // Try to decode for smoother paint if supported
    // @ts-ignore
    if (img.decode) {
      img.addEventListener('load', async () => {
        try { /* no-op, already loaded */ } catch {}
      })
    }
    img.src = url
  })
}

async function preloadNext() {
  if (preloading.value) return
  preloading.value = true
  try {
    const res = await fetchRandomMeta()
    const url = `/api/image?id=${encodeURIComponent(res.id)}`
    let dims: { w: number; h: number } | null = null
    try {
      dims = await preloadImage(url)
    } catch {
      // If image decode fails, still proceed; aspect will adjust on load
      dims = null
    }
    nextCard.value = {
      id: res.id,
      takenAt: res.takenAt || res.localDateTime || null,
      location: res.location || null,
      natural: dims,
    }
    error.value = null
  } catch (e: any) {
    if (!currentId.value) {
      error.value = e?.message || 'Failed to load random image'
    }
    nextCard.value = null
  } finally {
    preloading.value = false
  }
}

function applyNextToCurrent() {
  if (!nextCard.value) return false
  const n = nextCard.value
  currentId.value = n.id
  takenAt.value = n.takenAt
  location.value = n.location
  natural.value = n.natural
  nextCard.value = null
  return true
}

async function showNextCard() {
  // If we already have a preloaded next card, swap immediately
  let swapped = applyNextToCurrent()
  if (!swapped) {
    await preloadNext()
    swapped = applyNextToCurrent()
  }
  // Start preloading the following card immediately
  void preloadNext()
}

function retryInitial() {
  initialLoading.value = true
  currentId.value = null
  takenAt.value = null
  location.value = null
  natural.value = null
  error.value = null
  void initPipeline()
}

function onImgLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (img && img.naturalWidth && img.naturalHeight) {
    natural.value = { w: img.naturalWidth, h: img.naturalHeight }
  }
}

async function commit(action: 'like' | 'dislike' | 'superlike' | 'delete') {
  const prevId = currentId.value
  
  if (action === 'like') stats.value.liked++
  else if (action === 'dislike') stats.value.disliked++
  else if (action === 'superlike') stats.value.superliked++
  else if (action === 'delete') stats.value.deleted++
  saveStats()

  // Swap immediately for snappy UX
  showNextCard()
  if (prevId) {
    try {
      await $fetch(`/api/${action}`, { method: 'POST', body: { id: prevId } })
    } catch (e) {
      console.error(e)
    }
  }
}

// Called by SwipeCard after its fling completes
function onLikeCommit() {
  void commit('like')
}
function onDislikeCommit() {
  void commit('dislike')
}
function onSuperlikeCommit() {
  void commit('superlike')
}
function onDeleteCommit() {
  void commit('delete')
}

// Trigger programmatic fling animations from buttons
async function triggerLike() {
  if (!swipe.value) return
  await swipe.value.flingRight()
}
async function triggerDislike() {
  if (!swipe.value) return
  await swipe.value.flingLeft()
}
async function triggerSuperlike() {
  // No dedicated up-swipe animation; commit immediately
  await commit('superlike')
}

function onCancel() {
  // no-op for now
}

async function initPipeline() {
  try {
    await preloadNext()
    applyNextToCurrent()
    // Kick off preloading of the following card
    void preloadNext()
  } finally {
    initialLoading.value = false
  }
}

onMounted(() => {
  void initPipeline()
  try {
    const saved = localStorage.getItem('immich_tinder_stats')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed) {
        stats.value.liked = Number(parsed.liked) || 0
        stats.value.disliked = Number(parsed.disliked) || 0
        stats.value.superliked = Number(parsed.superliked) || 0
        stats.value.deleted = Number(parsed.deleted) || 0
      }
    }
  } catch (e) {
    console.error('Failed to load stats', e)
  }
})
</script>

<style scoped>
.page {
  height: 100dvh; /* lock viewport height */
  overflow: hidden; /* prevent page scroll */
  display: flex;
  flex-direction: column;
  background-color: #000;
}
.header {
  flex-shrink: 0;
  height: 60px;
  display: grid;
  grid-template-columns: 60px 1fr 60px;
  align-items: center;
  padding: 0 8px;
  border-bottom: 1px solid #1a1a1a;
  background-color: #080808;
}
.header-left,
.header-right,
.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
.header .logo {
  height: 36px;
  max-height: 100%;
  width: auto;
  display: block;
}
.header .icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #9ca3af; /* gray-400 */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  transition: background 0.2s, color 0.2s, transform 0.1s;
  padding: 0;
}
.header .icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.header .icon-btn:active {
  transform: scale(0.95);
}
.header .icon {
  width: 22px;
  height: 22px;
}

.stats-bar {
  flex-shrink: 0;
  height: 38px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: #0c0f17;
  border-bottom: 1px solid #1a1a1a;
  font-size: 13px;
  font-weight: 600;
  color: #9ca3af;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.stat-item .icon {
  font-size: 14px;
}
.stat-item .val {
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.card-area {
  flex-grow: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden; /* ensure content stays within */
  padding: 16px; /* breathing room without causing page scroll */
  box-sizing: border-box;
}
.card {
  width: auto !important;
  height: auto !important;
  max-width: min(100%, 480px);
  max-height: 100%;
  aspect-ratio: 3 / 5;
  background: #111;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(0,0,0,0.45);
  display: flex;
  flex-direction: column;
  position: relative;
}
.photo {
  width: 100%;
  height: 100%;
  object-fit: cover; /* zoom in in the center */
  user-select: none;
}

/* Whole image preview container */
.whole-preview-container {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 76px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 15px rgba(0,0,0,0.6);
  background-color: #0c0f17;
  z-index: 10;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.whole-preview {
  width: 100%;
  height: 100%;
  object-fit: contain; /* preview the whole uncropped image */
}

/* Metadata overlay inside the card */
.meta {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  padding-right: 104px; /* reserve space for thumbnail */
  color: #fff;
  font-size: clamp(15px, 4.2vw, 19px);
  line-height: 1.4;
  background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 35%, rgba(0,0,0,0.85) 100%);
  pointer-events: none; /* do not block swipe */
}
.meta .line { text-shadow: 0 1px 4px rgba(0,0,0,0.85); }
.meta .time { font-weight: 700; margin-bottom: 2px; }
.meta .location { opacity: 0.95; font-size: 0.9em; }

.state.loading, .state.error {
  color: #777;
  font-size: 14px;
}
.state.error button { margin-top: 8px; }
</style>
