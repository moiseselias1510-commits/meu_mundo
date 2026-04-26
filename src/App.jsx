import { useEffect, useMemo, useRef, useState } from 'react'
import { centerProfile, constellationData } from './data/constellationData'

const OWNER_META = {
  you: {
    label: 'só seu',
    badge: 'teu lado',
    className: 'owner-you'
  },
  her: {
    label: 'só dela',
    badge: 'lado dela',
    className: 'owner-her'
  },
  common: {
    label: 'dos dois',
    badge: 'em comum',
    className: 'owner-common'
  }
}

function asset(path) {
  return `${import.meta.env.BASE_URL}${path}`
}

function polar(cx, cy, radius, angleDeg) {
  const angle = (angleDeg * Math.PI) / 180
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export default function App() {
  const [scene, setScene] = useState('world')
  const [portalActive, setPortalActive] = useState(false)
  const [treeUnlocked, setTreeUnlocked] = useState(false)
  const [nightMode, setNightMode] = useState(false)
  const [ambientEnabled, setAmbientEnabled] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [visited, setVisited] = useState([])
  const [nowPlaying, setNowPlaying] = useState(null)

  const ambientRef = useRef(null)
  const currentTrackRef = useRef(null)
  const portalTimeoutRef = useRef(null)

  useEffect(() => {
    document.title = centerProfile.projectName
    return () => {
      clearTimeout(portalTimeoutRef.current)
      if (ambientRef.current) ambientRef.current.pause()
      if (currentTrackRef.current) currentTrackRef.current.pause()
    }
  }, [])

  const totalDiscoverable = useMemo(() => {
    return (
      constellationData.length +
      constellationData.reduce((acc, category) => acc + category.items.length, 0)
    )
  }, [])

  const progress = visited.length / totalDiscoverable

  const categoryNodes = useMemo(() => {
    return constellationData.map((category) => {
      const point = polar(50, 50, 34, category.angle)
      return { ...category, ...point }
    })
  }, [])

  const activeCategory = useMemo(() => {
    return categoryNodes.find((category) => category.id === activeCategoryId) || null
  }, [activeCategoryId, categoryNodes])

  const itemNodes = useMemo(() => {
    if (!activeCategory) return []

    const total = activeCategory.items.length
    const spread = total === 1 ? [0] : activeCategory.items.map((_, index) => {
      const start = -24
      const end = 24
      const step = total === 1 ? 0 : (end - start) / (total - 1)
      return start + step * index
    })

    return activeCategory.items.map((item, index) => {
      const radius = 12 + (index % 2) * 2.5
      const point = polar(
        activeCategory.x,
        activeCategory.y,
        radius,
        activeCategory.angle + 180 + spread[index]
      )

      return {
        ...item,
        x: clamp(point.x, 9, 91),
        y: clamp(point.y, 11, 89),
        parentId: activeCategory.id
      }
    })
  }, [activeCategory])

  function markVisited(key) {
    setVisited((prev) => (prev.includes(key) ? prev : [...prev, key]))
  }

  function startAmbient() {
    if (!ambientEnabled) return

    if (!ambientRef.current) {
      ambientRef.current = new Audio(asset('assets/audio/ambient-piano-soft.mp3'))
      ambientRef.current.loop = true
      ambientRef.current.volume = nowPlaying ? 0.04 : 0.11
    }

    ambientRef.current
      .play()
      .catch(() => {
        /* se não existir arquivo, apenas ignora */
      })
  }

  function resetAmbientVolume() {
    if (ambientRef.current) {
      ambientRef.current.volume = ambientEnabled ? 0.11 : 0
    }
  }

  function handleEnterPortal() {
    startAmbient()

    const sfx = new Audio(asset('assets/audio/sfx-portal-open.mp3'))
    sfx.volume = 0.25
    sfx.play().catch(() => {})

    setPortalActive(true)

    portalTimeoutRef.current = setTimeout(() => {
      setScene('core')
      setPortalActive(false)
    }, 1500)
  }

  function toggleAmbient() {
    setAmbientEnabled((prev) => {
      const next = !prev

      if (!next && ambientRef.current) {
        ambientRef.current.pause()
      }

      if (next) {
        setTimeout(() => startAmbient(), 50)
      }

      return next
    })
  }

  function handleUnlockTree() {
    setTreeUnlocked(true)
  }

  function handleCategoryClick(category) {
    if (!treeUnlocked) setTreeUnlocked(true)

    markVisited(`category:${category.id}`)
    setSelectedItem(null)

    setActiveCategoryId((prev) => (prev === category.id ? null : category.id))
  }

  function stopCurrentTrack() {
    if (currentTrackRef.current) {
      currentTrackRef.current.pause()
      currentTrackRef.current.currentTime = 0
      currentTrackRef.current = null
      setNowPlaying(null)
      resetAmbientVolume()
    }
  }

  function handleItemClick(item) {
    markVisited(`item:${item.id}`)
    setSelectedItem(item)

    if (item.type === 'music') {
      const sameTrack =
        currentTrackRef.current && currentTrackRef.current.__itemId === item.id

      if (sameTrack) {
        stopCurrentTrack()
        return
      }

      if (currentTrackRef.current) {
        stopCurrentTrack()
      }

      const audio = new Audio(asset(item.audio))
      audio.__itemId = item.id
      audio.volume = 0.96

      audio.addEventListener('loadedmetadata', () => {
        if (typeof item.previewStart === 'number') {
          try {
            audio.currentTime = item.previewStart
          } catch {
            /* ignore */
          }
        }
      })

      audio.onended = () => {
        setNowPlaying(null)
        currentTrackRef.current = null
        resetAmbientVolume()
      }

      currentTrackRef.current = audio
      setNowPlaying(item)

      if (ambientRef.current) {
        ambientRef.current.volume = 0.04
      }

      audio.play().catch(() => {
        setSelectedItem({
          ...item,
          error:
            `Adicione o arquivo em /public/${item.audio} para tocar esta música.`
        })
      })
    }
  }

  function resetExperience() {
    stopCurrentTrack()

    if (ambientRef.current) {
      ambientRef.current.pause()
      ambientRef.current.currentTime = 0
    }

    setScene('world')
    setPortalActive(false)
    setTreeUnlocked(false)
    setActiveCategoryId(null)
    setSelectedItem(null)
    setVisited([])
    setNowPlaying(null)
  }

  const sceneClass = `${nightMode ? 'theme-night' : 'theme-day'} app-root`

  return (
    <div className={sceneClass} style={{ '--progress': progress }}>
      <BackgroundCosmos progress={progress} />

      {scene === 'world' && (
        <section className="scene scene-world">
          <div className="world-copy">
            <span className="eyebrow">nosso universo</span>
            <h1>{centerProfile.projectName}</h1>
            <p>
              Um espaço aberto, delicado e vivo. A casa é a entrada. O resto vai
              nascer conforme a pessoa explora.
            </p>
          </div>

          <div className="world-stage">
            <div className="world-map-shell">
              <div className="world-map-glow" />
              <div className="world-map-grid" />
              <div className="world-island">
                <div className="house-orbit" />
                <button className="house-core-button" onClick={handleEnterPortal}>
                  <span className="house-roof" />
                  <span className="house-body" />
                  <span className="house-door" />
                </button>
              </div>

              <div className="world-caption">
                <span>clique na casa para entrar</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {portalActive && <PortalOverlay />}

      {scene === 'core' && (
        <section className="scene scene-core">
          <TopBar
            nightMode={nightMode}
            setNightMode={setNightMode}
            ambientEnabled={ambientEnabled}
            toggleAmbient={toggleAmbient}
            resetExperience={resetExperience}
          />

          <div className="core-stage">
            <svg className="constellation-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              {treeUnlocked &&
                categoryNodes.map((category) => (
                  <line
                    key={`line-center-${category.id}`}
                    x1="50"
                    y1="50"
                    x2={category.x}
                    y2={category.y}
                    className={`line-main ${OWNER_META[category.owner].className} ${
                      activeCategoryId === category.id ? 'is-active' : ''
                    }`}
                  />
                ))}

              {treeUnlocked &&
                itemNodes.map((item) => (
                  <line
                    key={`line-item-${item.id}`}
                    x1={activeCategory?.x}
                    y1={activeCategory?.y}
                    x2={item.x}
                    y2={item.y}
                    className={`line-child ${OWNER_META[item.owner].className} show-line`}
                  />
                ))}
            </svg>

            <div className="center-wrapper">
              <button
                className={`center-heart-card ${treeUnlocked ? 'is-open' : ''}`}
                onClick={handleUnlockTree}
              >
                <div className="center-photo-shell">
                  <div className="center-photo-placeholder">
                    <span>{centerProfile.nameLeft}</span>
                    <div className="photo-divider-heart">❤</div>
                    <span>{centerProfile.nameRight}</span>
                  </div>
                </div>

                <div className="name-line">
                  <span>{centerProfile.nameLeft}</span>
                  <span className="heart-pulse">❤</span>
                  <span>{centerProfile.nameRight}</span>
                </div>

                <p className="center-quote">{centerProfile.quote}</p>

                {!treeUnlocked && (
                  <span className="center-hint">{centerProfile.introHint}</span>
                )}
              </button>
            </div>

            {treeUnlocked &&
              categoryNodes.map((category) => (
                <button
                  key={category.id}
                  className={`constellation-node category-node ${
                    OWNER_META[category.owner].className
                  } ${activeCategoryId === category.id ? 'active' : ''}`}
                  style={{
                    left: `${category.x}%`,
                    top: `${category.y}%`
                  }}
                  onClick={() => handleCategoryClick(category)}
                >
                  <span className="node-symbol">{category.icon}</span>
                  <span className="node-label">{category.label}</span>
                </button>
              ))}

            {treeUnlocked &&
              itemNodes.map((item) => (
                <button
                  key={item.id}
                  className={`constellation-node item-node ${
                    OWNER_META[item.owner].className
                  } ${selectedItem?.id === item.id ? 'active' : ''}`}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`
                  }}
                  onClick={() => handleItemClick(item)}
                >
                  <span className="node-mini-badge">{item.type}</span>
                  <span className="node-label">{item.label}</span>
                </button>
              ))}

            {treeUnlocked && (
              <div className="progress-card">
                <span className="progress-caption">mundo desbloqueado</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <strong>{Math.round(progress * 100)}%</strong>
              </div>
            )}

            {treeUnlocked && activeCategory && (
              <div className="category-description">
                <span className={`badge ${OWNER_META[activeCategory.owner].className}`}>
                  {OWNER_META[activeCategory.owner].badge}
                </span>
                <h2>{activeCategory.label}</h2>
                <p>{activeCategory.description}</p>
              </div>
            )}

            {selectedItem && (
              <DetailPanel
                item={selectedItem}
                ownerMeta={OWNER_META[selectedItem.owner]}
              />
            )}

            {nowPlaying && (
              <div className="now-playing">
                <span className="now-label">tocando agora</span>
                <strong>{nowPlaying.label}</strong>
                <small>{OWNER_META[nowPlaying.owner].label}</small>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function TopBar({ nightMode, setNightMode, ambientEnabled, toggleAmbient, resetExperience }) {
  return (
    <div className="top-bar">
      <div className="brand-chip">constelação interativa</div>

      <div className="top-actions">
        <button className="ghost-btn" onClick={() => setNightMode((prev) => !prev)}>
          {nightMode ? 'modo dia' : 'modo noturno'}
        </button>
        <button className="ghost-btn" onClick={toggleAmbient}>
          {ambientEnabled ? 'som ambiente on' : 'som ambiente off'}
        </button>
        <button className="ghost-btn accent" onClick={resetExperience}>
          recomeçar
        </button>
      </div>
    </div>
  )
}

function DetailPanel({ item, ownerMeta }) {
  const showImage =
    item.type === 'image' && typeof item.image === 'string' && item.image.length > 0

  return (
    <div className="detail-panel">
      <div className="detail-head">
        <span className={`badge ${ownerMeta.className}`}>{ownerMeta.badge}</span>
        <span className="detail-type">{item.type}</span>
      </div>

      <h3>{item.label}</h3>
      <p>{item.note}</p>

      {showImage && (
        <div className="detail-image-placeholder">
          <div className="detail-image-glow" />
          <span>{item.image}</span>
        </div>
      )}

      {item.type === 'music' && (
        <div className="detail-music-tip">
          Clique novamente na mesma música para parar.
        </div>
      )}

      {item.error && <div className="detail-error">{item.error}</div>}
    </div>
  )
}

function PortalOverlay() {
  return (
    <div className="portal-overlay">
      <div className="portal-vignette" />
      <div className="portal-ring outer" />
      <div className="portal-ring inner" />
      <div className="portal-core" />
    </div>
  )
}

function BackgroundCosmos({ progress }) {
  const stars = useMemo(() => {
    const amount = 36 + Math.round(progress * 32)
    return Array.from({ length: amount }).map((_, index) => ({
      id: index,
      left: `${(index * 13.7) % 100}%`,
      top: `${(index * 19.3) % 100}%`,
      delay: `${(index * 0.18) % 5}s`,
      size: `${1 + ((index * 7) % 3)}px`
    }))
  }, [progress])

  return (
    <div className="cosmos">
      <div className="fog fog-1" />
      <div className="fog fog-2" />
      <div className="glow-orb orb-a" />
      <div className="glow-orb orb-b" />
      <div className="glow-orb orb-c" />

      {stars.map((star) => (
        <span
          key={star.id}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: star.delay
          }}
        />
      ))}
    </div>
  )
}
