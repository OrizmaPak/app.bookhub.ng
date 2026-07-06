import React, { useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import debounce from 'lodash/debounce'
import styled from 'styled-components'
import { useHistory } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { th } from '@coko/client'
import { Button, Checkbox, Select, Spin } from '../../common'
import {
  GET_BOOK_TEAMS,
  SEARCH_USERS,
  TRANSFER_BOOK_OWNERSHIP,
} from '../../../graphql'

const Panel = styled.section`
  background: ${th('colorBackground')};
  border: 1px solid ${th('colorBorder')};
  border-radius: 8px;
  margin-block-start: 16px;
  padding: 16px;
  width: 100%;

  h2 {
    font-size: 18px;
    margin-block: 0 8px;
  }
`

const Warning = styled.div`
  background: #fff4e5;
  border: 1px solid #f59f00;
  border-radius: 8px;
  color: #7a4300;
  margin-block: 12px;
  padding: 12px;
`

const FieldStack = styled.div`
  display: grid;
  gap: 12px;
`

const StyledSelect = styled(Select)`
  width: 100%;
`

const StatusText = styled.p`
  color: ${props => (props.$error ? th('colorError')(props) : 'inherit')};
  margin: 8px 0 0;
`

const TransferOwnershipPanel = ({ bookId, currentUser, isCurrentOwner }) => {
  const history = useHistory()
  const [options, setOptions] = useState([])
  const [fetching, setFetching] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [status, setStatus] = useState(null)
  const fetchRef = useRef(0)

  const [searchForUsers] = useMutation(SEARCH_USERS)
  const [transferOwnership, { loading: transferring }] = useMutation(
    TRANSFER_BOOK_OWNERSHIP,
    {
      refetchQueries: [
        {
          query: GET_BOOK_TEAMS,
          variables: { filter: { objectId: bookId } },
        },
      ],
    },
  )

  const debouncedSearch = useMemo(
    () =>
      debounce(search => {
        const trimmedSearch = search.trim()

        if (!trimmedSearch) {
          setOptions([])
          return
        }

        fetchRef.current += 1
        const fetchId = fetchRef.current
        setFetching(true)

        searchForUsers({
          variables: {
            search: trimmedSearch,
            exclude: currentUser?.id ? [currentUser.id] : [],
            exactMatch: false,
          },
        })
          .then(({ data }) => {
            if (fetchId !== fetchRef.current) return

            const nextOptions = (data?.searchForUsers || []).map(user => ({
              label: user.email
                ? `${user.displayName || user.email} (${user.email})`
                : user.displayName,
              value: user.id,
              email: user.email,
              displayName: user.displayName,
            }))

            setOptions(nextOptions)
          })
          .catch(error => {
            setStatus({ error: true, message: error.message })
            setOptions([])
          })
          .finally(() => {
            if (fetchId === fetchRef.current) setFetching(false)
          })
      }, 500),
    [currentUser?.id, searchForUsers],
  )

  if (!isCurrentOwner) return null

  const handleTransfer = async () => {
    if (!selectedUser?.value || !confirmed) return

    try {
      setStatus(null)

      await transferOwnership({
        variables: {
          bookId,
          newOwnerUserId: selectedUser.value,
        },
      })

      setStatus({
        error: false,
        message: 'Ownership transferred. Redirecting to dashboard...',
      })

      setTimeout(() => history.push('/dashboard'), 700)
    } catch (error) {
      setStatus({ error: true, message: error.message })
    }
  }

  return (
    <Panel>
      <h2>Transfer ownership</h2>
      <FieldStack>
        <p>
          Transfer this book to another registered BookHub user. This action
          changes who controls the book.
        </p>
        <StyledSelect
          disabled={transferring}
          filterOption={false}
          notFoundContent={fetching ? <Spin spinning /> : null}
          onChange={(_, option) => {
            setSelectedUser(option)
            setConfirmed(false)
            setStatus(null)
          }}
          onSearch={debouncedSearch}
          options={options}
          placeholder="Search existing users by name or email"
          showSearch
          value={selectedUser?.value}
        />
        {selectedUser ? (
          <Warning>
            You are about to transfer ownership of this book to{' '}
            <strong>{selectedUser.label}</strong>. You will lose access to this
            book and it will no longer appear in your dashboard unless the new
            owner shares it with you again.
          </Warning>
        ) : null}
        <Checkbox
          checked={confirmed}
          disabled={!selectedUser || transferring}
          onChange={event => setConfirmed(event.target.checked)}
        >
          I understand that I will lose ownership and access to this book.
        </Checkbox>
        <Button
          disabled={!selectedUser || !confirmed || transferring}
          onClick={handleTransfer}
          status="danger"
          type="primary"
        >
          Transfer ownership
        </Button>
        {status ? (
          <StatusText $error={status.error}>{status.message}</StatusText>
        ) : null}
      </FieldStack>
    </Panel>
  )
}

TransferOwnershipPanel.propTypes = {
  bookId: PropTypes.string.isRequired,
  currentUser: PropTypes.shape({
    id: PropTypes.string,
  }),
  isCurrentOwner: PropTypes.bool.isRequired,
}

TransferOwnershipPanel.defaultProps = {
  currentUser: null,
}

export default TransferOwnershipPanel
