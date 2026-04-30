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
