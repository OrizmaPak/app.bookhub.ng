import { gql } from '@apollo/client'

export const THOTH_CONNECTION_STATUS = gql`
  query ThothConnectionStatus {
    thothConnectionStatus {
      ok
      endpoint
      authMode
      message
    }
  }
`

export const THOTH_SYNC_WORK = gql`
  mutation ThothSyncWork($bookId: ID!, $dryRun: Boolean) {
    thothSyncWork(bookId: $bookId, dryRun: $dryRun) {
      ok
      workId
      operation
      message
      connection {
        ok
        endpoint
        authMode
        message
      }
      payload {
        workType
        workStatus
        imprintId
        reference
        doi
        publicationDate
        landingPage
        license
        copyrightHolder
        generalNote
        coverCaption
      }
    }
  }
`
