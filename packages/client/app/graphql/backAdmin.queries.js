import { gql } from '@apollo/client'

export const BACK_ADMIN_REQUEST_OTP = gql`
  mutation BackAdminRequestOtp($email: String!) {
    backAdminRequestOtp(email: $email) {
      ok
      message
      expiresInSec
    }
  }
`

export const BACK_ADMIN_VERIFY_OTP = gql`
  mutation BackAdminVerifyOtp($email: String!, $otp: String!) {
    backAdminVerifyOtp(email: $email, otp: $otp) {
      token
      email
      expiresAt
    }
  }
`

export const BACK_ADMIN_VALIDATE = gql`
  query BackAdminValidate($sessionToken: String!) {
    backAdminValidate(sessionToken: $sessionToken)
  }
`

export const BACK_ADMIN_STATS = gql`
  query BackAdminStats($sessionToken: String!) {
    backAdminStats(sessionToken: $sessionToken) {
      totalUsers
      activeUsers
      totalBooks
    }
  }
`

export const BACK_ADMIN_USERS = gql`
  query BackAdminUsers($sessionToken: String!) {
    backAdminUsers(sessionToken: $sessionToken) {
      id
      username
      displayName
      email
      isActive
      isVerified
    }
  }
`

export const BACK_ADMIN_BOOK_USER_STATS = gql`
  query BackAdminBookUserStats($sessionToken: String!) {
    backAdminBookUserStats(sessionToken: $sessionToken) {
      userId
      displayName
      email
      isActive
      ownedBooks
      collaboratorBooks
      totalBooks
      webPublishedBooks
      metadataAveragePercent
    }
  }
`

export const BACK_ADMIN_BOOK_TRANSFERS = gql`
  query BackAdminBookTransfers(
    $sessionToken: String!
    $status: String
    $search: String
  ) {
    backAdminBookTransfers(
      sessionToken: $sessionToken
      status: $status
      search: $search
    ) {
      id
      bookId
      bookTitle
      fromUserId
      fromUserEmail
      fromUserName
      toUserId
      toUserEmail
      toUserName
      transferredByUserId
      transferredByEmail
      transferredByName
      status
      reason
      revokeReason
      revokedByUserId
      revokedByEmail
      revokedByName
      revokedAt
      created
    }
  }
`

export const BACK_ADMIN_BOOK_TRANSFER_TRAIL = gql`
  query BackAdminBookTransferTrail($sessionToken: String!, $bookId: ID!) {
    backAdminBookTransferTrail(sessionToken: $sessionToken, bookId: $bookId) {
      bookId
      bookTitle
      currentOwnerUserId
      currentOwnerEmail
      currentOwnerName
      ownerPath {
        pathKey
        userId
        email
        name
      }
      revokeTargets {
        pathKey
        userId
        email
        name
      }
      entries {
        id
        bookId
        bookTitle
        fromUserId
        fromUserEmail
        fromUserName
        toUserId
        toUserEmail
        toUserName
        transferredByUserId
        transferredByEmail
        transferredByName
        status
        reason
        revokeReason
        revokedByUserId
        revokedByEmail
        revokedByName
        revokedAt
        created
      }
    }
  }
`

export const BACK_ADMIN_ACCESS = gql`
  query BackAdminAccess($sessionToken: String!) {
    backAdminAccess(sessionToken: $sessionToken) {
      signInEnabled
      signUpEnabled
    }
  }
`

export const PUBLIC_ACCESS_CONTROLS = gql`
  query PublicAccessControls {
    publicAccessControls {
      signInEnabled
      signUpEnabled
    }
  }
`

export const BACK_ADMIN_EMAIL_QUEUE_STATS = gql`
  query BackAdminEmailQueueStats($sessionToken: String!) {
    backAdminEmailQueueStats(sessionToken: $sessionToken) {
      pending
      processing
      sent
      failed
      total
      oldestPendingAt
      lastFailedAt
    }
  }
`

export const BACK_ADMIN_INSTANCE_HEALTH = gql`
  query BackAdminInstanceHealth($sessionToken: String!) {
    backAdminInstanceHealth(sessionToken: $sessionToken) {
      service
      url
      status
      isHealthy
      statusCode
      latencyMs
      message
      checkedAt
      cpuLoad1
      cpuLoad5
      cpuLoad15
      memoryUsedMb
      memoryTotalMb
    }
  }
`

export const BACK_ADMIN_LOAD_SERIES = gql`
  query BackAdminLoadSeries($sessionToken: String!, $service: String, $minutes: Int) {
    backAdminLoadSeries(
      sessionToken: $sessionToken
      service: $service
      minutes: $minutes
    ) {
      timestamp
      load1
      load5
      load15
      memoryUsedMb
      memoryTotalMb
    }
  }
`

export const BACK_ADMIN_INSTANCE_LOGS = gql`
  query BackAdminInstanceLogs($sessionToken: String!, $service: String, $limit: Int) {
    backAdminInstanceLogs(
      sessionToken: $sessionToken
      service: $service
      limit: $limit
    ) {
      id
      service
      status
      message
      checkedAt
      statusCode
      latencyMs
    }
  }
`

export const BACK_ADMIN_THOTH_STATUS = gql`
  query BackAdminThothStatus($sessionToken: String!) {
    backAdminThothStatus(sessionToken: $sessionToken) {
      defaultEnvironment
      environments {
        key
        label
        endpoint
        ok
        message
        publisherId
        publisherName
        imprintId
        imprintName
      }
    }
  }
`

export const BACK_ADMIN_THOTH_WORKS = gql`
  query BackAdminThothWorks(
    $sessionToken: String!
    $environment: String
    $search: String
    $publisherOnly: Boolean
    $syncedOnly: Boolean
    $page: Int
    $pageSize: Int
  ) {
    backAdminThothWorks(
      sessionToken: $sessionToken
      environment: $environment
      search: $search
      publisherOnly: $publisherOnly
      syncedOnly: $syncedOnly
      page: $page
      pageSize: $pageSize
    ) {
      environment
      page
      pageSize
      totalCount
      items {
        workId
        title
        subtitle
        doi
        reference
        publicationDate
        updatedAt
        landingPage
        publisherId
        publisherName
        imprintId
        imprintName
        isBookHubPublisher
        isBookHubSynced
      }
    }
  }
`

export const BACK_ADMIN_THOTH_WORK = gql`
  query BackAdminThothWork($sessionToken: String!, $environment: String, $workId: ID!) {
    backAdminThothWork(
      sessionToken: $sessionToken
      environment: $environment
      workId: $workId
    ) {
      workId
      title
      subtitle
      doi
      reference
      publicationDate
      updatedAt
      landingPage
      publisherId
      publisherName
      imprintId
      imprintName
      isBookHubPublisher
      isBookHubSynced
      workType
      workStatus
      edition
      license
      copyrightHolder
      generalNote
      coverCaption
      pageCount
      pageBreakdown
      imageCount
      tableCount
      audioCount
      videoCount
      firstPage
      lastPage
      pageInterval
      lccn
      oclc
      titles {
        titleId
        fullTitle
        title
        subtitle
        canonical
        localeCode
      }
      contributors {
        contributionId
        fullName
        contributionType
        contributionOrdinal
        mainContribution
        firstName
        lastName
      }
      publications {
        publicationId
        publicationType
        isbn
        updatedAt
        locations {
          locationId
          landingPage
          fullTextUrl
          locationPlatform
          canonical
        }
      }
      subjects {
        subjectType
        subjectCode
        subjectOrdinal
      }
      languages {
        languageCode
        languageRelation
      }
    }
  }
`

export const BACK_ADMIN_SET_USER_ACTIVE = gql`
  mutation BackAdminSetUserActive(
    $sessionToken: String!
    $userId: ID!
    $isActive: Boolean!
  ) {
    backAdminSetUserActive(
      sessionToken: $sessionToken
      userId: $userId
      isActive: $isActive
    )
  }
`

export const BACK_ADMIN_LOGOUT_USER = gql`
  mutation BackAdminLogoutUser($sessionToken: String!, $userId: ID!) {
    backAdminLogoutUser(sessionToken: $sessionToken, userId: $userId)
  }
`

export const BACK_ADMIN_LOGOUT_ALL = gql`
  mutation BackAdminLogoutAll($sessionToken: String!, $includeAdmins: Boolean) {
    backAdminLogoutAll(sessionToken: $sessionToken, includeAdmins: $includeAdmins)
  }
`

export const BACK_ADMIN_SEND_EMAIL = gql`
  mutation BackAdminSendEmail(
    $sessionToken: String!
    $subject: String!
    $message: String!
    $userIds: [ID!]
    $sendToAll: Boolean
  ) {
    backAdminSendEmail(
      sessionToken: $sessionToken
      subject: $subject
      message: $message
      userIds: $userIds
      sendToAll: $sendToAll
    ) {
      sent
      failed
    }
  }
`

export const BACK_ADMIN_SET_ACCESS = gql`
  mutation BackAdminSetAccess(
    $sessionToken: String!
    $signInEnabled: Boolean!
    $signUpEnabled: Boolean!
  ) {
    backAdminSetAccess(
      sessionToken: $sessionToken
      signInEnabled: $signInEnabled
      signUpEnabled: $signUpEnabled
    ) {
      signInEnabled
      signUpEnabled
    }
  }
`

export const BACK_ADMIN_REVOKE_BOOK_TRANSFER = gql`
  mutation BackAdminRevokeBookTransfer(
    $sessionToken: String!
    $transferId: ID!
    $targetUserId: ID
    $reason: String
  ) {
    backAdminRevokeBookTransfer(
      sessionToken: $sessionToken
      transferId: $transferId
      targetUserId: $targetUserId
      reason: $reason
    ) {
      id
      bookId
      bookTitle
      fromUserEmail
      fromUserName
      toUserEmail
      toUserName
      status
      revokeReason
      revokedAt
    }
  }
`
