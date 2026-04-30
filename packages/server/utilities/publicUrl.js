const normalizeUrl = (originalUrl, override) => {
  if (!override || !originalUrl) {
    return originalUrl
  }

  try {
    const source = new URL(originalUrl)
    const target = new URL(override)
    const basePath = target.pathname.endsWith('/')
      ? target.pathname.slice(0, -1)
      : target.pathname

    let relativePath = source.pathname

    if (
      basePath &&
      basePath !== '/' &&
      relativePath.toLowerCase().startsWith(basePath.toLowerCase())
    ) {
      relativePath = relativePath.slice(basePath.length) || '/'
    }

    target.pathname = `${basePath}${relativePath}`
    target.search = source.search
    target.hash = source.hash

    return target.toString()
  } catch (error) {
    return originalUrl
  }
}

const getPublicFileUrl = url =>
  normalizeUrl(url, process.env.FILE_STORAGE_PUBLIC_URL)

const getPublicPreviewUrl = url =>
  normalizeUrl(url, process.env.PAGEDJS_PUBLIC_URL)

module.exports = {
  getPublicFileUrl,
  getPublicPreviewUrl,
  normalizeUrl,
}
