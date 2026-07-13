import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { useMutation, useQuery } from '@apollo/client'
import { th } from '@coko/client'
import { Form, Button, Checkbox, Input, Select } from '../../common'
import { GET_ENTIRE_BOOK, UPDATE_BOOK_POD_METADATA } from '../../../graphql'
import {
  buildContributorAuthorString,
  contributorListsMatch,
  CONTRIBUTION_TYPE_OPTIONS,
  CONTRIBUTOR_ROLE_OPTIONS,
  isValidOrcid,
  mergeSharedContributors,
} from '../metadata/BookMetadataForm'

const Panel = styled.section`
  background: ${th('colorBackground')};
  border: 1px solid ${th('colorBorder')};
  border-radius: 8px;
  margin-block-start: 16px;
  padding: 16px;

  h2 {
    font-size: 18px;
    margin-block: 0 8px;
  }
`

const Hint = styled.p`
  color: ${th('colorTextPlaceholder')};
  margin: 0 0 16px;
`

const ContributorGrid = styled.div`
  display: grid;
  gap: 12px;
`

const ContributorCard = styled.div`
  border: 1px solid ${th('colorBorder')};
  border-radius: 8px;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  padding: 12px;

  > * {
    min-width: 0;
  }
`

const CardFooter = styled.div`
  align-items: end;
  display: flex;
  gap: 12px;
  grid-column: 1 / -1;
  justify-content: space-between;

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
  }
`

const SourceText = styled.div`
  color: ${th('colorTextPlaceholder')};
  font-size: 12px;
  grid-column: 1 / -1;
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-block-start: 12px;
`

const toNullable = value => value || null

const contributorInput = item => ({
  sourceUserId: item?.sourceUserId || '',
  email: item?.email || '',
  firstName: item?.firstName || '',
  fullName: item?.fullName || '',
  lastName: item?.lastName || '',
  role: item?.role || '',
  title: item?.title || '',
  orcid: item?.orcid || '',
  website: item?.website || '',
  contributionType: item?.contributionType || '',
  contributionOrdinal:
    Number.isInteger(Number(item?.contributionOrdinal)) &&
    Number(item.contributionOrdinal) > 0
      ? Number(item.contributionOrdinal)
      : null,
  thothContributorId: item?.thothContributorId || '',
  thothContributionId: item?.thothContributionId || '',
  thothSyncedAt: item?.thothSyncedAt || '',
  mainContribution: item?.mainContribution === true,
  includeInThoth: item?.includeInThoth !== false,
})

const buildPodMetadataInput = (podMetadata, contributors) => ({
  authors: buildContributorAuthorString(contributors) || podMetadata?.authors || null,
  bottomPage: toNullable(podMetadata?.bottomPage),
  contributors: contributors.map(contributorInput),
  copyrightLicense: toNullable(podMetadata?.copyrightLicense),
  derivableMetadata: (podMetadata?.derivableMetadata || []).map(item => ({
    key: item?.key || '',
    sourceFormat: toNullable(item?.sourceFormat),
    profileId: toNullable(item?.profileId),
    value:
      Number.isInteger(Number(item?.value)) && Number(item.value) >= 0
        ? Number(item.value)
        : null,
    updatedAt: toNullable(item?.updatedAt),
    syncOnPublish: item?.syncOnPublish !== false,
  })),
  languages: (podMetadata?.languages || []).map(item => ({
    code: item?.code || '',
    label: toNullable(item?.label),
    relation: item?.relation || 'ORIGINAL',
  })),
  isbns: (podMetadata?.isbns || []).map(item => ({
    isbn: item?.isbn || '',
    label: item?.label || '',
  })),
  licenseTypes: podMetadata?.licenseTypes
    ? {
        NC: !!podMetadata.licenseTypes.NC,
        SA: !!podMetadata.licenseTypes.SA,
        ND: !!podMetadata.licenseTypes.ND,
      }
    : null,
  ncCopyrightHolder: toNullable(podMetadata?.ncCopyrightHolder),
  ncCopyrightYear: toNullable(podMetadata?.ncCopyrightYear),
  publicDomainType: toNullable(podMetadata?.publicDomainType),
  saCopyrightHolder: toNullable(podMetadata?.saCopyrightHolder),
  saCopyrightYear: toNullable(podMetadata?.saCopyrightYear),
  topPage: toNullable(podMetadata?.topPage),
})

const ShareContributorPanel = ({ bookId, bookTeams, canChangeMetadata }) => {
  const [form] = Form.useForm()
  const [status, setStatus] = useState('')

  const { data, loading } = useQuery(GET_ENTIRE_BOOK, {
    skip: !bookId,
    variables: { id: bookId },
  })

  const [updatePODMetadata, { loading: saving }] = useMutation(
    UPDATE_BOOK_POD_METADATA,
    {
      refetchQueries: [{ query: GET_ENTIRE_BOOK, variables: { id: bookId } }],
    },
  )

  const bookLoaded = !!data?.getBook && !loading


  const podMetadata = data?.getBook?.podMetadata || {}
  const storedContributors = podMetadata.contributors || []

  const mergedContributors = useMemo(
    () => mergeSharedContributors(storedContributors, bookTeams),
    [storedContributors, bookTeams],
  )

  const saveContributors = async contributors => {
    if (!bookLoaded) {
      return
    }

    const normalized = mergeSharedContributors(contributors, bookTeams)

    try {
      setStatus('')

      await updatePODMetadata({
        variables: {
          bookId,
          metadata: buildPodMetadataInput(podMetadata, normalized),
        },
      })

      setStatus('Contributor metadata saved.')
    } catch (error) {
      setStatus(error.message || 'Unable to save contributor metadata.')
    }
  }

  useEffect(() => {
    if (!bookLoaded) {
      return
    }

    form.setFieldsValue({ contributors: mergedContributors })

    if (
      canChangeMetadata &&
      !contributorListsMatch(mergedContributors, storedContributors)
    ) {
      saveContributors(mergedContributors).catch(error => {
        setStatus(error.message || 'Unable to auto-save contributors.')
      })
    }
  }, [mergedContributors, canChangeMetadata, bookLoaded])

  const handleSyncFromShare = () => {
    const current = form.getFieldValue('contributors') || []
    const next = mergeSharedContributors(current, bookTeams)
    form.setFieldsValue({ contributors: next })
    return saveContributors(next)
  }

  const handleSubmit = values => saveContributors(values.contributors || [])

  return (
    <Panel>
      <h2>Contributor metadata</h2>
      <Hint>
        Shared users are automatically added here, then you can enrich their
        contributor role, ORCID, title, and Thoth contribution type.
      </Hint>

      <Form form={form} initialValues={{ contributors: mergedContributors }} onFinish={handleSubmit}>
        <Form.List name="contributors">
          {fields => (
            <ContributorGrid>
              {fields.map(field => (
                <ContributorCard key={field.key}>
                  <Form.Item label="Full name" labelCol={{ span: 24 }} name={[field.name, 'fullName']}>
                    <Input disabled={!canChangeMetadata || loading} />
                  </Form.Item>
                  <Form.Item label="Role" labelCol={{ span: 24 }} name={[field.name, 'role']}>
                    <Select disabled={!canChangeMetadata || loading} options={CONTRIBUTOR_ROLE_OPTIONS} />
                  </Form.Item>
                  <Form.Item label="Title / position" labelCol={{ span: 24 }} name={[field.name, 'title']}>
                    <Input disabled={!canChangeMetadata || loading} placeholder="Designer, proofreader, editor" />
                  </Form.Item>
                  <Form.Item label="Thoth type" labelCol={{ span: 24 }} name={[field.name, 'contributionType']}>
                    <Select disabled={!canChangeMetadata || loading} options={CONTRIBUTION_TYPE_OPTIONS} />
                  </Form.Item>
                  <Form.Item label="Order" labelCol={{ span: 24 }} name={[field.name, 'contributionOrdinal']}>
                    <Input disabled={!canChangeMetadata || loading} min="1" type="number" />
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
                                new Error('Use an ORCID like 0000-0002-1825-0097'),
                              ),
                      },
                    ]}
                  >
                    <Input disabled={!canChangeMetadata || loading} placeholder="0000-0002-1825-0097" />
                  </Form.Item>
                  <Form.Item hidden name={[field.name, 'sourceUserId']}>
                    <Input />
                  </Form.Item>
                  <Form.Item hidden name={[field.name, 'email']}>
                    <Input />
                  </Form.Item>
                  <Form.Item hidden name={[field.name, 'thothContributorId']}>
                    <Input />
                  </Form.Item>
                  <Form.Item hidden name={[field.name, 'thothContributionId']}>
                    <Input />
                  </Form.Item>
                  <Form.Item hidden name={[field.name, 'thothSyncedAt']}>
                    <Input />
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const contributor = form.getFieldValue(['contributors', field.name])
                      return contributor?.email || contributor?.sourceUserId ? (
                        <SourceText>
                          From share list{contributor?.email ? ` - ${contributor.email}` : ''}
                        </SourceText>
                      ) : null
                    }}
                  </Form.Item>
                  <CardFooter>
                    <Form.Item
                      label="Main contribution"
                      labelCol={{ span: 24 }}
                      name={[field.name, 'mainContribution']}
                      valuePropName="checked"
                    >
                      <Checkbox disabled={!canChangeMetadata || loading} />
                    </Form.Item>
                    <Form.Item
                      label="Send to Thoth"
                      labelCol={{ span: 24 }}
                      name={[field.name, 'includeInThoth']}
                      valuePropName="checked"
                    >
                      <Checkbox disabled={!canChangeMetadata || loading} />
                    </Form.Item>
                  </CardFooter>
                </ContributorCard>
              ))}
            </ContributorGrid>
          )}
        </Form.List>

        <Actions>
          <Button disabled={!canChangeMetadata || !bookLoaded || saving} htmlType="button" onClick={handleSyncFromShare}>
            Sync from share list
          </Button>
          <Button disabled={!canChangeMetadata || !bookLoaded || saving} htmlType="submit" type="primary">
            Save contributor metadata
          </Button>
        </Actions>
      </Form>
      {status ? <Hint>{status}</Hint> : null}
    </Panel>
  )
}

ShareContributorPanel.propTypes = {
  bookId: PropTypes.string.isRequired,
  bookTeams: PropTypes.arrayOf(
    PropTypes.shape({
      role: PropTypes.string,
      members: PropTypes.arrayOf(PropTypes.shape({})),
    }),
  ),
  canChangeMetadata: PropTypes.bool.isRequired,
}

ShareContributorPanel.defaultProps = {
  bookTeams: [],
}

export default ShareContributorPanel
