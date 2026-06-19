const readerScriptUrl = document.currentScript ? document.currentScript.src : ''

const READER_SETTINGS_KEY = 'bookhub-reader-settings'
const LEGACY_THEME_KEY = 'flax-theme'
const LEGACY_UI_MODE_KEY = 'flax-ui-mode'

const THEME_OPTIONS = ['light', 'dark', 'sepia', 'high-contrast']
const UI_MODE_OPTIONS = ['classic', 'modern']

const FONT_SCALE_MAP = {
  sm: '0.92',
  md: '1',
  lg: '1.12',
  xl: '1.24',
}

const WIDTH_MAP = {
  narrow: '60ch',
  standard: '72ch',
  wide: '84ch',
}

const LINE_HEIGHT_MAP = {
  compact: '1.5',
  standard: '1.7',
  relaxed: '1.95',
}

const PARAGRAPH_SPACING_MAP = {
  compact: '0.95em',
  standard: '1.25em',
  relaxed: '1.7em',
}

const normalizeText = value => `${value || ''}`.replace(/\s+/g, ' ').trim()

const normalizeForSearch = value => normalizeText(value).toLowerCase()

const escapeHtml = value =>
  `${value || ''}`.replace(/[&<>"']/g, character => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entities[character]
  })

const getReaderRootPath = () => {
  const { pathname } = window.location
  const previewMatch = pathname.match(/^\/preview\/[^/]+\/[^/]+\/?/)
  const bookMatch = pathname.match(/^\/books\/[^/]+\/?/)
  const root = previewMatch ? previewMatch[0] : bookMatch ? bookMatch[0] : '/'

  return root.endsWith('/') ? root : `${root}/`
}

const getReaderRootUrl = () => new URL(getReaderRootPath(), window.location.origin)

const getSearchStorageKey = () => `bookhub-reader-search:${getReaderRootPath()}`

const getSystemTheme = () =>
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'

const getDefaultReaderSettings = () => ({
  theme: getSystemTheme(),
  fontSize: 'md',
  readingWidth: 'standard',
  lineHeight: 'standard',
  paragraphSpacing: 'standard',
  justifyText: true,
  hideWatermark: false,
  uiMode: 'modern',
})

const validateOption = (value, options, fallback) =>
  options.includes(value) ? value : fallback

const validateBoolean = (value, fallback) =>
  typeof value === 'boolean' ? value : fallback

const resolveReaderSettings = value => {
  const defaults = getDefaultReaderSettings()
  const settings = value || {}

  return {
    theme: validateOption(settings.theme, THEME_OPTIONS, defaults.theme),
    fontSize: validateOption(settings.fontSize, Object.keys(FONT_SCALE_MAP), defaults.fontSize),
    readingWidth: validateOption(
      settings.readingWidth,
      Object.keys(WIDTH_MAP),
      defaults.readingWidth,
    ),
    lineHeight: validateOption(
      settings.lineHeight,
      Object.keys(LINE_HEIGHT_MAP),
      defaults.lineHeight,
    ),
    paragraphSpacing: validateOption(
      settings.paragraphSpacing,
      Object.keys(PARAGRAPH_SPACING_MAP),
      defaults.paragraphSpacing,
    ),
    justifyText: validateBoolean(settings.justifyText, defaults.justifyText),
    hideWatermark: validateBoolean(settings.hideWatermark, defaults.hideWatermark),
    uiMode: validateOption(settings.uiMode, UI_MODE_OPTIONS, defaults.uiMode),
  }
}

const readStoredReaderSettings = () => {
  let parsed = null

  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY)
    parsed = raw ? JSON.parse(raw) : null
  } catch (error) {}

  let legacyTheme = null
  let legacyUiMode = null

  try {
    legacyTheme = localStorage.getItem(LEGACY_THEME_KEY)
    legacyUiMode = localStorage.getItem(LEGACY_UI_MODE_KEY)
  } catch (error) {}

  return resolveReaderSettings({
    ...(parsed || {}),
    theme: parsed?.theme || legacyTheme,
    uiMode: parsed?.uiMode || legacyUiMode,
  })
}

let currentReaderSettings = readStoredReaderSettings()

const updateThemeToggleLabel = settings => {
  const themeToggle = document.querySelector('#theme-toggle')
  if (!themeToggle) return

  const nextTheme = settings.theme === 'dark' ? 'light' : 'dark'
  const nextLabel = nextTheme === 'dark' ? 'dark mode' : 'light mode'
  themeToggle.setAttribute('aria-label', `Switch to ${nextLabel}`)
  themeToggle.setAttribute('title', `Switch to ${nextLabel}`)
}

const syncUiModeButtons = settings => {
  document.querySelectorAll('[data-ui-mode]').forEach(button => {
    const selected = button.getAttribute('data-ui-mode') === settings.uiMode
    button.setAttribute('aria-selected', selected ? 'true' : 'false')
  })
}

const syncSettingsControls = settings => {
  document.querySelectorAll('[data-setting]').forEach(control => {
    const key = control.getAttribute('data-setting')
    if (!key || !(key in settings)) return

    if (control.type === 'checkbox') {
      control.checked = !!settings[key]
    } else {
      control.value = settings[key]
    }
  })

  syncUiModeButtons(settings)
  updateThemeToggleLabel(settings)
}

const applyReaderSettings = settings => {
  const root = document.documentElement
  root.classList.remove(
    'theme-light',
    'theme-dark',
    'theme-sepia',
    'theme-high-contrast',
    'ui-classic',
    'ui-modern',
  )

  root.classList.add(
    settings.theme === 'high-contrast'
      ? 'theme-high-contrast'
      : `theme-${settings.theme}`,
  )
  root.classList.add(settings.uiMode === 'classic' ? 'ui-classic' : 'ui-modern')

  root.dataset.justifyText = settings.justifyText ? 'on' : 'off'
  root.dataset.hideWatermark = settings.hideWatermark ? 'on' : 'off'

  root.style.setProperty('--reader-font-scale', FONT_SCALE_MAP[settings.fontSize])
  root.style.setProperty('--reader-content-width', WIDTH_MAP[settings.readingWidth])
  root.style.setProperty('--reader-line-height', LINE_HEIGHT_MAP[settings.lineHeight])
  root.style.setProperty(
    '--reader-paragraph-spacing',
    PARAGRAPH_SPACING_MAP[settings.paragraphSpacing],
  )

  syncSettingsControls(settings)
}

const persistReaderSettings = settings => {
  currentReaderSettings = resolveReaderSettings(settings)

  try {
    localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(currentReaderSettings))
    localStorage.setItem(LEGACY_THEME_KEY, currentReaderSettings.theme)
    localStorage.setItem(LEGACY_UI_MODE_KEY, currentReaderSettings.uiMode)
  } catch (error) {}

  applyReaderSettings(currentReaderSettings)
}

const updateReaderSettings = partialSettings => {
  persistReaderSettings({
    ...currentReaderSettings,
    ...partialSettings,
  })
}

const resetReaderSettings = () => {
  persistReaderSettings(getDefaultReaderSettings())
}

const readSearchState = () => {
  try {
    const raw = sessionStorage.getItem(getSearchStorageKey())
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    return null
  }
}

const saveSearchState = (query, active = true) => {
  try {
    sessionStorage.setItem(
      getSearchStorageKey(),
      JSON.stringify({ query: normalizeText(query), active }),
    )
  } catch (error) {}
}

const clearSearchState = () => {
  try {
    sessionStorage.removeItem(getSearchStorageKey())
  } catch (error) {}
}

const getSearchIndexUrl = () => {
  if (readerScriptUrl) {
    return new URL('../search-index.json', readerScriptUrl).href
  }

  return new URL('search-index.json', getReaderRootUrl()).href
}

let searchIndexPromise

const loadSearchIndex = () => {
  if (!searchIndexPromise) {
    searchIndexPromise = fetch(getSearchIndexUrl(), { cache: 'no-cache' }).then(
      response => {
        if (!response.ok) {
          const error = new Error('Search index unavailable')
          error.status = response.status
          throw error
        }

        return response.json()
      },
    )
  }

  return searchIndexPromise
}

const getResultHref = page => new URL(page.url || '', getReaderRootUrl()).href

const findSearchMatches = (index, query) => {
  const normalizedQuery = normalizeForSearch(query)
  if (!normalizedQuery) return []

  const terms = normalizedQuery.split(' ').filter(Boolean)
  const pages = Array.isArray(index.pages) ? index.pages : []

  return pages
    .map(page => {
      const title = normalizeText(page.title)
      const text = normalizeText(page.text)
      const searchable = normalizeForSearch(`${title} ${text}`)
      const titleSearchable = normalizeForSearch(title)
      const exactMatch = searchable.includes(normalizedQuery)
      const termsMatch = terms.every(term => searchable.includes(term))

      if (!exactMatch && !termsMatch) return null

      let score = 0
      if (titleSearchable.includes(normalizedQuery)) score += 40
      if (exactMatch) score += 20
      score += terms.filter(term => titleSearchable.includes(term)).length * 4
      score += terms.filter(term => searchable.includes(term)).length

      return {
        ...page,
        title,
        text,
        score,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

const highlightText = (text, query) => {
  const value = `${text || ''}`
  const cleanQuery = normalizeText(query)
  if (!value || !cleanQuery) return escapeHtml(value)

  const lowerValue = value.toLowerCase()
  const lowerQuery = cleanQuery.toLowerCase()
  let output = ''
  let position = 0
  let index = lowerValue.indexOf(lowerQuery)

  while (index !== -1) {
    output += escapeHtml(value.slice(position, index))
    output += `<mark>${escapeHtml(value.slice(index, index + cleanQuery.length))}</mark>`
    position = index + cleanQuery.length
    index = lowerValue.indexOf(lowerQuery, position)
  }

  output += escapeHtml(value.slice(position))
  return output
}

const createSnippet = (page, query) => {
  const source = normalizeText(`${page.title}. ${page.text}`)
  if (!source) return ''

  const normalizedQuery = normalizeForSearch(query)
  const terms = normalizedQuery.split(' ').filter(Boolean)
  const lowerSource = source.toLowerCase()
  let index = lowerSource.indexOf(normalizedQuery)
  let highlightQuery = normalizeText(query)

  if (index === -1) {
    const firstMatchingTerm = terms.find(term => lowerSource.includes(term))
    if (firstMatchingTerm) {
      index = lowerSource.indexOf(firstMatchingTerm)
      highlightQuery = firstMatchingTerm
    }
  }

  if (index === -1) index = 0

  const radius = 90
  const start = Math.max(0, index - radius)
  const end = Math.min(
    source.length,
    index + normalizeText(highlightQuery).length + radius,
  )
  const prefix = start > 0 ? '... ' : ''
  const suffix = end < source.length ? ' ...' : ''

  return `${prefix}${highlightText(source.slice(start, end), highlightQuery)}${suffix}`
}

const getSearchElements = container => {
  const panel = container.querySelector('[data-panel="search"]')
  if (!panel) return null

  return {
    panel,
    form: panel.querySelector('.book-search-form'),
    input: panel.querySelector('.book-search-input'),
    clearButton: panel.querySelector('.book-search-clear'),
    status: panel.querySelector('.book-search-status'),
    count: panel.querySelector('.book-search-count'),
    results: panel.querySelector('.book-search-results'),
  }
}

const setSearchStatus = (elements, message, type = '') => {
  if (!elements?.status) return

  elements.status.textContent = message
  elements.status.hidden = !message
  elements.status.dataset.status = type
}

const resetSearchUi = (elements, message) => {
  if (!elements) return

  if (elements.input) elements.input.value = ''
  if (elements.count) {
    elements.count.textContent = ''
    elements.count.hidden = true
  }
  if (elements.results) elements.results.innerHTML = ''

  setSearchStatus(
    elements,
    message || 'Type a word or phrase to search across this book.',
  )
}

const resetSearchInContainer = container => {
  const elements = getSearchElements(container)
  resetSearchUi(elements)
}

const renderSearchResults = (elements, matches, query) => {
  if (!elements?.results) return

  if (elements.count) {
    elements.count.hidden = false
    elements.count.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'} found`
  }

  if (!matches.length) {
    elements.results.innerHTML = ''
    setSearchStatus(elements, 'No matching pages found.', 'empty')
    return
  }

  setSearchStatus(elements, '')
  elements.results.innerHTML = matches
    .map(page => {
      const href = getResultHref(page)
      const type =
        page.type === 'copyright'
          ? 'Copyright'
          : page.type === 'title'
            ? 'Title page'
            : 'Chapter'

      return `
        <article class="book-search-result" role="listitem">
          <a href="${escapeHtml(href)}" class="book-search-result__link" data-search-result-link>
            <span class="book-search-result__type">${escapeHtml(type)}</span>
            <span class="book-search-result__title">${escapeHtml(page.title || 'Untitled')}</span>
            <span class="book-search-result__snippet">${createSnippet(page, query)}</span>
          </a>
        </article>
      `
    })
    .join('')
}

const performBookSearch = async (elements, query, options = {}) => {
  const cleanQuery = normalizeText(query)

  if (!elements) return

  if (elements.input && elements.input.value !== cleanQuery) {
    elements.input.value = cleanQuery
  }

  if (!cleanQuery) {
    clearSearchState()
    resetSearchUi(elements)
    return
  }

  if (!options.preserveState) {
    saveSearchState(cleanQuery, true)
  }

  if (elements.results) elements.results.innerHTML = ''
  if (elements.count) elements.count.hidden = true
  setSearchStatus(elements, 'Searching...', 'loading')

  try {
    const index = await loadSearchIndex()
    const matches = findSearchMatches(index, cleanQuery)
    renderSearchResults(elements, matches, cleanQuery)
  } catch (error) {
    const message =
      error.status === 404
        ? 'Search is unavailable until this book is republished.'
        : 'Search could not load. Please try again.'

    if (elements.count) elements.count.hidden = true
    if (elements.results) elements.results.innerHTML = ''
    setSearchStatus(elements, message, 'error')
  }
}

const getSettingsElements = container => {
  const panel = container.querySelector('[data-panel="settings"]')
  if (!panel) return null

  return {
    panel,
    controls: panel.querySelectorAll('[data-setting]'),
    resetButton: panel.querySelector('.reader-settings-reset'),
    status: panel.querySelector('.reader-settings-status'),
  }
}

const setSettingsStatus = (elements, message) => {
  if (!elements?.status) return

  elements.status.textContent = message
  elements.status.hidden = !message
}

const bindSettingsPanel = container => {
  const elements = getSettingsElements(container)
  if (!elements) return

  elements.controls.forEach(control => {
    control.addEventListener('change', event => {
      const key = event.currentTarget.getAttribute('data-setting')
      if (!key) return

      const value =
        event.currentTarget.type === 'checkbox'
          ? event.currentTarget.checked
          : event.currentTarget.value

      updateReaderSettings({ [key]: value })
      setSettingsStatus(elements, '')
    })
  })

  if (elements.resetButton) {
    elements.resetButton.addEventListener('click', () => {
      resetReaderSettings()
      setSettingsStatus(elements, 'Settings restored.')
    })
  }

  syncSettingsControls(currentReaderSettings)
}

window.onload = () => {
  applyReaderSettings(currentReaderSettings)

  const sidebar = document.querySelector('#sidebar')
  const sidebarToggle = sidebar
    ? sidebar.querySelector('button[aria-controls="sidebar"]')
    : null

  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener('click', event => {
      sidebar.classList.toggle('collapsed')
      event.currentTarget.setAttribute(
        'aria-expanded',
        `${event.currentTarget.getAttribute('aria-expanded') === 'false'}`,
      )
    })
  }

  const collapseMobileTOC = () => {
    if (window.innerWidth < 800 && sidebar && sidebarToggle) {
      sidebar.classList.add('collapsed')
      sidebarToggle.setAttribute('aria-expanded', 'false')
    }
  }

  collapseMobileTOC()
  window.addEventListener('resize', collapseMobileTOC)

  const bindMenu = container => {
    if (!container) return

    const rootPanel = container.querySelector('[data-panel="root"]')
    const panels = container.querySelectorAll('.menu-panel')

    const showPanel = (target, options = {}) => {
      if (target !== 'search' && !options.preserveSearch) {
        clearSearchState()
        resetSearchInContainer(container)
      }

      panels.forEach(panel => {
        if (panel.dataset.panel === target) {
          panel.classList.add('is-active')
          panel.classList.remove('is-left')
        } else {
          panel.classList.remove('is-active')
          panel.classList.add('is-left')
        }
      })

      if (rootPanel && target === 'root') {
        rootPanel.classList.remove('is-left')
      }
    }

    container.querySelectorAll('[data-target]').forEach(button => {
      button.addEventListener('click', event => {
        const target = event.currentTarget.getAttribute('data-target')
        if (target) showPanel(target)
      })
    })

    const sharePanel = container.querySelector('[data-panel="share"]')
    const shareDetailPanel = container.querySelector('[data-panel="share-detail"]')
    if (sharePanel && shareDetailPanel) {
      const scopeButtons = sharePanel.querySelectorAll('[data-share-scope-target]')
      const actionButtons = shareDetailPanel.querySelectorAll('[data-share-action]')
      const shareUrlInput = shareDetailPanel.querySelector('.share-url')
      const shareStatus = shareDetailPanel.querySelector('.share-status')
      const shareTitleLabel = shareDetailPanel.querySelector('.share-detail-title')
      const shareTitleNode = document.querySelector('header h1')
      const shareTitle = (shareTitleNode && shareTitleNode.textContent.trim()) || document.title
      const current = { scope: 'page' }

      const getShareTargets = () => {
        const { origin, pathname, search, hash } = window.location
        const pageUrl = `${origin}${pathname}${search}${hash}`
        const match = pathname.match(/^\/books\/[^/]+\/?/)
        let bookPath = match ? match[0] : pathname

        if (!bookPath.endsWith('/')) {
          bookPath = `${bookPath}/`
        }

        return {
          pageUrl,
          bookUrl: `${origin}${bookPath}`,
        }
      }

      const getActiveUrl = () => {
        const { pageUrl, bookUrl } = getShareTargets()
        return current.scope === 'book' ? bookUrl : pageUrl
      }

      const setStatus = message => {
        if (!shareStatus) return
        shareStatus.textContent = message
        shareStatus.hidden = !message
      }

      const refreshScopeUI = () => {
        if (shareUrlInput) {
          shareUrlInput.value = getActiveUrl()
        }

        if (shareTitleLabel) {
          shareTitleLabel.textContent =
            current.scope === 'book' ? 'Share entire book' : 'Share this page'
        }
      }

      const openShareLink = url => {
        const win = window.open(url, '_blank', 'noopener,noreferrer')
        if (!win) {
          window.location.href = url
        }
      }

      scopeButtons.forEach(button => {
        button.addEventListener('click', event => {
          const scope = event.currentTarget.getAttribute('data-share-scope-target')
          current.scope = scope === 'book' ? 'book' : 'page'
          setStatus('')
          refreshScopeUI()
          showPanel('share-detail')
        })
      })

      actionButtons.forEach(button => {
        button.addEventListener('click', async event => {
          const action = event.currentTarget.getAttribute('data-share-action')
          const url = getActiveUrl()
          const text =
            current.scope === 'book'
              ? 'Check out this book on Bookhub'
              : 'Check out this page on Bookhub'

          if (action === 'copy') {
            try {
              await navigator.clipboard.writeText(url)
              setStatus('Link copied')
            } catch (error) {
              setStatus('Could not copy link')
            }
            return
          }

          if (action === 'native') {
            if (navigator.share) {
              try {
                await navigator.share({ title: shareTitle, text, url })
                setStatus('Shared')
              } catch (error) {
                setStatus('')
              }
            } else {
              setStatus('Native sharing not available on this device')
            }
            return
          }

          const encodedUrl = encodeURIComponent(url)
          const encodedText = encodeURIComponent(text)
          const encodedTitle = encodeURIComponent(shareTitle)

          const routes = {
            whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
            x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
            telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
            email: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
          }

          const targetUrl = routes[action]
          if (!targetUrl) {
            setStatus('Feature coming soon')
            return
          }

          openShareLink(targetUrl)
          setStatus('')
        })
      })

      refreshScopeUI()
    }

    container
      .querySelectorAll('.menu-back:not([data-target])')
      .forEach(button => button.addEventListener('click', () => showPanel('root')))

    const searchElements = getSearchElements(container)
    if (searchElements?.form && searchElements.input) {
      let searchTimer

      searchElements.form.addEventListener('submit', event => {
        event.preventDefault()
        performBookSearch(searchElements, searchElements.input.value)
      })

      searchElements.input.addEventListener('input', event => {
        window.clearTimeout(searchTimer)
        const query = event.currentTarget.value

        if (!normalizeText(query)) {
          clearSearchState()
          resetSearchUi(searchElements)
          return
        }

        searchTimer = window.setTimeout(() => {
          performBookSearch(searchElements, query)
        }, 180)
      })

      if (searchElements.clearButton) {
        searchElements.clearButton.addEventListener('click', () => {
          clearSearchState()
          resetSearchUi(searchElements)
          searchElements.input.focus()
        })
      }

      if (searchElements.results) {
        searchElements.results.addEventListener('click', event => {
          const link = event.target.closest('[data-search-result-link]')
          if (!link) return
          saveSearchState(searchElements.input.value, true)
        })
      }

      const storedSearch = readSearchState()
      if (storedSearch?.active && storedSearch.query) {
        searchElements.input.value = storedSearch.query
        showPanel('search', { preserveSearch: true })
        performBookSearch(searchElements, storedSearch.query, {
          preserveState: true,
        })
      } else {
        resetSearchUi(searchElements)
      }
    }

    const chapterSearchInput = container.querySelector('.chapter-search-input')
    const chapterList = container.querySelector('.chapter-list')
    if (chapterSearchInput && chapterList) {
      chapterSearchInput.addEventListener('input', event => {
        const query = event.currentTarget.value.trim().toLowerCase()
        chapterList.querySelectorAll('li').forEach(item => {
          const links = item.querySelectorAll('a')
          if (!links.length) return

          const match = Array.from(links).some(link =>
            link.textContent.toLowerCase().includes(query),
          )

          item.style.display = query === '' || match ? '' : 'none'
        })
      })
    }

    bindSettingsPanel(container)
  }

  bindMenu(document)

  const themeToggle = document.querySelector('#theme-toggle')
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = currentReaderSettings.theme === 'dark' ? 'light' : 'dark'
      updateReaderSettings({ theme: nextTheme })
    })
  }

  document.querySelectorAll('[data-ui-mode]').forEach(button => {
    button.addEventListener('click', event => {
      const uiMode = event.currentTarget.getAttribute('data-ui-mode')
      if (!uiMode) return
      updateReaderSettings({ uiMode })
    })
  })

  const mobileMenuButton = document.querySelector('.mobile-menu-button')
  const menuModal = document.querySelector('.menu-modal')
  const menuModalContent = document.querySelector('.menu-modal__content')
  const menuModalClose = document.querySelector('.menu-modal__close')
  const menuBackdrop = document.querySelector('.menu-modal__backdrop')

  const openMenuModal = () => {
    if (!menuModal || !menuModalContent) return

    const menu = document.querySelector('.menu')
    if (menu) {
      menuModalContent.innerHTML = ''
      menuModalContent.appendChild(menu.cloneNode(true))
      bindMenu(menuModalContent)
      syncSettingsControls(currentReaderSettings)
    }

    menuModal.classList.add('open')
    menuModal.setAttribute('aria-hidden', 'false')
  }

  const closeMenuModal = () => {
    if (!menuModal) return
    menuModal.classList.remove('open')
    menuModal.setAttribute('aria-hidden', 'true')
  }

  if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', openMenuModal)
  }
  if (menuModalClose) {
    menuModalClose.addEventListener('click', closeMenuModal)
  }
  if (menuBackdrop) {
    menuBackdrop.addEventListener('click', closeMenuModal)
  }
}
