import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { isEmpty } from 'lodash'
import { th } from '@coko/client'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import mapValues from 'lodash/mapValues'
import { useQuery } from '@apollo/client'
import { useParams } from 'react-router-dom'
import { DatePicker, Form, Upload, Image } from 'antd'
import {
  Box,
  Button,
  Center,
  Checkbox,
  Input,
  Select,
  TextArea,
} from '../../common'
import CopyrightLicenseInput from './CopyrightLicenseInput'
import ISBNList from './ISBNList'
import ThothMetadataPanel from './ThothMetadataPanel'
import { GET_EXPORT_PROFILES } from '../../../graphql'

const FormSection = styled.div`
  background: ${th('colorBackground')};
  border: 1px solid ${th('colorBorder')};
  border-radius: 8px;
  padding: 20px;

  h2 {
    font-size: 18px;
    margin-block: 0 16px;
  }
`

const MetadataCenter = styled(Center)`
  --max-width: 1180px;
  --s1: 24px;
  box-sizing: border-box;
  padding-block: 24px 40px;
  width: 100%;
`

const MetadataHeader = styled.header`
  margin-block-end: 20px;

  h1 {
    font-size: 28px;
    margin-block: 0 8px;
  }

  p {
    color: ${th('colorTextPlaceholder')};
    margin: 0;
    max-width: 78ch;
  }
`

const MetadataGrid = styled.div`
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: ${({ $singleColumn }) =>
    $singleColumn
      ? '1fr'
      : 'minmax(280px, 0.9fr) minmax(360px, 1.35fr)'};

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`

const MetadataColumn = styled.div`
  display: grid;
  gap: 20px;
`

const MetadataTabNav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-block-end: 20px;
`

const MetadataTabButton = styled.button`
  background: ${props =>
    props.$active ? th('colorPrimary')(props) : th('colorBackground')(props)};
  border: 1px solid ${th('colorBorder')};
  border-radius: 999px;
  color: ${({ $active }) => ($active ? 'white' : 'inherit')};
  cursor: pointer;
  font-weight: 700;
  padding: 8px 14px;

  &:focus {
    outline: 2px solid ${th('colorPrimary')};
    outline-offset: 2px;
  }
`

const ReviewGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`

const ReviewItem = styled.div`
  border: 1px solid ${th('colorBorder')};
  border-radius: 8px;
  min-width: 0;
  padding: 12px;

  strong {
    display: block;
    font-size: 12px;
    margin-block-end: 6px;
    text-transform: uppercase;
  }

  span {
    overflow-wrap: anywhere;
  }
`

const ThothSection = styled.section`
  grid-column: 1 / -1;
`

const FullWidthSection = styled.section`
  grid-column: 1 / -1;
`

const StyledDatePicker = styled(DatePicker)`
  width: 100%;
`

const FieldsetGrid = styled.div`
  display: grid;
  gap: 12px;
`

const RepeaterRow = styled.div`
  align-items: start;
  border: 1px solid ${th('colorBorder')};
  border-radius: 8px;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  padding: 16px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`

const DerivableRow = styled(RepeaterRow)`
  grid-template-columns: minmax(160px, 1.1fr) minmax(120px, 0.9fr) minmax(
      180px,
      1.2fr
    ) minmax(110px, 0.7fr) auto;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`

const RowActions = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;
  height: 100%;
  justify-content: flex-end;
`

const ContributorRow = styled(RepeaterRow)`
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  width: 100%;

  > * {
    min-width: 0;
  }
`

const ContributorActions = styled(RowActions)`
  align-items: end;
  grid-column: 1 / -1;
  height: auto;
  justify-content: space-between;

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
  }
`

const SourceHint = styled.div`
  color: ${th('colorTextPlaceholder')};
  font-size: 12px;
  grid-column: 1 / -1;
`

const SectionHint = styled.p`
  color: ${th('colorTextPlaceholder')};
  margin: -6px 0 16px;
`

const InlineMeta = styled.div`
  color: ${th('colorTextPlaceholder')};
  font-size: 12px;
  margin-top: 4px;
`

const METADATA_TABS = [
  ['book', 'Book info'],
  ['rights', 'Rights'],
  ['contributors', 'Contributors'],
  ['derivable', 'Derivable metadata'],
  ['review', 'Review & Thoth'],
]

const DERIVABLE_METADATA_FIELDS = [
  { key: 'pageCount', label: 'Page count', formats: ['web', 'pdf'] },
  { key: 'imageCount', label: 'Image count', formats: ['web', 'pdf', 'epub'] },
  { key: 'tableCount', label: 'Table count', formats: ['web', 'pdf', 'epub'] },
  { key: 'audioCount', label: 'Audio count', formats: ['web', 'pdf', 'epub'] },
  { key: 'videoCount', label: 'Video count', formats: ['web', 'pdf', 'epub'] },
]

const DEFAULT_DERIVABLE_METADATA = DERIVABLE_METADATA_FIELDS.map(field => ({
  key: field.key,
  sourceFormat: null,
  profileId: null,
  value: null,
  updatedAt: null,
  syncOnPublish: true,
}))

const CONTRIBUTOR_ROLE_OPTIONS = [
  'Author',
  'Co-author',
  'Editor',
  'Managing editor',
  'Proofreader',
  'Designer',
  'Illustrator',
  'Translator',
  'Reviewer',
  'Collaborator',
].map(value => ({
  label: value,
  value,
}))

const CONTRIBUTION_TYPE_OPTIONS = [
  ['AUTHOR', 'Author'],
  ['EDITOR', 'Editor'],
  ['TRANSLATOR', 'Translator'],
  ['PHOTOGRAPHER', 'Photographer'],
  ['ILLUSTRATOR', 'Illustrator'],
  ['MUSIC_EDITOR', 'Music editor'],
  ['FOREWORD_BY', 'Foreword by'],
  ['INTRODUCTION_BY', 'Introduction by'],
  ['AFTERWORD_BY', 'Afterword by'],
  ['PREFACE_BY', 'Preface by'],
  ['SOFTWARE_BY', 'Software by'],
  ['RESEARCH_BY', 'Research by'],
  ['CONTRIBUTIONS_BY', 'Contributions by'],
  ['INDEXER', 'Indexer'],
].map(([value, label]) => ({ label, value }))

const LANGUAGE_OPTIONS = [
  ['ENG', 'English'],
  ['YOR', 'Yoruba'],
  ['HAU', 'Hausa'],
  ['IBO', 'Igbo'],
  ['FRE', 'French'],
  ['ARA', 'Arabic'],
  ['POR', 'Portuguese'],
  ['SPA', 'Spanish'],
  ['GER', 'German'],
  ['ITA', 'Italian'],
  ['SWA', 'Swahili'],
  ['WOL', 'Wolof'],
  ['FUL', 'Fulah'],
  ['ZUL', 'Zulu'],
  ['XHO', 'Xhosa'],
  ['AFR', 'Afrikaans'],
  ['UND', 'Undetermined'],
].map(([value, label]) => ({ label, value }))

const buildContributorAuthorString = contributors =>
  (contributors || [])
    .map(item => item?.fullName?.trim())
    .filter(Boolean)
    .join(', ')

const normalizeContributors = contributors =>
  (contributors || []).map((item, index) => ({
    sourceUserId: item?.sourceUserId || '',
    email: item?.email || '',
    firstName: item?.firstName || '',
    fullName:
      item?.fullName ||
      [item?.firstName, item?.lastName].filter(Boolean).join(' '),
    lastName: item?.lastName || '',
    role: item?.role || '',
    title: item?.title || '',
    orcid: item?.orcid || '',
    website: item?.website || '',
    contributionType: item?.contributionType || 'AUTHOR',
    contributionOrdinal: item?.contributionOrdinal || index + 1,
    mainContribution: item?.mainContribution !== false && index === 0,
    includeInThoth: item?.includeInThoth !== false,
  }))

const contributorKey = contributor => {
  if (contributor?.sourceUserId) return `user:${contributor.sourceUserId}`
  if (contributor?.email) return `email:${String(contributor.email).toLowerCase()}`

  return `name:${String(contributor?.fullName || '').trim().toLowerCase()}`
}

const splitDisplayName = displayName => {
  const parts = String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length <= 1) {
    return { firstName: parts[0] || '', lastName: '' }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  }
}

const formatShareAccess = status => {
  if (status === 'write') return 'Can edit'
  if (status === 'comment') return 'Can comment'
  if (status === 'read') return 'Can read'

  return status || 'Shared user'
}

const CONTRIBUTOR_TEAM_ROLE_PRIORITY = {
  owner: 0,
  author: 1,
  collaborator: 2,
  invitations: 3,
}

const sortContributorTeams = teams =>
  [...(teams || [])].sort(
    (a, b) =>
      (CONTRIBUTOR_TEAM_ROLE_PRIORITY[a?.role] ?? 99) -
      (CONTRIBUTOR_TEAM_ROLE_PRIORITY[b?.role] ?? 99),
  )

const sharedUserToContributor = (member, teamRole, index) => {
  const user = member?.user || {}
  const fullName =
    user.displayName ||
    [user.givenNames, user.surname].filter(Boolean).join(' ') ||
    user.email ||
    ''

  if (!fullName && !user.id) {
    return null
  }

  const { firstName, lastName } = splitDisplayName(fullName)
  const isOwnerTeam = teamRole === 'owner'
  const isAuthorTeam = isOwnerTeam || teamRole === 'author'

  return {
    sourceUserId: user.id || '',
    email: user.email || '',
    firstName: user.givenNames || firstName,
    fullName,
    lastName: user.surname || lastName,
    role: isAuthorTeam ? 'Author' : 'Collaborator',
    title: isOwnerTeam ? 'Book owner' : formatShareAccess(member?.status),
    orcid: '',
    website: '',
    contributionType: isAuthorTeam ? 'AUTHOR' : 'CONTRIBUTIONS_BY',
    contributionOrdinal: index + 1,
    mainContribution: isAuthorTeam && index === 0,
    includeInThoth: true,
  }
}

const mergeSharedContributors = (contributors, bookTeams) => {
  const normalized = normalizeContributors(contributors)
  const existingKeys = new Set(normalized.map(contributorKey).filter(Boolean))
  const additions = []

  sortContributorTeams(bookTeams).forEach(team => {
    const members = Array.isArray(team?.members) ? team.members : []

    members.forEach(member => {
      const candidate = sharedUserToContributor(
        member,
        team?.role,
        normalized.length + additions.length,
      )

      if (!candidate) {
        return
      }

      const key = contributorKey(candidate)

      if (!candidate.fullName || existingKeys.has(key)) {
        return
      }

      existingKeys.add(key)
      additions.push(candidate)
    })
  })

  return normalized.concat(additions)
}

const normalizeLanguages = languages =>
  (languages || []).map(item => ({
    code: item?.code || '',
    label:
      item?.label ||
      LANGUAGE_OPTIONS.find(option => option.value === item?.code)?.label ||
      item?.code ||
      '',
    relation: item?.relation || 'ORIGINAL',
  }))

const normalizeDerivableMetadata = metadata => {
  const byKey = Object.fromEntries((metadata || []).map(item => [item.key, item]))

  return DEFAULT_DERIVABLE_METADATA.map(item => {
    const field = DERIVABLE_METADATA_FIELDS.find(entry => entry.key === item.key)
    const storedValue = byKey[item.key] || {}
    const allowedFormats = field?.formats || ['web', 'pdf', 'epub']
    const sourceFormat = allowedFormats.includes(storedValue.sourceFormat)
      ? storedValue.sourceFormat
      : item.sourceFormat

    return {
      ...item,
      ...storedValue,
      sourceFormat,
      profileId: sourceFormat ? storedValue.profileId : item.profileId,
      value: sourceFormat ? storedValue.value : item.value,
      updatedAt: sourceFormat ? storedValue.updatedAt : item.updatedAt,
    }
  })
}

const isValidOrcid = value => {
  if (!value) {
    return true
  }

  return /^(https:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(
    String(value).trim(),
  )
}

const resolveDerivedMetadata = values => {
  const licenseTypes = values.licenseTypes || {}
  let license = ''
  let copyrightHolder = ''

  if (values.copyrightLicense === 'SCL') {
    license = 'All rights reserved'
    copyrightHolder = values.ncCopyrightHolder || ''
  } else if (values.copyrightLicense === 'PD') {
    license =
      values.publicDomainType === 'cc0'
        ? 'CC0 1.0 Universal'
        : 'Public Domain Mark 1.0'
    copyrightHolder =
      values.saCopyrightHolder || values.ncCopyrightHolder || ''
  } else if (values.copyrightLicense === 'CC') {
    const flags = [
      licenseTypes.NC ? 'NC' : null,
      licenseTypes.ND ? 'ND' : null,
      licenseTypes.SA ? 'SA' : null,
    ].filter(Boolean)

    license = flags.length > 0 ? `CC BY-${flags.join('-')} 4.0` : 'CC BY 4.0'
    copyrightHolder = values.saCopyrightHolder || ''
  }

  return { license, copyrightHolder }
}

const formatReviewValue = value => {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (typeof value?.format === 'function') {
    return value.format('YYYY-MM-DD')
  }

  if (Array.isArray(value)) {
    return value.map(formatReviewValue).filter(Boolean).join(', ')
  }

  return JSON.stringify(value)
}

const BookMetadataForm = ({
  initialValues,
  onSubmitBookMetadata,
  canChangeMetadata,
  onUploadBookCover,
  className,
  bookTeams,
}) => {
  const { bookId } = useParams()
  const [form] = Form.useForm()

  const { t } = useTranslation(null, {
    keyPrefix: 'pages.producer.bookMetadataTab',
  })

  const { data: exportProfilesData } = useQuery(GET_EXPORT_PROFILES, {
    skip: !bookId,
    variables: { bookId },
  })

  const { coverUrl, ...rest } = initialValues

  const transformedInitialValues = mapValues(rest, (value, key) => {
    const dateFields = ['ncCopyrightYear', 'saCopyrightYear', 'publicationDate']
    return dateFields.includes(key) && dayjs(value).isValid()
      ? dayjs(value)
      : value
  })

  if (isEmpty(transformedInitialValues.isbns)) {
    transformedInitialValues.isbns = []
  }

  transformedInitialValues.contributors = normalizeContributors(
    transformedInitialValues.contributors,
  )
  transformedInitialValues.languages = normalizeLanguages(
    transformedInitialValues.languages,
  )
  transformedInitialValues.derivableMetadata = normalizeDerivableMetadata(
    transformedInitialValues.derivableMetadata,
  )
  transformedInitialValues.authors =
    transformedInitialValues.authors ||
    buildContributorAuthorString(transformedInitialValues.contributors)

  const [previewValues, setPreviewValues] = useState(transformedInitialValues)

  const exportProfiles = exportProfilesData?.getBookExportProfiles?.result || []
  const webProfileOptions = exportProfiles
    .filter(profile => !['pdf', 'epub'].includes(profile.format))
    .map(profile => ({
      label: profile.displayName,
      value: profile.id,
    }))
  const pdfProfileOptions = exportProfiles
    .filter(profile => profile.format === 'pdf')
    .map(profile => ({
      label: profile.displayName,
      value: profile.id,
    }))
  const epubProfileOptions = exportProfiles
    .filter(profile => profile.format === 'epub')
    .map(profile => ({
      label: profile.displayName,
      value: profile.id,
    }))

  // useEffect(() => {
  //   if (!isEqual(initialFormValues, transformedInitialValues)) {
  //     form.setFieldsValue(transformedInitialValues)
  //     setInitialFormValues(transformedInitialValues)
  //   }
  // }, [initialValues])

  useEffect(() => {
    if (coverUrl) {
      setCover([
        {
          uid: '-1',
          name: 'cover',
          status: 'done',
          url: coverUrl,
        },
      ])
    }
    setPreviewValues(currentValues => ({
      ...currentValues,
      ...transformedInitialValues,
      coverUrl,
    }))
  }, [coverUrl])

  const [cover, setCover] = useState(
    coverUrl
      ? [
          {
            uid: '-1',
            name: 'cover',
            status: 'done',
            url: coverUrl,
          },
        ]
      : [],
  )

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState('')
  const [activeMetadataTab, setActiveMetadataTab] = useState('book')

  const handleCoverUpload = ({ file }) => {
    if (file.status === 'removed') {
      onUploadBookCover(null)
    } else {
      onUploadBookCover(file).then(({ data: { uploadBookCover } = {} }) => {
        setCover([
          {
            uid: uploadBookCover.cover[0].fileId,
            name: 'cover',
            status: 'done',
            url: uploadBookCover.cover[0].coverUrl,
          },
        ])
      })
    }
  }

  const handlePreview = async file => {
    setPreviewImage(file.url || file.preview)
    setPreviewOpen(true)
  }

  const getAllowedFormatOptionsForMetric = key => {
    const field = DERIVABLE_METADATA_FIELDS.find(item => item.key === key)
    const allowedFormats = field?.formats || ['web', 'pdf', 'epub']

    return [
      { label: 'Web', value: 'web' },
      { label: 'PDF', value: 'pdf' },
      { label: 'EPUB', value: 'epub' },
    ].filter(option => allowedFormats.includes(option.value))
  }

  const getProfileOptionsForFormat = sourceFormat => {
    if (sourceFormat === 'web') {
      return webProfileOptions
    }

    if (sourceFormat === 'pdf') {
      return pdfProfileOptions
    }

    if (sourceFormat === 'epub') {
      return epubProfileOptions
    }

    return []
  }

  const handleFormUpdate = () => {
    setTimeout(() => {
      const currentValues = form.getFieldsValue(true)
      const contributors = normalizeContributors(currentValues.contributors)
      const languages = normalizeLanguages(currentValues.languages)
      const derivableMetadata = normalizeDerivableMetadata(
        currentValues.derivableMetadata,
      )
      const resolvedAuthors =
        currentValues.authors || buildContributorAuthorString(contributors)
      const derived = resolveDerivedMetadata({
        ...currentValues,
        authors: resolvedAuthors,
      })

      if (
        currentValues.authors !== resolvedAuthors ||
        currentValues.license !== derived.license ||
        currentValues.copyrightHolder !== derived.copyrightHolder
      ) {
        form.setFieldsValue({
          authors: resolvedAuthors,
          ...derived,
        })
      }

      setPreviewValues({
        ...currentValues,
        authors: resolvedAuthors,
        contributors,
        languages,
        derivableMetadata,
        ...derived,
        coverUrl,
      })

      form
        .validateFields()
        .then(values => {
          onSubmitBookMetadata({
            ...values,
            authors: resolvedAuthors,
            contributors,
            languages,
            derivableMetadata,
            ...derived,
          })
          // TODO: improvement - post only the fields that have changes
          // const diff = reduce(
          //   values,
          //   function (result, value, key) {
          //     return _.isEqual(value, transformedInitialValues[key])
          //     ? result
          //     : result.concat(key)
          //   },
          //   [],
          // )
        })
        .catch(info => {
          console.error(info)

          console.error('Validate Failed:', info)
        })
    })
  }

  useEffect(() => {
    if (!bookTeams?.length || !canChangeMetadata) {
      return
    }

    const currentContributors = form.getFieldValue('contributors') || []
    const mergedContributors = mergeSharedContributors(
      currentContributors,
      bookTeams,
    )

    if (mergedContributors.length === currentContributors.length) {
      return
    }

    const currentValues = form.getFieldsValue(true)
    const resolvedAuthors =
      currentValues.authors || buildContributorAuthorString(mergedContributors)

    form.setFieldsValue({
      contributors: mergedContributors,
      authors: resolvedAuthors,
    })

    setPreviewValues(values => ({
      ...values,
      contributors: mergedContributors,
      authors: resolvedAuthors,
    }))

    onSubmitBookMetadata({
      ...currentValues,
      contributors: mergedContributors,
      authors: resolvedAuthors,
    })
  }, [bookTeams, canChangeMetadata])

  const reviewContributors = normalizeContributors(previewValues.contributors)
  const reviewLanguages = normalizeLanguages(previewValues.languages)
  const reviewDerivableMetadata = normalizeDerivableMetadata(
    previewValues.derivableMetadata,
  )

  const reviewItems = [
    ['Title', previewValues.title],
    ['Subtitle', previewValues.subtitle],
    ['Authors', previewValues.authors],
    ['Publication date', previewValues.publicationDate],
    ['Copyright holder', previewValues.copyrightHolder],
    ['License', previewValues.license],
    [
      'Languages',
      reviewLanguages
        .map(item => `${item.label || item.code} (${item.code})`)
        .join(', '),
    ],
    [
      'Contributors',
      reviewContributors
        .map(item =>
          [item.fullName, item.role || item.contributionType]
            .filter(Boolean)
            .join(' - '),
        )
        .join('; '),
    ],
    [
      'Derivable metadata',
      reviewDerivableMetadata
        .map(item => `${item.key}: ${item.value ?? 'pending'}`)
        .join('; '),
    ],
  ]

  // if (!initialValues.title) {
  //   return <Spin spinning style={{ display: 'grid', placeContent: 'center' }} />
  // }

  return (
    <Box className={className}>
      <MetadataCenter>
        <Form
          form={form}
          initialValues={transformedInitialValues}
          onValuesChange={handleFormUpdate}
          preserve={false}
        >
          <MetadataHeader>
            <h1>{t('title')}</h1>
            <p>{t('introduction')}</p>
          </MetadataHeader>

          <MetadataTabNav aria-label="Metadata sections">
            {METADATA_TABS.map(([key, label]) => (
              <MetadataTabButton
                $active={activeMetadataTab === key}
                key={key}
                onClick={() => setActiveMetadataTab(key)}
                type="button"
              >
                {label}
              </MetadataTabButton>
            ))}
          </MetadataTabNav>

          <MetadataGrid $singleColumn>
            <MetadataColumn
              style={{
                display: ['book', 'contributors'].includes(activeMetadataTab)
                  ? 'grid'
                  : 'none',
              }}
            >
              <FormSection
                style={{
                  display: activeMetadataTab === 'book' ? undefined : 'none',
                }}
              >
                <h2>{t('sections.coverPage.heading')}</h2>
                <Form.Item
                  label={t('sections.coverPage.upload.instructions')}
                  labelCol={{ span: 24 }}
                  valuePropName="fileList"
                >
                  <Upload
                    accept="image/*"
                    beforeUpload={() => false}
                    disabled={!canChangeMetadata}
                    fileList={cover}
                    listType="picture-card"
                    maxCount={1}
                    onChange={handleCoverUpload}
                    onPreview={handlePreview}
                    onRemove={() => setCover([])}
                  >
                    {cover?.length === 0 ? (
                      <button
                        style={{ border: 0, background: 'none' }}
                        type="button"
                      >
                        <PlusOutlined />
                        <div style={{ marginTop: 8 }}>
                          {t('sections.coverPage.upload.button')}
                        </div>
                      </button>
                    ) : null}
                  </Upload>
                  {previewImage && (
                    <Image
                      preview={{
                        visible: previewOpen,
                        onVisibleChange: visible => setPreviewOpen(visible),
                        afterOpenChange: visible =>
                          !visible && setPreviewImage(''),
                      }}
                      src={previewImage}
                      wrapperStyle={{ display: 'none' }}
                    />
                  )}
                </Form.Item>
                {cover?.length > 0 ? (
                  <Form.Item
                    label={t('sections.coverPage.altText')}
                    labelCol={{ span: 24 }}
                    name="coverAlt"
                  >
                    <Input disabled={!canChangeMetadata} />
                  </Form.Item>
                ) : null}
              </FormSection>

              <FormSection
                style={{
                  display: activeMetadataTab === 'book' ? undefined : 'none',
                }}
              >
                <h2>{t('sections.titlePage.heading')}</h2>
                <Form.Item
                  label={t('sections.titlePage.title')}
                  labelCol={{ span: 24 }}
                  name="title"
                  rules={[
                    {
                      required: true,
                      message: t('sections.titlePage.title.errors.noValue'),
                    },
                  ]}
                  wrapperCol={{ span: 24 }}
                >
                  <Input disabled={!canChangeMetadata} />
                </Form.Item>
                <Form.Item
                  label={t('sections.titlePage.subtitle')}
                  labelCol={{ span: 24 }}
                  name="subtitle"
                  wrapperCol={{ span: 24 }}
                >
                  <Input
                    disabled={!canChangeMetadata}
                    placeholder={t('sections.titlePage.subtitle.placeholder')}
                  />
                </Form.Item>
                <Form.Item
                  label={t('sections.titlePage.authors')}
                  labelCol={{ span: 24 }}
                  name="authors"
                  wrapperCol={{ span: 24 }}
                >
                  <Input
                    disabled={!canChangeMetadata}
                    placeholder={t('sections.titlePage.authors.placeholder')}
                  />
                </Form.Item>
                <Form.Item shouldUpdate>
                  {() => {
                    const selectedLanguages =
                      form.getFieldValue('languages') || []

                    return (
                      <Form.Item
                        label="Used languages"
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                      >
                        <Select
                          disabled={!canChangeMetadata}
                          filterOption={(input, option) =>
                            `${option?.label || ''} ${option?.value || ''}`
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          mode="multiple"
                          onChange={codes => {
                            const nextLanguages = codes.map(code => ({
                              code,
                              label:
                                LANGUAGE_OPTIONS.find(
                                  option => option.value === code,
                                )?.label || code,
                              relation:
                                selectedLanguages.find(
                                  item => item.code === code,
                                )?.relation || 'ORIGINAL',
                            }))

                            form.setFieldsValue({
                              languages: nextLanguages,
                            })
                            handleFormUpdate()
                          }}
                          options={LANGUAGE_OPTIONS}
                          placeholder="Search and select languages"
                          showSearch
                          value={selectedLanguages.map(item => item.code)}
                        />
                      </Form.Item>
                    )
                  }}
                </Form.Item>
              </FormSection>

              <FormSection
                style={{
                  display:
                    activeMetadataTab === 'contributors' ? undefined : 'none',
                }}
              >
                <h2>Contributors</h2>
                <SectionHint>
                  Capture structured contributor metadata here. The author string
                  above is auto-filled from these entries when available.
                </SectionHint>
                <Form.List name="contributors">
                  {(fields, { add, remove }) => (
                    <FieldsetGrid>
                      {fields.map(field => (
                        <ContributorRow key={field.key}>
                          <Form.Item
                            label="Full name"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'fullName']}
                            rules={[
                              {
                                required: true,
                                message: 'Enter a contributor name',
                              },
                            ]}
                          >
                            <Input
                              disabled={!canChangeMetadata}
                              placeholder="Jane Doe"
                            />
                          </Form.Item>
                          <Form.Item
                            label="First name"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'firstName']}
                          >
                            <Input
                              disabled={!canChangeMetadata}
                              placeholder="Jane"
                            />
                          </Form.Item>
                          <Form.Item
                            label="Last name"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'lastName']}
                          >
                            <Input
                              disabled={!canChangeMetadata}
                              placeholder="Doe"
                            />
                          </Form.Item>
                          <Form.Item
                            label="Role"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'role']}
                          >
                            <Select
                              disabled={!canChangeMetadata}
                              options={CONTRIBUTOR_ROLE_OPTIONS}
                              placeholder="Select role"
                            />
                          </Form.Item>
                          <Form.Item
                            label="Title / position"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'title']}
                          >
                            <Input
                              disabled={!canChangeMetadata}
                              placeholder="Lead editor"
                            />
                          </Form.Item>
                          <Form.Item
                            label="Thoth contribution type"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'contributionType']}
                          >
                            <Select
                              disabled={!canChangeMetadata}
                              options={CONTRIBUTION_TYPE_OPTIONS}
                              placeholder="Select Thoth type"
                            />
                          </Form.Item>
                          <Form.Item
                            label="Contribution order"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'contributionOrdinal']}
                          >
                            <Input
                              disabled={!canChangeMetadata}
                              min="1"
                              placeholder="1"
                              type="number"
                            />
                          </Form.Item>
                          <Form.Item
                            label="ORCID"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'orcid']}
                            rules={[
                              {
                                validator: (_, value) =>
                                  isValidOrcid(value)
                                    ? Promise.resolve()
                                    : Promise.reject(
                                        new Error(
                                          'Use an ORCID like 0000-0002-1825-0097',
                                        ),
                                      ),
                              },
                            ]}
                          >
                            <Input
                              disabled={!canChangeMetadata}
                              placeholder="0000-0002-1825-0097"
                            />
                          </Form.Item>
                          <Form.Item
                            label="Website"
                            labelCol={{ span: 24 }}
                            name={[field.name, 'website']}
                          >
                            <Input
                              disabled={!canChangeMetadata}
                              placeholder="https://example.com"
                            />
                          </Form.Item>
                          <ContributorActions>
                            <Form.Item
                              label="Main contribution"
                              labelCol={{ span: 24 }}
                              name={[field.name, 'mainContribution']}
                              valuePropName="checked"
                            >
                              <Checkbox disabled={!canChangeMetadata} />
                            </Form.Item>
                            <Form.Item
                              label="Send to Thoth"
                              labelCol={{ span: 24 }}
                              name={[field.name, 'includeInThoth']}
                              valuePropName="checked"
                            >
                              <Checkbox disabled={!canChangeMetadata} />
                            </Form.Item>
                            <Button
                              disabled={!canChangeMetadata}
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(field.name)}
                            >
                              Remove
                            </Button>
                          </ContributorActions>
                          <Form.Item hidden name={[field.name, 'sourceUserId']}>
                            <Input />
                          </Form.Item>
                          <Form.Item hidden name={[field.name, 'email']}>
                            <Input />
                          </Form.Item>
                          <Form.Item noStyle shouldUpdate>
                            {() => {
                              const contributor = form.getFieldValue([
                                'contributors',
                                field.name,
                              ])

                              return contributor?.email || contributor?.sourceUserId ? (
                                <SourceHint>
                                  Imported from share list
                                  {contributor?.email ? ` - ${contributor.email}` : ''}
                                </SourceHint>
                              ) : null
                            }}
                          </Form.Item>
                        </ContributorRow>
                      ))}
                      <Button
                        disabled={!canChangeMetadata}
                        icon={<PlusOutlined />}
                        onClick={() =>
                          add({
                            firstName: '',
                            fullName: '',
                            lastName: '',
                            role: '',
                            title: '',
                            orcid: '',
                            website: '',
                            contributionType: 'AUTHOR',
                            contributionOrdinal: fields.length + 1,
                            mainContribution: fields.length === 0,
                            sourceUserId: '',
                            email: '',
                            includeInThoth: true,
                          })
                        }
                        type="default"
                      >
                        Add contributor
                      </Button>
                    </FieldsetGrid>
                  )}
                </Form.List>
              </FormSection>
            </MetadataColumn>

            <MetadataColumn
              style={{
                display: activeMetadataTab === 'rights' ? 'grid' : 'none',
              }}
            >
              <FormSection>
                <h2>{t('sections.copyrightPage.heading')}</h2>
                <Form.Item
                  label={t('sections.copyrightPage.isbnList')}
                  labelCol={{ span: 24 }}
                  style={{ marginBottom: '0px' }}
                  wrapperCol={{ span: 24 }}
                >
                  <ISBNList
                    canChangeMetadata={canChangeMetadata}
                    name="isbns"
                  />
                </Form.Item>
                <Form.Item
                  label={t('sections.copyrightPage.license')}
                  labelCol={{ span: 24 }}
                  name="copyrightLicense"
                  wrapperCol={{ span: 24 }}
                >
                  <CopyrightLicenseInput
                    canChangeMetadata={canChangeMetadata}
                  />
                </Form.Item>
                <Form.Item
                  label="Publication date"
                  labelCol={{ span: 24 }}
                  name="publicationDate"
                  wrapperCol={{ span: 24 }}
                >
                  <StyledDatePicker
                    disabled={!canChangeMetadata}
                    format="YYYY-MM-DD"
                  />
                </Form.Item>
                <Form.Item
                  label="Resolved copyright holder"
                  labelCol={{ span: 24 }}
                  name="copyrightHolder"
                  wrapperCol={{ span: 24 }}
                >
                  <Input disabled />
                </Form.Item>
                <Form.Item
                  label="Resolved license"
                  labelCol={{ span: 24 }}
                  name="license"
                  wrapperCol={{ span: 24 }}
                >
                  <Input disabled />
                </Form.Item>
                <Form.Item
                  label={t('sections.copyrightPage.pageContent.top')}
                  labelCol={{ span: 24 }}
                  name="topPage"
                  wrapperCol={{ span: 24 }}
                >
                  <TextArea
                    disabled={!canChangeMetadata}
                    placeholder={t(
                      'sections.copyrightPage.pageContent.top.placeholder',
                    )}
                  />
                </Form.Item>
                <Form.Item
                  label={t('sections.copyrightPage.pageContent.bottom')}
                  labelCol={{ span: 24 }}
                  name="bottomPage"
                  wrapperCol={{ span: 24 }}
                >
                  <TextArea
                    disabled={!canChangeMetadata}
                    placeholder={t(
                      'sections.copyrightPage.pageContent.bottom.placeholder',
                    )}
                  />
                </Form.Item>
              </FormSection>

            </MetadataColumn>

            <FullWidthSection
              style={{
                display: activeMetadataTab === 'derivable' ? 'block' : 'none',
              }}
            >
              <FormSection>
                <h2>Derivable metadata</h2>
                <SectionHint>
                  Bind output metrics to a publishing profile now. The values are
                  stored with the book so we can update them automatically when
                  the linked profile publishes.
                </SectionHint>
                <Form.List name="derivableMetadata">
                  {fields => (
                    <FieldsetGrid>
                      {fields.map(field => {
                        const row = form.getFieldValue([
                          'derivableMetadata',
                          field.name,
                        ])

                        const options = getProfileOptionsForFormat(
                          row?.sourceFormat,
                        )

                        const fieldLabel =
                          DERIVABLE_METADATA_FIELDS.find(
                            item => item.key === row?.key,
                          )?.label || row?.key

                        return (
                          <DerivableRow key={field.key}>
                            <div>
                              <strong>Metric</strong>
                              <div>{fieldLabel}</div>
                              <Form.Item hidden name={[field.name, 'key']}>
                                <Input />
                              </Form.Item>
                            </div>
                            <Form.Item
                              label="Source format"
                              labelCol={{ span: 24 }}
                              name={[field.name, 'sourceFormat']}
                            >
                              <Select
                                disabled={!canChangeMetadata}
                                options={getAllowedFormatOptionsForMetric(
                                  row?.key,
                                )}
                                placeholder="Select format"
                              />
                            </Form.Item>
                            <Form.Item
                              label="Publishing profile"
                              labelCol={{ span: 24 }}
                              name={[field.name, 'profileId']}
                            >
                              <Select
                                disabled={
                                  !canChangeMetadata || !row?.sourceFormat
                                }
                                options={options}
                                placeholder={
                                  row?.sourceFormat
                                    ? 'Select profile'
                                    : 'Choose format first'
                                }
                              />
                            </Form.Item>
                            <Form.Item
                              label="Current value"
                              labelCol={{ span: 24 }}
                              name={[field.name, 'value']}
                            >
                              <Input disabled placeholder="Pending derivation" />
                            </Form.Item>
                            <RowActions>
                              <Form.Item
                                label="Sync on publish"
                                labelCol={{ span: 24 }}
                                name={[field.name, 'syncOnPublish']}
                                valuePropName="checked"
                              >
                                <Checkbox disabled={!canChangeMetadata} />
                              </Form.Item>
                              <InlineMeta>
                                {fieldLabel}
                                {row?.updatedAt
                                  ? ` updated ${dayjs(row.updatedAt).format(
                                      'YYYY-MM-DD',
                                    )}`
                                  : ' awaiting first derivation'}
                              </InlineMeta>
                            </RowActions>
                          </DerivableRow>
                        )
                      })}
                    </FieldsetGrid>
                  )}
                </Form.List>
              </FormSection>
            </FullWidthSection>

            <ThothSection
              style={{
                display: activeMetadataTab === 'review' ? 'block' : 'none',
              }}
            >
              <FormSection>
                <h2>Metadata review</h2>
                <SectionHint>
                  Review the current metadata values before validating or
                  syncing the Thoth payload.
                </SectionHint>
                <ReviewGrid>
                  {reviewItems.map(([label, value]) => (
                    <ReviewItem key={label}>
                      <strong>{label}</strong>
                      <span>{formatReviewValue(value) || 'Not set'}</span>
                    </ReviewItem>
                  ))}
                </ReviewGrid>
              </FormSection>
              <ThothMetadataPanel values={previewValues} />
            </ThothSection>
          </MetadataGrid>
        </Form>
      </MetadataCenter>
    </Box>
  )
}

BookMetadataForm.propTypes = {
  /* eslint-disable-next-line react/forbid-prop-types */
  initialValues: PropTypes.shape({
    coverUrl: PropTypes.string,
    coverAlt: PropTypes.string,
    title: PropTypes.string,
    subtitle: PropTypes.string,
    authors: PropTypes.string,
    contributors: PropTypes.arrayOf(
      PropTypes.shape({
        sourceUserId: PropTypes.string,
        email: PropTypes.string,
        firstName: PropTypes.string,
        fullName: PropTypes.string,
        lastName: PropTypes.string,
        role: PropTypes.string,
        title: PropTypes.string,
        orcid: PropTypes.string,
        website: PropTypes.string,
        contributionType: PropTypes.string,
        contributionOrdinal: PropTypes.number,
        mainContribution: PropTypes.bool,
        includeInThoth: PropTypes.bool,
      }),
    ),
    languages: PropTypes.arrayOf(
      PropTypes.shape({
        code: PropTypes.string,
        label: PropTypes.string,
        relation: PropTypes.string,
      }),
    ),
    derivableMetadata: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string,
        sourceFormat: PropTypes.string,
        profileId: PropTypes.string,
        value: PropTypes.number,
        updatedAt: PropTypes.string,
        syncOnPublish: PropTypes.bool,
      }),
    ),
    isbns: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string,
        isbn: PropTypes.string.isRequired,
      }),
    ).isRequired,
    topPage: PropTypes.string,
    bottomPage: PropTypes.string,
    publicationDate: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({})]),
    copyrightHolder: PropTypes.string,
    license: PropTypes.string,
    copyrightLicense: PropTypes.oneOf(['SCL', 'PD', 'CC', '']),
    ncCopyrightHolder: PropTypes.string,
    ncCopyrightYear: PropTypes.string,
    // ncCopyrightYear: PropTypes.instanceOf(dayjs),
    saCopyrightHolder: PropTypes.string,
    saCopyrightYear: PropTypes.string,

    // saCopyrightYear: PropTypes.instanceOf(dayjs),
    licenseTypes: PropTypes.shape({
      NC: PropTypes.bool,
      SA: PropTypes.bool,
      ND: PropTypes.bool,
    }),
    publicDomainType: PropTypes.oneOf(['cc0', 'public', '']),
  }).isRequired,
  canChangeMetadata: PropTypes.bool.isRequired,
  onSubmitBookMetadata: PropTypes.func.isRequired,
  onUploadBookCover: PropTypes.func.isRequired,
  bookTeams: PropTypes.arrayOf(
    PropTypes.shape({
      role: PropTypes.string,
      members: PropTypes.arrayOf(
        PropTypes.shape({
          status: PropTypes.string,
          user: PropTypes.shape({
            id: PropTypes.string,
            displayName: PropTypes.string,
            givenNames: PropTypes.string,
            surname: PropTypes.string,
            email: PropTypes.string,
          }),
        }),
      ),
    }),
  ),
}

BookMetadataForm.defaultProps = {
  bookTeams: [],
}

export {
  buildContributorAuthorString,
  normalizeContributors,
  mergeSharedContributors,
  CONTRIBUTOR_ROLE_OPTIONS,
  CONTRIBUTION_TYPE_OPTIONS,
  isValidOrcid,
}

export default BookMetadataForm

