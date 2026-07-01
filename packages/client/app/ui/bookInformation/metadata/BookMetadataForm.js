import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { isEmpty } from 'lodash'
import { th } from '@coko/client'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import mapValues from 'lodash/mapValues'
import { DatePicker, Form, Upload, Image } from 'antd'
import { Box, Center, Input, TextArea } from '../../common'
import CopyrightLicenseInput from './CopyrightLicenseInput'
import ISBNList from './ISBNList'
import ThothMetadataPanel from './ThothMetadataPanel'

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

const StyledDatePicker = styled(DatePicker)`
  width: 100%;
`

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
  const [form] = Form.useForm()

  const { t } = useTranslation(null, {
    keyPrefix: 'pages.producer.bookMetadataTab',
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

  const [previewValues, setPreviewValues] = useState(transformedInitialValues)

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

  const handleFormUpdate = () => {
    setTimeout(() => {
      const currentValues = form.getFieldsValue(true)
      const derived = resolveDerivedMetadata(currentValues)

      if (
        currentValues.license !== derived.license ||
        currentValues.copyrightHolder !== derived.copyrightHolder
      ) {
        form.setFieldsValue(derived)
      }

      setPreviewValues({
        ...currentValues,
        ...derived,
        coverUrl,
      })

      form
        .validateFields()
        .then(values => {
          onSubmitBookMetadata({
            ...values,
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
    authors: PropTypes.string.isRequired,
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

