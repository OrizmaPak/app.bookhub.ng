import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Alert } from 'antd'
import { useLazyQuery, useMutation } from '@apollo/client'
import { useParams } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import { grid, th } from '@coko/client'

import { THOTH_CONNECTION_STATUS, THOTH_SYNC_WORK } from '../../../graphql'
import { Button, Text } from '../../common'

const Wrapper = styled.section`
  border: 1px solid ${th('colorBorder')};
  border-radius: ${grid(1)};
  background: ${th('colorBackground')};
  box-shadow: 0 12px 30px rgb(15 23 42 / 8%);
  overflow: hidden;
`

const Header = styled.div`
  background: linear-gradient(135deg, #0f766e 0%, #134e4a 100%);
  color: #fff;
  padding: ${grid(3)};

  h3,
  p {
    color: inherit;
    margin: 0;
  }

  p {
    margin-block-start: ${grid(1)};
    opacity: 0.86;
  }
`

const Body = styled.div`
  display: grid;
  gap: ${grid(3)};
  padding: ${grid(3)};
`

const StatusGrid = styled.div`
  display: grid;
  gap: ${grid(2)};
  grid-template-columns: repeat(2, minmax(0, 1fr));
`

const StatusCard = styled.div`
  border: 1px solid ${th('colorBorder')};
  border-radius: ${grid(1)};
  padding: ${grid(2)};

  strong {
    display: block;
    font-size: 12px;
    letter-spacing: 0.04em;
    margin-block-end: ${grid(1)};
    text-transform: uppercase;
  }
`

const MappingList = styled.div`
  display: grid;
  gap: ${grid(1)};
`

const MappingRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${th('colorBorder')};
  display: grid;
  gap: ${grid(1)};
  grid-template-columns: 1fr auto 1fr;
  padding-block: ${grid(1)};

  &:last-child {
    border-bottom: 0;
  }

  span:nth-child(2) {
    color: ${th('colorTextPlaceholder')};
  }
`

const Notice = styled.div`
  background: rgb(15 118 110 / 10%);
  border: 1px solid rgb(15 118 110 / 25%);
  border-radius: ${grid(1)};
  padding: ${grid(2)};
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${grid(2)};
`

const PayloadWrap = styled.pre`
  background: ${th('colorBackground')};
  border: 1px solid ${th('colorBorder')};
  border-radius: ${grid(1)};
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  overflow: auto;
  padding: ${grid(2)};
`

const readinessRows = values => [
  ['Title', values.title ? 'Ready' : 'Missing'],
  ['Authors', values.authors ? 'Ready' : 'Missing'],
  ['ISBN records', values.isbns?.length ? `${values.isbns.length} prepared` : 'None added'],
  ['Cover image', values.coverUrl ? 'Ready' : 'Missing'],
  ['Publication date', values.publicationDate ? 'Ready' : 'Missing'],
  ['Resolved license', values.license ? values.license : 'Missing'],
  ['Copyright holder', values.copyrightHolder ? values.copyrightHolder : 'Missing'],
]

const mappings = [
  ['Book title', 'Thoth Work title'],
  ['Subtitle', 'Thoth Work subtitle'],
  ['Authors/editors', 'Contributors + Contributions'],
  ['ISBN list', 'Publication identifiers'],
  ['Copyright / license', 'Rights metadata'],
  ['Published URLs', 'Locations / landing page'],
]

const ThothMetadataPanel = ({ values }) => {
  const { bookId } = useParams()
  const readiness = readinessRows(values)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const [fetchConnection, { loading: checkingConnection }] = useLazyQuery(
    THOTH_CONNECTION_STATUS,
    {
      fetchPolicy: 'no-cache',
    },
  )

  const [syncWork, { loading: syncingWork }] = useMutation(THOTH_SYNC_WORK)

  const busy = checkingConnection || syncingWork

  const handleValidate = async () => {
    if (!bookId) {
      setError('Book ID is missing for Thoth validation.')
      return
    }

    setError('')

    try {
      const [connectionResponse, syncResponse] = await Promise.all([
        fetchConnection(),
        syncWork({ variables: { bookId, dryRun: true } }),
      ])

      const connection = connectionResponse?.data?.thothConnectionStatus
      const syncResult = syncResponse?.data?.thothSyncWork

      setResult({
        ...syncResult,
        connection: connection || syncResult?.connection,
        validatedAt: new Date().toISOString(),
      })
    } catch (syncError) {
      setError(syncError.message || 'Validation failed.')
    }
  }

  const handleSync = async () => {
    if (!bookId) {
      setError('Book ID is missing for Thoth sync.')
      return
    }

    setError('')

    try {
      const syncResponse = await syncWork({
        variables: { bookId, dryRun: false },
      })

      const syncResult = syncResponse?.data?.thothSyncWork

      setResult({
        ...syncResult,
        syncedAt: new Date().toISOString(),
      })
    } catch (syncError) {
      setError(syncError.message || 'Thoth sync failed.')
    }
  }

  const payloadPreview = useMemo(() => {
    if (!result?.payload) {
      return ''
    }

    return JSON.stringify(result.payload, null, 2)
  }, [result])

  const canSync = result?.connection?.ok

  return (
    <Wrapper>
      <Header>
        <h3>Thoth metadata sync</h3>
        <p>
          Validate metadata payload first, then run controlled sync to Thoth from
          this metadata workspace.
        </p>
      </Header>

      <Body>
        <StatusGrid>
          <StatusCard>
            <strong>Target publisher</strong>
            <Text>BookHub Nigeria</Text>
          </StatusCard>
          <StatusCard>
            <strong>Default imprint</strong>
            <Text>BookHub Nigeria</Text>
          </StatusCard>
          <StatusCard>
            <strong>Book title</strong>
            <Text>{values.title || 'Untitled book'}</Text>
          </StatusCard>
          <StatusCard>
            <strong>Primary author string</strong>
            <Text>{values.authors || 'No author string yet'}</Text>
          </StatusCard>
          <StatusCard>
            <strong>Publication date</strong>
            <Text>{values.publicationDate || 'Not set yet'}</Text>
          </StatusCard>
          <StatusCard>
            <strong>Resolved license</strong>
            <Text>{values.license || 'Not set yet'}</Text>
          </StatusCard>
        </StatusGrid>

        <div>
          <h4>Readiness snapshot</h4>
          <MappingList>
            {readiness.map(([label, state]) => (
              <MappingRow key={label}>
                <span>{label}</span>
                <span>status</span>
                <span>{state}</span>
              </MappingRow>
            ))}
          </MappingList>
        </div>

        <div>
          <h4>BookHub to Thoth mapping</h4>
          <MappingList>
            {mappings.map(([source, target]) => (
              <MappingRow key={source}>
                <span>{source}</span>
                <span>to</span>
                <span>{target}</span>
              </MappingRow>
            ))}
          </MappingList>
        </div>

        <Notice>
          <CheckCircleOutlined /> Phase 1 is live: validate connection, preview
          payload, and run controlled Work sync.
        </Notice>

        <Actions>
          <Button
            icon={<FileSearchOutlined />}
            loading={busy}
            onClick={handleValidate}
          >
            Validate metadata
          </Button>
          <Button
            disabled={!canSync || busy}
            icon={<CloudSyncOutlined />}
            loading={syncingWork}
            onClick={handleSync}
            type="primary"
          >
            Sync to Thoth
          </Button>
        </Actions>

        {error ? (
          <Alert
            message="Thoth integration error"
            showIcon
            type="error"
            description={error}
          />
        ) : null}

        {result ? (
          <Alert
            message={result.message || 'Thoth response received.'}
            showIcon
            type={result.ok ? 'success' : 'warning'}
            description={
              <div>
                <div>
                  <strong>Operation:</strong> {result.operation || 'n/a'}
                </div>
                <div>
                  <strong>Work ID:</strong> {result.workId || 'not created'}
                </div>
                <div>
                  <strong>Auth mode:</strong>{' '}
                  {result.connection?.authMode || 'unknown'}
                </div>
                <div>
                  <strong>Endpoint:</strong> {result.connection?.endpoint || 'n/a'}
                </div>
              </div>
            }
          />
        ) : null}

        {payloadPreview ? (
          <div>
            <h4>Payload preview</h4>
            <PayloadWrap>{payloadPreview}</PayloadWrap>
          </div>
        ) : null}
      </Body>
    </Wrapper>
  )
}

ThothMetadataPanel.propTypes = {
  values: PropTypes.shape({
    title: PropTypes.string,
    authors: PropTypes.string,
    coverUrl: PropTypes.string,
    publicationDate: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({})]),
    copyrightHolder: PropTypes.string,
    license: PropTypes.string,
    isbns: PropTypes.arrayOf(PropTypes.shape()),
  }),
}

ThothMetadataPanel.defaultProps = {
  values: {},
}

export default ThothMetadataPanel
