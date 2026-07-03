import React, { useEffect, useMemo, useState } from 'react'
import { useLazyQuery, useQuery } from '@apollo/client'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import styled from 'styled-components'

import {
  BACK_ADMIN_THOTH_STATUS,
  BACK_ADMIN_THOTH_WORK,
  BACK_ADMIN_THOTH_WORKS,
} from '../../graphql'

const SectionTitle = styled(Typography.Title)`
  margin: 0 !important;
`

const ScrollSection = styled.div`
  margin-bottom: 24px;
`

const formatDateTime = value => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

const renderMaybeLink = value => {
  if (!value) return <Typography.Text type="secondary">-</Typography.Text>

  return (
    <Typography.Link href={value} target="_blank" rel="noreferrer">
      {value}
    </Typography.Link>
  )
}

const ThothBrowserPanel = ({ sessionToken }) => {
  const [environment, setEnvironment] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [publisherOnly, setPublisherOnly] = useState(false)
  const [syncedOnly, setSyncedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedWorkId, setSelectedWorkId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const {
    data: statusData,
    loading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery(BACK_ADMIN_THOTH_STATUS, {
    variables: { sessionToken },
    fetchPolicy: 'network-only',
  })

  const environments = statusData?.backAdminThothStatus?.environments || []
  const defaultEnvironment = statusData?.backAdminThothStatus?.defaultEnvironment || null

  useEffect(() => {
    if (!environment && defaultEnvironment) {
      setEnvironment(defaultEnvironment)
      return
    }

    if (
      environment &&
      environments.length &&
      !environments.some(item => item.key === environment)
    ) {
      setEnvironment(defaultEnvironment || environments[0]?.key || null)
    }
  }, [defaultEnvironment, environment, environments])

  const selectedEnvironment = useMemo(
    () => environments.find(item => item.key === environment) || null,
    [environment, environments],
  )

  const {
    data: worksData,
    loading: worksLoading,
    error: worksError,
    refetch: refetchWorks,
  } = useQuery(BACK_ADMIN_THOTH_WORKS, {
    variables: {
      sessionToken,
      environment,
      search,
      publisherOnly,
      syncedOnly,
      page,
      pageSize,
    },
    skip: !environment,
    fetchPolicy: 'network-only',
  })

  const [loadWork, { data: workData, loading: workLoading, error: workError }] =
    useLazyQuery(BACK_ADMIN_THOTH_WORK, {
      fetchPolicy: 'network-only',
    })

  const handleRefresh = () => {
    refetchStatus()
    if (environment) {
      refetchWorks()
    }
    if (drawerOpen && selectedWorkId) {
      loadWork({
        variables: {
          sessionToken,
          environment,
          workId: selectedWorkId,
        },
      })
    }
  }

  const handleOpenWork = workId => {
    setSelectedWorkId(workId)
    setDrawerOpen(true)
    loadWork({
      variables: {
        sessionToken,
        environment,
        workId,
      },
    })
  }

  const handleSearch = value => {
    setPage(1)
    setSearch(value.trim())
  }

  const handleFilterChange = updater => {
    setPage(1)
    updater()
  }

  const worksResult = worksData?.backAdminThothWorks || {
    totalCount: 0,
    items: [],
    page: 1,
    pageSize,
  }

  const rows = worksResult.items || []
  const detail = workData?.backAdminThothWork || null

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Link onClick={() => handleOpenWork(row.workId)}>
            {value}
          </Typography.Link>
          {row.subtitle ? (
            <Typography.Text type="secondary">{row.subtitle}</Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'DOI',
      dataIndex: 'doi',
      key: 'doi',
      render: value => renderMaybeLink(value),
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: value => value || '-',
    },
    {
      title: 'Publisher / Imprint',
      key: 'publisher',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{row.publisherName || '-'}</Typography.Text>
          <Typography.Text type="secondary">{row.imprintName || '-'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Published',
      dataIndex: 'publicationDate',
      key: 'publicationDate',
      render: value => value || '-',
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: value => formatDateTime(value),
    },
    {
      title: 'Flags',
      key: 'flags',
      render: (_, row) => (
        <Space wrap>
          {row.isBookHubPublisher ? <Tag color="blue">BookHub publisher</Tag> : null}
          {row.isBookHubSynced ? <Tag color="green">BookHub synced</Tag> : null}
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Col>
          <SectionTitle level={4}>Thoth Metadata Browser</SectionTitle>
          <Typography.Text type="secondary">
            Read-only browser for the Thoth catalogue through the Back Office.
          </Typography.Text>
        </Col>
        <Col>
          <Button onClick={handleRefresh}>Refresh</Button>
        </Col>
      </Row>

      {statusError ? (
        <Alert
          type="error"
          showIcon
          message="Unable to load Thoth browser status"
          description={statusError.message}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card loading={statusLoading}>
            <Statistic
              title="Environment"
              value={selectedEnvironment?.label || 'Not selected'}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={statusLoading}>
            <Statistic title="Current result count" value={worksResult.totalCount || 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={statusLoading}>
            <Statistic
              title="Connection"
              value={selectedEnvironment?.ok ? 'Connected' : 'Check required'}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space
          direction="vertical"
          size="middle"
          style={{ width: '100%' }}
        >
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">Environment</Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={environment}
                options={environments.map(item => ({
                  value: item.key,
                  label: item.label,
                }))}
                onChange={value => {
                  setEnvironment(value)
                  setPage(1)
                  setDrawerOpen(false)
                  setSelectedWorkId(null)
                }}
                placeholder="Select environment"
              />
            </Col>
            <Col xs={24} md={10}>
              <Typography.Text type="secondary">Search</Typography.Text>
              <Input.Search
                allowClear
                value={searchInput}
                placeholder="Search title, DOI, or reference"
                onChange={e => setSearchInput(e.target.value)}
                onSearch={handleSearch}
              />
            </Col>
            <Col xs={24} md={6}>
              <Typography.Text type="secondary">Current endpoint</Typography.Text>
              <div>
                <Typography.Text copyable>
                  {selectedEnvironment?.endpoint || '-'}
                </Typography.Text>
              </div>
            </Col>
          </Row>

          <Space wrap>
            <Checkbox
              checked={publisherOnly}
              onChange={e =>
                handleFilterChange(() => setPublisherOnly(e.target.checked))
              }
            >
              BookHub publisher only
            </Checkbox>
            <Checkbox
              checked={syncedOnly}
              onChange={e =>
                handleFilterChange(() => setSyncedOnly(e.target.checked))
              }
            >
              BookHub-synced only
            </Checkbox>
          </Space>

          {selectedEnvironment ? (
            <Alert
              type={selectedEnvironment.ok ? 'success' : 'warning'}
              showIcon
              message={`${selectedEnvironment.label} environment`}
              description={
                <>
                  <div>{selectedEnvironment.message}</div>
                  <div>
                    Publisher: {selectedEnvironment.publisherName || selectedEnvironment.publisherId}
                  </div>
                  <div>
                    Imprint: {selectedEnvironment.imprintName || selectedEnvironment.imprintId}
                  </div>
                </>
              }
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message="No environment selected"
              description="Select a Thoth environment to load records."
            />
          )}
        </Space>
      </Card>

      {worksError ? (
        <Alert
          type="error"
          showIcon
          message="Unable to load Thoth works"
          description={worksError.message}
        />
      ) : null}

      <Card title="Records">
        <Table
          columns={columns}
          dataSource={rows}
          loading={worksLoading}
          rowKey="workId"
          locale={{
            emptyText: (
              <Empty description={environment ? 'No Thoth records found.' : 'Select an environment first.'} />
            ),
          }}
          pagination={{
            current: worksResult.page || page,
            pageSize: worksResult.pageSize || pageSize,
            total: worksResult.totalCount || 0,
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
          }}
          onRow={record => ({
            onClick: () => handleOpenWork(record.workId),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Drawer
        title={detail?.title || 'Thoth work detail'}
        placement="right"
        width={760}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        {workError ? (
          <Alert
            type="error"
            showIcon
            message="Unable to load work details"
            description={workError.message}
          />
        ) : null}

        {workLoading && !detail ? <Typography.Text>Loading record…</Typography.Text> : null}

        {detail ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ScrollSection>
              <SectionTitle level={5}>Core metadata</SectionTitle>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Title">{detail.title}</Descriptions.Item>
                <Descriptions.Item label="Subtitle">{detail.subtitle || '-'}</Descriptions.Item>
                <Descriptions.Item label="DOI">{renderMaybeLink(detail.doi)}</Descriptions.Item>
                <Descriptions.Item label="Reference">{detail.reference || '-'}</Descriptions.Item>
                <Descriptions.Item label="Landing page">
                  {renderMaybeLink(detail.landingPage)}
                </Descriptions.Item>
                <Descriptions.Item label="Publisher">
                  {detail.publisherName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Imprint">{detail.imprintName || '-'}</Descriptions.Item>
                <Descriptions.Item label="Publication date">
                  {detail.publicationDate || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Updated">
                  {formatDateTime(detail.updatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Work type">{detail.workType}</Descriptions.Item>
                <Descriptions.Item label="Work status">{detail.workStatus}</Descriptions.Item>
                <Descriptions.Item label="Edition">{detail.edition || '-'}</Descriptions.Item>
                <Descriptions.Item label="License">
                  {renderMaybeLink(detail.license)}
                </Descriptions.Item>
                <Descriptions.Item label="Copyright holder">
                  {detail.copyrightHolder || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="General note">
                  {detail.generalNote || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Cover caption">
                  {detail.coverCaption || '-'}
                </Descriptions.Item>
              </Descriptions>
            </ScrollSection>

            <ScrollSection>
              <SectionTitle level={5}>Contributors</SectionTitle>
              <Table
                size="small"
                pagination={false}
                rowKey="contributionId"
                dataSource={detail.contributors}
                locale={{ emptyText: 'No contributors on this record.' }}
                columns={[
                  { title: 'Name', dataIndex: 'fullName', key: 'fullName' },
                  {
                    title: 'Role',
                    dataIndex: 'contributionType',
                    key: 'contributionType',
                  },
                  {
                    title: 'Order',
                    dataIndex: 'contributionOrdinal',
                    key: 'contributionOrdinal',
                  },
                  {
                    title: 'Main',
                    dataIndex: 'mainContribution',
                    key: 'mainContribution',
                    render: value => (value ? 'Yes' : 'No'),
                  },
                ]}
              />
            </ScrollSection>

            <ScrollSection>
              <SectionTitle level={5}>Publications and locations</SectionTitle>
              {(detail.publications || []).length ? (
                detail.publications.map(publication => (
                  <Card
                    key={publication.publicationId}
                    size="small"
                    style={{ marginBottom: 16 }}
                    title={`${publication.publicationType}${publication.isbn ? ` - ${publication.isbn}` : ''}`}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Typography.Text type="secondary">
                        Updated: {formatDateTime(publication.updatedAt)}
                      </Typography.Text>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="locationId"
                        dataSource={publication.locations}
                        locale={{ emptyText: 'No locations for this publication.' }}
                        columns={[
                          {
                            title: 'Platform',
                            dataIndex: 'locationPlatform',
                            key: 'locationPlatform',
                          },
                          {
                            title: 'Landing page',
                            dataIndex: 'landingPage',
                            key: 'landingPage',
                            render: value => renderMaybeLink(value),
                          },
                          {
                            title: 'Full text URL',
                            dataIndex: 'fullTextUrl',
                            key: 'fullTextUrl',
                            render: value => renderMaybeLink(value),
                          },
                          {
                            title: 'Canonical',
                            dataIndex: 'canonical',
                            key: 'canonical',
                            render: value => (value ? 'Yes' : 'No'),
                          },
                        ]}
                      />
                    </Space>
                  </Card>
                ))
              ) : (
                <Empty description="No publications on this record." />
              )}
            </ScrollSection>

            <ScrollSection>
              <SectionTitle level={5}>Additional metadata</SectionTitle>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Page count">{detail.pageCount || '-'}</Descriptions.Item>
                <Descriptions.Item label="Page breakdown">
                  {detail.pageBreakdown || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Image count">{detail.imageCount || '-'}</Descriptions.Item>
                <Descriptions.Item label="Table count">{detail.tableCount || '-'}</Descriptions.Item>
                <Descriptions.Item label="Audio count">{detail.audioCount || '-'}</Descriptions.Item>
                <Descriptions.Item label="Video count">{detail.videoCount || '-'}</Descriptions.Item>
                <Descriptions.Item label="First page">{detail.firstPage || '-'}</Descriptions.Item>
                <Descriptions.Item label="Last page">{detail.lastPage || '-'}</Descriptions.Item>
                <Descriptions.Item label="Page interval">
                  {detail.pageInterval || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="LCCN">{detail.lccn || '-'}</Descriptions.Item>
                <Descriptions.Item label="OCLC">{detail.oclc || '-'}</Descriptions.Item>
                <Descriptions.Item label="Languages">
                  {(detail.languages || []).length
                    ? detail.languages
                        .map(item => `${item.languageCode} (${item.languageRelation})`)
                        .join(', ')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Subjects">
                  {(detail.subjects || []).length
                    ? detail.subjects
                        .map(item => `${item.subjectType}: ${item.subjectCode}`)
                        .join(', ')
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
            </ScrollSection>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  )
}

ThothBrowserPanel.propTypes = {
  sessionToken: PropTypes.string.isRequired,
}

export default ThothBrowserPanel
