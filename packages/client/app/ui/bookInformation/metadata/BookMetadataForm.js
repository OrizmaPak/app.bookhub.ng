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
  grid-template-columns: minmax(280px, 0.9fr) minmax(360px, 1.35fr);

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`

const MetadataColumn = styled.div`
  display: grid;
  gap: 20px;
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

const SectionHint = styled.p`
  color: ${th('colorTextPlaceholder')};
  margin: -6px 0 16px;
`

const InlineMeta = styled.div`
  color: ${th('colorTextPlaceholder')};
  font-size: 12px;
  margin-top: 4px;
`

const DERIVABLE_METADATA_FIELDS = [
  { key: 'pageCount', label: 'Page count', formats: ['pdf'] },
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
].map(value => ({
  label: value,
  value,
}))

const buildContributorAuthorString = contributors =>
  (contributors || [])
    .map(item => item?.fullName?.trim())
    .filter(Boolean)
    .join(', ')

const normalizeContributors = contributors =>
  (contributors || []).map(item => ({
    fullName: item?.fullName || '',
    role: item?.role || '',
    title: item?.title || '',
    orcid: item?.orcid || '',
    includeInThoth: item?.includeInThoth !== false,
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

const BookMetadataForm = ({
  initialValues,
  onSubmitBookMetadata,
  canChangeMetadata,
  onUploadBookCover,
  className,
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

          <MetadataGrid>
            <MetadataColumn>
              <FormSection>
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

              <FormSection>
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
              </FormSection>

              <FormSection>
                <h2>Contributors</h2>
                <SectionHint>
                  Capture structured contributor metadata here. The author string
                  above is auto-filled from these entries when available.
                </SectionHint>
                <Form.List name="contributors">
                  {(fields, { add, remove }) => (
                    <FieldsetGrid>
                      {fields.map(field => (
                        <RepeaterRow key={field.key}>
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
                          <RowActions>
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
                          </RowActions>
                        </RepeaterRow>
                      ))}
                      <Button
                        disabled={!canChangeMetadata}
                        icon={<PlusOutlined />}
                        onClick={() =>
                          add({
                            fullName: '',
                            role: '',
                            title: '',
                            orcid: '',
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

            <MetadataColumn>
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

            <FullWidthSection>
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

            <ThothSection>
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
        fullName: PropTypes.string,
        role: PropTypes.string,
        title: PropTypes.string,
        orcid: PropTypes.string,
        includeInThoth: PropTypes.bool,
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
}

export default BookMetadataForm

