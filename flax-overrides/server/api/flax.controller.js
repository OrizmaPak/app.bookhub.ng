const express = require('express')
const path = require('node:path')
const { logger } = require('@coko/server')
const { authenticate } = require('@coko/service-auth')
const { exec } = require('child_process')
const fs = require('node:fs')
const cheerio = require('cheerio')
const multer = require('multer')
const Image = require('@11ty/eleventy-img')
const CleanCSS = require('clean-css')
const BookData = require('../models/bookData/bookData.model')
const BookFiles = require('../models/bookFiles/bookFiles.model')

const { createPartChapterHierarchy, cleanUp } = require('../helpers')

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { bookId, userId } = req.body

    if (!fs.existsSync(`flax/${userId}-${bookId}`)) {
      fs.mkdirSync(`flax/${userId}-${bookId}`)
    }

    if (!fs.existsSync(`flax/${userId}-${bookId}/fonts`)) {
      fs.mkdirSync(`flax/${userId}-${bookId}/fonts`)
    }

    if (!fs.existsSync(`flax/${userId}-${bookId}/styles`)) {
      fs.mkdirSync(`flax/${userId}-${bookId}/styles`)
    }

    if (!fs.existsSync(`flax/${userId}-${bookId}/downloads`)) {
      fs.mkdirSync(`flax/${userId}-${bookId}/downloads`)
    }

    switch (file.fieldname) {
      case 'fonts':
        return cb(null, `./flax/${userId}-${bookId}/fonts`)
      case 'stylesheet':
        return cb(null, `./flax/${userId}-${bookId}/styles`)
      default:
        // pdf or epub files
        return cb(null, `./flax/${userId}-${bookId}/downloads`)
    }
  },

  filename: (_, file, cb) => {
    return file.fieldname === 'stylesheet'
      ? cb(null, `${file.fieldname}${path.extname(file.originalname)}`)
      : cb(null, `${file.originalname}`)
  },
})

const upload = multer({ storage })

const optimizeImages = async chapters => {
  logger.info('creating optimized images')

  return Promise.all(
    chapters.map(async chapter => {
      const $ = cheerio.load(chapter.content)
      const $images = $('img[src]')

      if ($images.length) {
        logger.info(`Found images in chapter ${chapter.title}`)
        await Promise.all(
          $images.map(async (_i, element) => {
            const source = element.attribs?.src
            if (!source) return

            try {
              // generate optimized images with 11ty image plugin
              const metadata = await Image(source, {
                formats: ['webp', 'jpeg'],
                widths: [null, 400, 800],
                urlPath: `/images`,
                outputDir: './flax/images',
                useCache: false,
              })

              const imageAttributes = {
                alt: element.attribs.alt || 'No alt text provided',
                sizes: '400px 800px 100vw',
                loading: 'lazy',
                decoding: 'async',
              }

              const img = Image.generateHTML(metadata, imageAttributes)
              $(`img[src="${source}"]`).replaceWith(img)
            } catch (error) {
              logger.warn(
                `[FLAX publish] skipping image optimization for source "${source}" in chapter "${chapter.title}": ${error.message}`,
              )
            }
          }),
        )

        // return chapter with new modified content
        return {
          ...chapter,
          content: $.html(),
        }
      }

      logger.info(`No images in chapter ${chapter.title}`)
      return chapter
    }),
  )
}

const createDataFiles = async (data, options = {}) => {
  try {
    logger.info(`${data.bookId}: creating the data files...`)
    const bookMetadata = JSON.parse(data.metadata)

    const metadata = {
      id: data.bookId,
      title: data.title,
      subtitle: data.subtitle,
      authors: bookMetadata.authors,
      preview: options.preview,
      includePdf: data.includePdf,
      includeEpub: data.includeEpub,
      copyright: data.copyrightContent,
    }

    switch (bookMetadata.copyrightLicense) {
      case 'CC':
        metadata.copyrightFooterInfo = `© ${bookMetadata.saCopyrightYear.substring(
          0,
          bookMetadata.saCopyrightYear.indexOf('-'),
        )} ${bookMetadata.saCopyrightHolder}, some rights reserved`
        break
      case 'PD':
        metadata.copyrightFooterInfo = `Public domain, no rights reserved`
        break
      case 'SCL':
        metadata.copyrightFooterInfo = `© ${bookMetadata.ncCopyrightYear.substring(
          0,
          bookMetadata.ncCopyrightYear.indexOf('-'),
        )} ${bookMetadata.ncCopyrightHolder}, all rights reserved`
        break
      default:
        break
    }

    let chapters = JSON.parse(data.chapters)

    if (options.downloadImages) {
      // optimize images
      chapters = await optimizeImages(chapters)

      // optimize cover
      if (data.coverUrl) {
        const coverMetadata = await Image(data.coverUrl, {
          formats: ['webp', 'jpeg'],
          widths: [null, 400, 800],
          urlPath: `/images`,
          outputDir: './flax/images',
          useCache: false,
        })

        const coverImageAttributes = {
          alt:
            data.coverAlt ||
            `Cover image for ${data.title}, by ${bookMetadata.authors}`,
          sizes: '400px 800px 100vw',
          loading: 'eager',
          decoding: 'async',
        }

        const coverImage = Image.generateHTML(
          coverMetadata,
          coverImageAttributes,
        )

        metadata.coverImage = coverImage
      }
    } else if (data.coverUrl) {
      metadata.coverImage = `<picture><img src="${data.coverUrl}" alt="${data.coverAlt}" /></picture>`
    }

    // create hierarchical structure for books containing parts
    const structuredChapters = createPartChapterHierarchy(chapters)

    let customParts

    if (data.customHeader || data.customFooter) {
      customParts = {
        header: data.customHeader,
        footer: data.customFooter,
      }
    }

    // create structured chapters data file for navigation
    fs.writeFileSync(
      `flax/_data/chapters.js`,
      `module.exports=${JSON.stringify(structuredChapters)}`,
      { encoding: 'utf8' },
    )

    // save flat chapter structure to generate individual chapter files
    fs.writeFileSync(
      `flax/_data/chapters-flat.js`,
      `module.exports=${JSON.stringify(chapters)}`,
      { encoding: 'utf8' },
    )

    // create metadata file
    fs.writeFileSync(
      'flax/_data/metadata.js',
      `module.exports=${JSON.stringify(metadata)}`,
      { encoding: 'utf8' },
    )

    if (customParts) {
      // create custom parts file
      fs.writeFileSync(
        'flax/_data/customRunningBlocks.js',
        `module.exports=${JSON.stringify(customParts)}`,
        { encoding: 'utf8' },
      )
    }

    // save copy to db
    if (!options.preview) {
      await saveData(chapters, metadata)
    }
  } catch (error) {
    logger.error(error)
    throw new Error(error)
  }
}

const copyAssets = (bookId, userId) => {
  logger.info(`${bookId}: copying assets to the right location...`)
  fs.cpSync(
    `./flax/${userId}-${bookId}/styles/stylesheet.css`,
    './flax/_includes/styles/stylesheet.css',
  )

  fs.cpSync(`flax/${userId}-${bookId}/fonts`, './flax/fonts', {
    recursive: true,
  })

  fs.cpSync(`./flax/${userId}-${bookId}/downloads`, './flax/downloads', {
    recursive: true,
  })
}

const groupByHash = (strings, hashLength) => {
  const groupedObject = strings.reduce((result, str) => {
    const hash = str.substring(0, hashLength - 1).toUpperCase() // Convert to uppercase for case-insensitivity
    // eslint-disable-next-line no-param-reassign
    result[hash] = result[hash] || []
    result[hash].push(str)
    return result
  }, [])

  return Object.keys(groupedObject).map(key => groupedObject[key])
}

const saveData = async (chapters = [], metadata = {}) => {
  try {
    logger.info('saving data for book ', metadata.id)
    // delete previous records
    await BookData.query().delete().where('bookId', metadata.id)
    await BookFiles.query().delete().where('bookId', metadata.id)

    const stylesheet = fs.readFileSync(
      'flax/_includes/styles/stylesheet.css',
      'utf8',
    )

    const minifiedCss = new CleanCSS({}).minify(stylesheet)

    await BookData.insert({
      bookId: metadata.id,
      state: 'published',
      metadata,
      chapters,
      stylesheet: minifiedCss.styles,
    })

    // save fonts
    const fonts = fs.readdirSync('flax/fonts')

    await Promise.all(
      fonts.map(font => {
        const content = fs.readFileSync(`flax/fonts/${font}`, {
          encoding: 'hex',
        })

        return BookFiles.insert({
          bookId: metadata.id,
          filename: font,
          filetype: 'font',
          content: `\\x${content}`,
        })
      }),
    )

    // save images (only the largest jpeg for each gorup)
    const images = fs.readdirSync('flax/images')

    let groupedImages = groupByHash(images, 10)

    // sort images of each group by size
    groupedImages = groupedImages.map(group => {
      group.sort((a, b) => {
        const sizeA = parseInt(a.substring(11, a.lastIndexOf('.')), 10)
        const sizeB = parseInt(b.substring(11, b.lastIndexOf('.')), 10)

        return sizeB - sizeA
      })

      return group
    })

    await Promise.all(
      groupedImages.map(async group => {
        const filename = group[0]

        const content = fs.readFileSync(`flax/images/${filename}`, {
          encoding: 'hex',
        })

        return BookFiles.insert({
          bookId: metadata.id,
          filename,
          filetype: 'image',
          content: `\\x${content}`,
        })
      }),
    )

    // save any downloads
    const docs = fs.readdirSync('flax/downloads')
    await Promise.all(
      docs.map(doc => {
        const content = fs.readFileSync(`flax/downloads/${doc}`, {
          encoding: 'hex',
        })

        const filetype = `${doc.substring(doc.lastIndexOf('.') + 1)}`

        if (filetype === 'pdf' || filetype === 'epub') {
          return BookFiles.insert({
            bookId: metadata.id,
            filename: doc,
            filetype,
            content: `\\x${content}`,
          })
        }

        return null
      }),
    )
  } catch (error) {
    throw new Error(error)
  }
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, output) => (error ? reject(error) : resolve(output)))
  })
}

const buildPreview = async (bookId, userId) => {
  logger.info(`${bookId}: building the preview...`)

  // should run conditionally only if there are any question types that require wax
  await runCommand('node esbuild.config.js')

  const command = `npx @11ty/eleventy --pathprefix="preview/${userId}/${bookId}" --output=public/preview/${userId}/${bookId}`

  return runCommand(command)
}

const publish = async bookId => {
  // should run conditionally only if there are any question types that require wax
  await runCommand('node esbuild.config.js')

  const command = `npx @11ty/eleventy --pathprefix="books/${bookId}" --output=public/books/${bookId}`

  return runCommand(command)
}

const queue = fn => {
  let q = Promise.resolve()

  return (...args) => {
    q = q.then(
      () => fn(...args),
      e => new Error(e),
    )
    return q
  }
}

const buildWebsite = async (data, isPreview = true) => {
  const { bookId, userId } = data

  try {
    if (isPreview) {
      logger.info(`Building preview for book ${bookId}`)

      copyAssets(bookId, userId)

      await createDataFiles(data, { preview: true })

      await buildPreview(bookId, userId)

      cleanUp(bookId, userId)

      return new Promise(resolve => {
        logger.info(`finished building preview for ${data.bookId}`)
        resolve()
      })
    }

    logger.info(`Publishing book with id ${bookId}`)

    copyAssets(bookId, userId)

    await createDataFiles(data, { downloadImages: true })

    // create publish build
    await publish(bookId)

    cleanUp(bookId, userId)

    return new Promise(resolve => {
      logger.info(`published book with id ${data.bookId}`)
      resolve()
    })
  } catch (error) {
    logger.error(error)
    throw new Error(error)
  }
}

const queuedBuildWebsite = queue(buildWebsite)

const endpoints = app => {
  app.use(
    '/',
    (_, res, next) => {
      res.removeHeader('X-Frame-Options')
      res.setHeader('Content-Security-Policy', 'frame-ancestors *')
      next()
    },
    express.static(path.join(__dirname, '../../', 'public')),
  )

  app.get('/info', authenticate, (req, res) => {
    logger.info(req.body)
    return res.status(200).json({
      flax: 'Yoooo',
    })
  })

  app.post(
    '/preview',
    // authenticate,
    // ,
    upload.fields([{ name: 'stylesheet', maxCount: 1 }, { name: 'fonts' }]),
    async (req, res) => {
      try {
        await queuedBuildWebsite(req.body)
        return res.status(200).json({
          preview: true,
        })
      } catch (error) {
        logger.error(error)
        // remove from queue
        await queuedBuildWebsite(null)
        return res.status(500).json({
          preview: false,
        })
      }
    },
  )

  app.post(
    '/publish',
    // authenticate,
    upload.fields([
      { name: 'stylesheet', maxCount: 1 },
      { name: 'fonts' },
      { name: 'pdf', maxCount: 1 },
      { name: 'epub', maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        await queuedBuildWebsite(req.body, false)
        return res.status(200).json({
          published: true,
        })
      } catch (error) {
        logger.error(error)
        // remove from queue
        await queuedBuildWebsite(null)
        return res.status(500).json({
          publshed: false,
        })
      }
    },
  )

  app.post(
    '/unpublish',
    // authenticate,
    upload.fields([{ name: 'stylesheet', maxCount: 1 }, { name: 'fonts' }]),
    async (req, res) => {
      try {
        if (fs.existsSync(`public/books/${req.body.bookId}`)) {
          fs.rmSync(`public/books/${req.body.bookId}`, {
            recursive: true,
            force: true,
          })
        }

        // update state of data in the db so that it doesn't rebuild on service restart
        const bookData = await BookData.findOne({ bookId: req.body.bookId })

        await BookData.patchAndFetchById(bookData.id, {
          state: 'unpublished',
        })

        return res.status(200).json({
          unpublished: true,
        })
      } catch (error) {
        logger.error(error)
        return res.status(500).json({
          unpublished: false,
        })
      }
    },
  )
}

module.exports = endpoints
