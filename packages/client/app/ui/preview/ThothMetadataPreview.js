import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { CheckCircleOutlined, CloudSyncOutlined } from '@ant-design/icons'
import { grid, th } from '@coko/client'

import { Button, Text } from '../common'

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

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${grid(2)};
`

const Notice = styled.div`
  background: rgb(15 118 110 / 10%);
  border: 1px solid rgb(15 118 110 / 25%);
  border-radius: ${grid(1)};
  padding: ${grid(2)};
`

const mappings = [
  ['Book title', 'Thoth Work title'],
  ['Subtitle', 'Thoth Work subtitle'],
  ['Authors/editors', 'Contributors + Contributions'],
  ['Web URL', 'Location / landing page'],
  ['PDF / EPUB profiles', 'Publications'],
  ['ISBN / license / date', 'Publication metadata'],
]

const ThothMetadataPreview = props => {
  const { profiles, selectedProfile, webPublishInfo } = props
  const selected = profiles.find(profile => profile.value === selectedProfile)
  const hasPublicUrl = Boolean(webPublishInfo?.publicUrl)

  return (
    <Wrapper>
      <Header>
        <h3>Thoth metadata sync preview</h3>
        <p>
          Frontend preview only. This shows how BookHub metadata will be
          prepared before sending anything to Thoth.
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
            <Text>Pending confirmation</Text>
          </StatusCard>
          <StatusCard>
            <strong>Selected profile</strong>
            <Text>{selected?.label || 'No profile selected'}</Text>
          </StatusCard>
          <StatusCard>
            <strong>Published URL</strong>
            <Text>{hasPublicUrl ? 'Available' : 'Not available yet'}</Text>
          </StatusCard>
        </StatusGrid>

        <div>
          <h4>Metadata mapping</h4>
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
          <CheckCircleOutlined /> This screen will later validate missing fields,
          preview the Thoth payload, and allow an admin-approved sync. Nothing is
          connected yet.
        </Notice>

        <Actions>
          <Button disabled icon={<CloudSyncOutlined />} type="primary">
            Sync to Thoth coming soon
          </Button>
          <Button disabled>Preview payload coming soon</Button>
        </Actions>
      </Body>
    </Wrapper>
  )
}

ThothMetadataPreview.propTypes = {
  profiles: PropTypes.arrayOf(PropTypes.shape()).isRequired,
  selectedProfile: PropTypes.string,
  webPublishInfo: PropTypes.shape(),
}

ThothMetadataPreview.defaultProps = {
  selectedProfile: null,
  webPublishInfo: null,
}

export default ThothMetadataPreview
