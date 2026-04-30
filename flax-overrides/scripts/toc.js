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

    const showPanel = target => {
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

    const backButtons = container.querySelectorAll('.menu-back')
    backButtons.forEach(btn => {
      btn.addEventListener('click', () => showPanel('root'))
    })

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
