const readerScriptUrl = document.currentScript ? document.currentScript.src : ''

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
  const end = Math.min(source.length, index + normalizeText(highlightQuery).length + radius)
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
  if (!elements || !elements.status) return

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
  if (!elements || !elements.results) return

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
      const type = page.type === 'copyright' ? 'Copyright' : page.type === 'title' ? 'Title page' : 'Chapter'

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

window.onload = () => {
  const sidebar = document.querySelector('#sidebar')
  const sidebarToggle = sidebar
    ? sidebar.querySelector('button[aria-controls="sidebar"]')
    : null

  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener('click', e => {
      sidebar.classList.toggle('collapsed')
      e.currentTarget.setAttribute(
        'aria-expanded',
        e.currentTarget.getAttribute('aria-expanded') === 'false',
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

    const menuButtons = container.querySelectorAll('[data-target]')
    menuButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget.getAttribute('data-target')
        if (target) showPanel(target)
      })
    })

    const comingSoon = container.querySelector('.menu-coming-soon')
    const featureButtons = container.querySelectorAll('[data-menu]')
    featureButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        const feature = e.currentTarget.getAttribute('data-menu')
        if (!comingSoon || !feature) return

        const label = feature.charAt(0).toUpperCase() + feature.slice(1)
        comingSoon.textContent = `${label} feature coming soon`
        comingSoon.hidden = false
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

      const current = {
        scope: 'page',
      }

      const getShareTargets = () => {
        const { origin, pathname, search, hash } = window.location
        const pageUrl = `${origin}${pathname}${search}${hash}`
        const match = pathname.match(/^\/books\/[^/]+\/?/)
        let bookPath = match ? match[0] : pathname

        if (!bookPath.endsWith('/')) {
          bookPath = `${bookPath}/`
        }

        const bookUrl = `${origin}${bookPath}`
        return { pageUrl, bookUrl }
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

      scopeButtons.forEach(btn => {
        btn.addEventListener('click', e => {
          const scope = e.currentTarget.getAttribute('data-share-scope-target')
          current.scope = scope === 'book' ? 'book' : 'page'
          setStatus('')
          refreshScopeUI()
          showPanel('share-detail')
        })
      })

      actionButtons.forEach(btn => {
        btn.addEventListener('click', async e => {
          const action = e.currentTarget.getAttribute('data-share-action')
          const url = getActiveUrl()
          const text =
            current.scope === 'book'
              ? 'Check out this book on Bookhub'
              : 'Check out this page on Bookhub'

          if (action === 'copy') {
            try {
              await navigator.clipboard.writeText(url)
              setStatus('Link copied')
            } catch (err) {
              setStatus('Could not copy link')
            }
            return
          }

          if (action === 'native') {
            if (navigator.share) {
              try {
                await navigator.share({ title: shareTitle, text, url })
                setStatus('Shared')
              } catch (err) {
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

    const backButtons = container.querySelectorAll('.menu-back:not([data-target])')
    backButtons.forEach(btn => {
      btn.addEventListener('click', () => showPanel('root'))
    })

    const searchElements = getSearchElements(container)
    if (searchElements && searchElements.form && searchElements.input) {
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
      }
    }

    const searchInput = container.querySelector('.chapter-search-input')
    const chapterList = container.querySelector('.chapter-list')

    if (searchInput && chapterList) {
      searchInput.addEventListener('input', e => {
        const query = e.currentTarget.value.trim().toLowerCase()
        const items = chapterList.querySelectorAll('li')

        items.forEach(li => {
          const links = li.querySelectorAll('a')
          if (!links.length) return

          let match = false
          links.forEach(a => {
            if (a.textContent.toLowerCase().includes(query)) {
              match = true
            }
          })

          li.style.display = query === '' || match ? '' : 'none'
        })
      })
    }
  }

  bindMenu(document)

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
